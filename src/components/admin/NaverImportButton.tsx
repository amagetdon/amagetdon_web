import { useState } from 'react'
import toast from 'react-hot-toast'
import { importNaverPost, type ImportUtm } from '../../lib/naverImport'
import { storageService } from '../../services/storageService'

// 관리자 게시판 글쓰기 — 우리 네이버 블로그 글을 주소로 가져와 본문(블로그형 블록)으로 채운다.
const UTM_KEY = 'blog_link_utm'
const DEFAULT_UTM: ImportUtm = { source: 'DABLE', medium: 'native', campaign: 'min_ai_dbl' }

export default function NaverImportButton({ hasContent, onImported }: {
  hasContent: boolean
  onImported: (r: { title: string; html: string; meta: { blogTitle: string; nickname: string; profileImage: string; category: string } }) => void
}) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [tags, setTags] = useState('')
  const [useUtm, setUseUtm] = useState(true)
  const [utm, setUtm] = useState<ImportUtm>(() => {
    try { return { ...DEFAULT_UTM, ...JSON.parse(localStorage.getItem(UTM_KEY) || '{}') } } catch { return DEFAULT_UTM }
  })
  const [progress, setProgress] = useState('')
  const busy = !!progress

  const run = async () => {
    if (!url.trim()) return toast.error('네이버 블로그 글 주소를 넣어주세요.')
    if (hasContent && !confirm('지금 쓰던 본문을 가져온 글로 바꿉니다. 계속할까요?')) return
    try {
      localStorage.setItem(UTM_KEY, JSON.stringify(utm))
      const r = await importNaverPost(url.trim(), {
        upload: (file) => storageService.uploadImage('banners', 'board/naver', file, { compress: false }),
        utm: useUtm ? utm : null,
        onProgress: setProgress,
      })
      const list = tags.split(/[,#\s]+/).map((t) => t.trim()).filter(Boolean)
      const tagBlock = list.length
        ? `<div class="btags" data-tags="${list.join(',').replace(/"/g, '&quot;')}">${list.map((t) => `#${t}`).join(' ')}</div>`
        : ''
      onImported({ title: r.title, html: r.html + tagBlock, meta: r.meta })
      toast.success(`가져왔습니다 (사진 ${r.images}장 옮김)`)
      setOpen(false); setUrl(''); setTags('')
    } catch (e) {
      toast.error(`가져오기 실패: ${(e as Error).message}`)
    } finally {
      setProgress('')
    }
  }

  const input = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2ED573]'

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="text-xs font-bold px-3 py-1.5 rounded-lg border border-[#03C75A] text-[#03a94d] bg-white cursor-pointer hover:bg-[#03C75A]/5 flex items-center gap-1">
        <i className="ti ti-download" /> 네이버 블로그에서 가져오기
      </button>
      {open && (
        <div className="fixed inset-0 bg-black/40 z-[100] flex items-center justify-center p-4" onClick={() => !busy && setOpen(false)}>
          <div className="bg-white rounded-xl w-full max-w-[520px] p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div>
              <h4 className="font-bold">네이버 블로그 글 가져오기</h4>
              <p className="text-xs text-gray-400 mt-1">우리(강사) 블로그 글만 가져와 주세요. 사진은 우리 저장소로 옮기고, 인용구·구분선·슬라이드·링크 카드는 같은 모양으로 들어옵니다.</p>
            </div>
            <div>
              <label className="text-xs font-bold block mb-1 text-gray-600">블로그 글 주소</label>
              <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://blog.naver.com/아이디/글번호" className={input} disabled={busy} />
            </div>
            <div>
              <label className="text-xs font-bold block mb-1 text-gray-600">태그 (선택, 쉼표로 구분)</label>
              <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="시니어부업, ai수익화, 무료강의" className={input} disabled={busy} />
              <p className="text-[11px] text-gray-400 mt-1">네이버 태그는 글 페이지에 들어 있지 않아 직접 넣어야 해요.</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3 space-y-2">
              <label className="flex items-center gap-2 text-xs font-bold text-gray-600 cursor-pointer">
                <input type="checkbox" checked={useUtm} onChange={(e) => setUseUtm(e.target.checked)} className="accent-[#2ED573]" disabled={busy} />
                본문 속 우리 강의·전자책 링크에 UTM 붙이기
              </label>
              {useUtm && (
                <div className="flex gap-1.5">
                  {(['source', 'medium', 'campaign'] as const).map((k) => (
                    <input key={k} value={utm[k]} onChange={(e) => setUtm({ ...utm, [k]: e.target.value })} placeholder={`utm_${k}`} disabled={busy}
                      className="flex-1 min-w-0 border border-gray-200 rounded px-2 py-1 text-xs" />
                  ))}
                </div>
              )}
              <p className="text-[11px] text-gray-400">네이버 짧은 주소(m.site.naver.com)는 실제 주소로 바꿔서 넣어요. 소재 구분(utm_content)은 글 화면에서 자동으로 붙습니다 — 광고로 들어온 경우 광고의 utm_content, 아니면 글 번호.</p>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-gray-500">{progress}</span>
              <div className="flex gap-2">
                <button onClick={() => setOpen(false)} disabled={busy} className="px-4 py-2 rounded-xl text-sm bg-gray-100 border-none cursor-pointer disabled:opacity-40">취소</button>
                <button onClick={run} disabled={busy} className="px-4 py-2 rounded-xl text-sm bg-[#2ED573] text-white font-bold border-none cursor-pointer disabled:opacity-40">
                  {busy ? '가져오는 중…' : '가져오기'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
