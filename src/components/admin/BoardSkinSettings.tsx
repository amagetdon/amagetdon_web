import { useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { storageService } from '../../services/storageService'
import type { BlogMeta } from '../../types'

// 게시판 글 화면 설정 — 스킨(기본/블로그형), 블로그형 표시 정보, 사이트 헤더·푸터 숨김.
export default function BoardSkinSettings({ skin, hideChrome, meta, onChange }: {
  skin: 'default' | 'blog'
  hideChrome: boolean
  meta: BlogMeta
  onChange: (patch: { skin?: 'default' | 'blog'; hide_chrome?: boolean; blog_meta?: BlogMeta }) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const setMeta = (p: Partial<BlogMeta>) => onChange({ blog_meta: { ...meta, ...p } })
  const input = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2ED573]'

  const upload = async (file?: File) => {
    if (!file) return
    setUploading(true)
    try {
      setMeta({ profileImage: await storageService.uploadImage('banners', 'board/profile', file) })
    } catch (e) {
      toast.error(`사진 올리기 실패: ${(e as Error).message}`)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50 space-y-3">
      <div>
        <p className="text-sm font-bold mb-2">글 화면</p>
        <div className="flex gap-2">
          {([['default', '기본 뉴스레터'], ['blog', '네이버 블로그형']] as const).map(([v, t]) => (
            <button key={v} type="button" onClick={() => onChange({ skin: v })}
              className={`px-4 py-2 rounded-lg text-sm border cursor-pointer ${skin === v ? 'bg-[#2ED573] text-white border-[#2ED573] font-bold' : 'bg-white text-gray-600 border-gray-200'}`}>{t}</button>
          ))}
        </div>
      </div>

      {skin === 'blog' && (
        <div className="grid grid-cols-2 max-md:grid-cols-1 gap-3 pt-2 border-t border-gray-200">
          <p className="col-span-full text-[11px] text-gray-400">블로그형 화면에 보일 정보예요. 비워두면 작성 강사 정보로 표시됩니다. (네이버에서 가져오면 자동으로 채워져요)</p>
          <div><label className="text-xs font-bold block mb-1 text-gray-600">블로그 이름 (맨 위)</label><input value={meta.blogTitle ?? ''} onChange={(e) => setMeta({ blogTitle: e.target.value })} placeholder="senior blog" className={input} /></div>
          <div><label className="text-xs font-bold block mb-1 text-gray-600">카테고리</label><input value={meta.category ?? ''} onChange={(e) => setMeta({ category: e.target.value })} placeholder="게시판" className={input} /></div>
          <div><label className="text-xs font-bold block mb-1 text-gray-600">닉네임</label><input value={meta.nickname ?? ''} onChange={(e) => setMeta({ nickname: e.target.value })} placeholder="시니어 BLOG" className={input} /></div>
          <div><label className="text-xs font-bold block mb-1 text-gray-600">닉네임 아래 작은 글씨</label><input value={meta.sub ?? ''} onChange={(e) => setMeta({ sub: e.target.value })} placeholder="lumos___solem" className={input} /></div>
          <div className="col-span-full"><label className="text-xs font-bold block mb-1 text-gray-600">소개</label><input value={meta.description ?? ''} onChange={(e) => setMeta({ description: e.target.value })} placeholder="몸이 늙어도, 수익을 만드는 방법 공부" className={input} /></div>
          <div>
            <label className="text-xs font-bold block mb-1 text-gray-600">사이드바 카테고리 <span className="font-normal text-gray-400">(한 줄에 하나, "이름 | 글 수")</span></label>
            <textarea rows={4} className={input}
              value={(meta.categories ?? []).map((c) => (c.count !== undefined ? `${c.label} | ${c.count}` : c.label)).join('\n')}
              onChange={(e) => setMeta({
                categories: e.target.value.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
                  const [label, count] = l.split('|').map((x) => x.trim())
                  return count !== undefined && count !== '' && !isNaN(Number(count)) ? { label, count: Number(count) } : { label }
                }),
              })}
              placeholder={'전체보기 | 8\n게시판 | 8'} />
          </div>
          <div>
            <label className="text-xs font-bold block mb-1 text-gray-600">사이드바 최근 글 <span className="font-normal text-gray-400">(한 줄에 하나)</span></label>
            <textarea rows={4} className={input}
              value={(meta.recent ?? []).join('\n')}
              onChange={(e) => setMeta({ recent: e.target.value.split('\n').map((l) => l.trim()).filter(Boolean) })}
              placeholder="[수익 공개] 노후 시니어 블로그 부업…" />
          </div>
          <div className="col-span-full flex items-center gap-3">
            {meta.profileImage ? <img src={meta.profileImage} alt="" className="w-16 h-16 object-cover bg-gray-100" /> : <div className="w-16 h-16 bg-gray-100" />}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
            <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()} className="px-3 py-1.5 rounded-lg text-xs border border-gray-200 bg-white cursor-pointer disabled:opacity-50">
              {uploading ? '올리는 중…' : '프로필 사진 바꾸기'}
            </button>
            {meta.profileImage && <button type="button" onClick={() => setMeta({ profileImage: '' })} className="text-xs text-gray-400 bg-transparent border-none cursor-pointer">지우기</button>}
          </div>
        </div>
      )}

      <label className="flex items-start gap-2 text-sm cursor-pointer pt-2 border-t border-gray-200">
        <input type="checkbox" checked={hideChrome} onChange={(e) => onChange({ hide_chrome: e.target.checked })} className="accent-[#2ED573] mt-1" />
        <span>
          사이트 헤더·푸터 숨기기 <span className="text-xs text-gray-400">(이 글 화면에서 아마겟돈 메뉴·하단 정보·상담 버튼을 가립니다)</span>
          {hideChrome && <span className="block text-[11px] text-amber-600 mt-1">사업자 정보(하단)가 안 보이게 됩니다. 광고 랜딩으로 쓸 땐 본문 안에 '광고' 또는 '실제 후기를 바탕으로 각색' 같은 안내 문구를 꼭 남겨 주세요.</span>}
        </span>
      </label>
    </div>
  )
}
