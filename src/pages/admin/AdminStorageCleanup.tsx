import { useState } from 'react'
import toast from 'react-hot-toast'
import AdminLayout from '../../components/admin/AdminLayout'
import ConfirmDialog from '../../components/admin/ConfirmDialog'
import { supabase } from '../../lib/supabase'

interface OrphanItem {
  source: 'supabase' | 'r2'
  bucket: string
  path: string
  size: number
  updated_at: string | null
  publicUrl: string
}

interface ListResponse {
  status: string
  scanned: number
  referenced: number
  orphan_count: number
  orphan_total_bytes: number
  orphans: OrphanItem[]
}

interface BucketSpec { source: 'supabase' | 'r2'; name: string }

interface BucketsResponse {
  status: string
  buckets: BucketSpec[]
  r2_enabled: boolean
}

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export default function AdminStorageCleanup() {
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [data, setData] = useState<ListResponse | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [bucketFilter, setBucketFilter] = useState<string>('')
  const [progress, setProgress] = useState<{ current: number; total: number; bucket: string } | null>(null)

  const itemKey = (it: OrphanItem) => `${it.source}:${it.bucket}/${it.path}`
  const bucketLabel = (it: OrphanItem | { source: 'supabase' | 'r2'; bucket: string }) =>
    it.source === 'r2' ? `r2:${it.bucket}` : it.bucket

  const handleScan = async () => {
    setLoading(true)
    setSelected(new Set())
    setData(null)
    try {
      // 1) 검사 대상 버킷 목록 가져오기 (source 별)
      const { data: bucketsRes, error: bErr } = await supabase.functions.invoke('storage-orphans', { body: { action: 'buckets' } })
      if (bErr) throw bErr
      const buckets = (bucketsRes as BucketsResponse).buckets ?? []
      if (buckets.length === 0) throw new Error('스캔할 버킷이 없습니다.')

      // 2) 버킷별로 순차 호출하면서 진행률 업데이트
      const allOrphans: OrphanItem[] = []
      let scanned = 0
      let referenced = 0
      let totalBytes = 0
      for (let i = 0; i < buckets.length; i++) {
        const b = buckets[i]
        setProgress({ current: i, total: buckets.length, bucket: bucketLabel(b) })
        const { data: r, error } = await supabase.functions.invoke('storage-orphans', {
          body: { action: 'list', source: b.source, bucket: b.name },
        })
        if (error) throw error
        const result = r as ListResponse
        allOrphans.push(...result.orphans)
        scanned += result.scanned
        referenced = Math.max(referenced, result.referenced)
        totalBytes += result.orphan_total_bytes
      }
      setProgress({ current: buckets.length, total: buckets.length, bucket: '' })
      setData({
        status: 'ok',
        scanned,
        referenced,
        orphan_count: allOrphans.length,
        orphan_total_bytes: totalBytes,
        orphans: allOrphans,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : '스캔 실패'
      toast.error(msg)
    } finally {
      setLoading(false)
      setProgress(null)
    }
  }

  const handleDelete = async () => {
    if (!data || selected.size === 0) return
    setDeleting(true)
    try {
      const items = data.orphans
        .filter((o) => selected.has(itemKey(o)))
        .map((o) => ({ source: o.source, bucket: o.bucket, path: o.path }))
      const { data: res, error } = await supabase.functions.invoke('storage-orphans', { body: { action: 'delete', items } })
      if (error) throw error
      const totalDeleted = ((res as { results?: Array<{ deleted: number }> })?.results ?? [])
        .reduce((acc, r) => acc + (r.deleted ?? 0), 0)
      toast.success(`${totalDeleted}개 파일 삭제 완료`)
      setConfirmOpen(false)
      // 결과에서 삭제된 항목 제거
      setData({
        ...data,
        orphans: data.orphans.filter((o) => !selected.has(itemKey(o))),
        orphan_count: data.orphan_count - totalDeleted,
      })
      setSelected(new Set())
    } catch (err) {
      const msg = err instanceof Error ? err.message : '삭제 실패'
      toast.error(msg)
    } finally {
      setDeleting(false)
    }
  }

  const buckets = data ? Array.from(new Set(data.orphans.map((o) => bucketLabel(o)))).sort() : []
  const filtered = data ? (bucketFilter ? data.orphans.filter((o) => bucketLabel(o) === bucketFilter) : data.orphans) : []

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map(itemKey)))
    }
  }

  const toggleOne = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const selectedSize = data
    ? data.orphans.filter((o) => selected.has(itemKey(o))).reduce((acc, o) => acc + o.size, 0)
    : 0

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">저장소 정리</h1>
        <p className="text-sm text-gray-500 mt-1">
          DB 어디에서도 참조되지 않는 storage 파일(orphan)을 찾아서 삭제할 수 있습니다.
          업로드 후 교체된 옛날 썸네일, 삭제된 강의/전자책의 잔여 파일 등이 대상입니다.
          <br />
          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 mr-1">SB</span> Supabase Storage,
          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-700 mr-1 ml-1">R2</span> Cloudflare R2 (외부 스토리지 활성 시) 모두 스캔합니다.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-5 mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleScan}
            disabled={loading}
            className="bg-[#2ED573] text-white text-sm font-bold px-5 py-2.5 rounded-lg cursor-pointer border-none hover:bg-[#25B866] transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            <i className="ti ti-refresh text-base" />
            {loading ? '스캔 중...' : data ? '다시 스캔' : '스캔 시작'}
          </button>
          {data && !loading && (
            <div className="text-xs text-gray-500 flex flex-wrap gap-x-4 gap-y-1">
              <span>전체 파일: <strong className="text-gray-900">{data.scanned}개</strong></span>
              <span>DB 참조: <strong className="text-gray-900">{data.referenced}개</strong></span>
              <span>Orphan: <strong className="text-red-500">{data.orphan_count}개</strong> ({formatBytes(data.orphan_total_bytes)})</span>
            </div>
          )}
        </div>
        {loading && progress && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
              <span>
                {progress.bucket
                  ? <>스캔 중: <code className="font-mono text-gray-700">{progress.bucket}</code></>
                  : '완료'}
              </span>
              <span>
                <strong className="text-[#2ED573]">{Math.round((progress.current / progress.total) * 100)}%</strong>
                <span className="text-gray-400 ml-1.5">({progress.current}/{progress.total})</span>
              </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#2ED573] transition-all duration-300"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {data && data.orphans.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-gray-100 flex-wrap gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <select
                value={bucketFilter}
                onChange={(e) => setBucketFilter(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-[#2ED573]"
              >
                <option value="">전체 버킷 ({data.orphan_count})</option>
                {buckets.map((b) => (
                  <option key={b} value={b}>{b} ({data.orphans.filter((o) => bucketLabel(o) === b).length})</option>
                ))}
              </select>
              <button
                onClick={toggleAll}
                className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg cursor-pointer border-none hover:bg-gray-200"
              >
                {selected.size === filtered.length ? '전체 해제' : '전체 선택'} ({filtered.length})
              </button>
            </div>
            {selected.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">{selected.size}개 선택 ({formatBytes(selectedSize)})</span>
                <button
                  onClick={() => setConfirmOpen(true)}
                  disabled={deleting}
                  className="bg-red-500 text-white text-xs font-bold px-4 py-1.5 rounded-lg cursor-pointer border-none hover:bg-red-600 disabled:opacity-50 flex items-center gap-1"
                >
                  <i className="ti ti-trash" /> 선택 삭제
                </button>
              </div>
            )}
          </div>

          <div className="max-h-[640px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="w-10 px-3 py-2"></th>
                  <th className="px-3 py-2 text-left text-xs font-bold text-gray-500">미리보기</th>
                  <th className="px-3 py-2 text-left text-xs font-bold text-gray-500">버킷 / 경로</th>
                  <th className="px-3 py-2 text-right text-xs font-bold text-gray-500">크기</th>
                  <th className="px-3 py-2 text-right text-xs font-bold text-gray-500">수정일</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((o) => {
                  const key = itemKey(o)
                  const isImage = /\.(jpe?g|png|webp|gif|svg|avif)$/i.test(o.path)
                  return (
                    <tr key={key} className="hover:bg-gray-50">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selected.has(key)}
                          onChange={() => toggleOne(key)}
                          className="accent-[#2ED573]"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <a href={o.publicUrl} target="_blank" rel="noopener noreferrer" title="새 탭에서 열기" onClick={(e) => e.stopPropagation()}>
                          {isImage ? (
                            <img src={o.publicUrl} alt="" className="w-16 h-10 object-cover rounded border border-gray-200 bg-gray-100" />
                          ) : (
                            <div className="w-16 h-10 rounded border border-gray-200 bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500 hover:border-[#2ED573] hover:text-[#2ED573] transition-colors">
                              {o.path.split('.').pop()?.toUpperCase() ?? 'file'}
                            </div>
                          )}
                        </a>
                      </td>
                      <td className="px-3 py-2">
                        <a href={o.publicUrl || '#'} target="_blank" rel="noopener noreferrer" className="no-underline hover:underline" onClick={(e) => { if (!o.publicUrl) e.preventDefault(); e.stopPropagation() }}>
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold mr-1.5 ${
                            o.source === 'r2' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {o.source === 'r2' ? 'R2' : 'SB'}
                          </span>
                          <code className="text-xs font-mono text-gray-900">{o.bucket}/</code>
                          <code className="text-xs font-mono text-gray-500 break-all">{o.path}</code>
                        </a>
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-gray-500 whitespace-nowrap">{formatBytes(o.size)}</td>
                      <td className="px-3 py-2 text-right text-xs text-gray-400 whitespace-nowrap">
                        {o.updated_at ? new Date(o.updated_at).toLocaleDateString('ko-KR') : '-'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data && data.orphans.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <i className="ti ti-check-circle text-4xl text-[#2ED573]" />
          <p className="text-sm text-gray-600 mt-3">orphan 파일이 없습니다. 깔끔합니다!</p>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => { if (!deleting) setConfirmOpen(false) }}
        onConfirm={handleDelete}
        title="파일 삭제"
        message={`선택한 ${selected.size}개 파일(${formatBytes(selectedSize)})을 영구 삭제합니다. 되돌릴 수 없습니다.`}
        loading={deleting}
      />
    </AdminLayout>
  )
}
