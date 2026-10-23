import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import AdminLayout from '../../../components/admin/AdminLayout'
import AdminFormModal from '../../../components/admin/AdminFormModal'
import ConfirmDialog from '../../../components/admin/ConfirmDialog'
import ImageUploader from '../../../components/admin/ImageUploader'
import { communityAdminService, moveRow } from '../../../services/communityAdminService'
import type { CommunityBanner, CommunityBannerColor, CommunityBoard, CommunityTile } from '../../../types/community'
import { Chip, Field, IconBtn, LoadError, LoadingRows, MoveButtons, PageHeader, Toggle } from './CommunityAdminParts'
import { btnLine, btnPrimary, cardCls, errMsg, inputCls, linkText, normIcon, validLinkUrl } from './shared'

type LinkMode = 'none' | 'board' | 'url'
const COLORS: { key: CommunityBannerColor; label: string; bg: string; fg: string }[] = [
  { key: 'a', label: '진한 초록', bg: '#13402e', fg: '#ffffff' },
  { key: 'b', label: '연한 초록', bg: '#e9f8ef', fg: '#191919' },
  { key: 'c', label: '회색', bg: '#f2f4f3', fg: '#191919' },
]
const colorOf = (c: CommunityBannerColor) => COLORS.find((x) => x.key === c) ?? COLORS[0]

const NEW_BANNER: Partial<CommunityBanner> = {
  eyebrow: '', title: '', subtitle: '', button_text: '', link_board_id: null, link_url: null, icon: 'ti-broadcast', color: 'a', enabled: true,
  image_url: null, image_url_mobile: null,
}
// 이미지 배너: 이미지 칸(image_url)에 빈 문자열이라도 있으면 이미지 방식으로 편집
const NEW_IMAGE_BANNER: Partial<CommunityBanner> = { ...NEW_BANNER, icon: null, image_url: '' }
const isImageDraft = (b: Partial<CommunityBanner>) => b.image_url != null
const NEW_TILE: Partial<CommunityTile> = { title: '', subtitle: '', icon: 'ti-book', link_board_id: null, link_url: null, highlight: false, enabled: true }

function modeOf(x: { link_board_id?: number | null; link_url?: string | null }): LinkMode {
  return x.link_board_id ? 'board' : x.link_url ? 'url' : 'none'
}

/** 연결: 없음 / 게시판 / 주소 */
function LinkEditor({ value, boards, onChange }: {
  value: { link_board_id?: number | null; link_url?: string | null }
  boards: CommunityBoard[]
  onChange: (v: { link_board_id: number | null; link_url: string | null }) => void
}) {
  const [mode, setMode] = useState<LinkMode>(modeOf(value))
  return (
    <div className="flex gap-2 max-sm:flex-col">
      <select
        value={mode}
        onChange={(e) => {
          const m = e.target.value as LinkMode
          setMode(m)
          if (m === 'none') onChange({ link_board_id: null, link_url: null })
          if (m === 'board') onChange({ link_board_id: boards[0]?.id ?? null, link_url: null })
          if (m === 'url') onChange({ link_board_id: null, link_url: value.link_url ?? '' })
        }}
        className={`${inputCls} sm:max-w-[120px]`}
      >
        <option value="none">연결 없음</option>
        <option value="board">게시판</option>
        <option value="url">주소</option>
      </select>
      {mode === 'board' && (
        <select value={value.link_board_id ?? ''} onChange={(e) => onChange({ link_board_id: Number(e.target.value) || null, link_url: null })} className={inputCls}>
          {boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      )}
      {mode === 'url' && (
        <input
          value={value.link_url ?? ''}
          onChange={(e) => onChange({ link_board_id: null, link_url: e.target.value })}
          placeholder="/course/129 또는 https://..."
          className={`${inputCls} ${validLinkUrl(value.link_url ?? '') ? '' : '!border-red-400'}`}
        />
      )}
    </div>
  )
}

function IconInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ic = normIcon(value)
  return (
    <div className="flex items-center gap-2">
      <span className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
        {ic ? <i className={`ti ${ic} text-xl text-gray-700`} /> : <i className="ti ti-photo-off text-gray-300" />}
      </span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="ti-broadcast" className={inputCls} />
    </div>
  )
}

/** 휴대폰 미리보기(시안 v8 배너·타일 모양) */
function PhonePreview({ banners, tiles }: { banners: Partial<CommunityBanner>[]; tiles: CommunityTile[] }) {
  return (
    <div className="w-[390px] max-w-full rounded-[28px] border-[6px] border-gray-900 bg-white overflow-hidden shadow-lg">
      <div className="px-4 pt-4 pb-2">
        <p className="text-[15px] font-extrabold text-gray-900">아마 돈 벌고 있을걸요?</p>
        <p className="text-[11px] text-gray-400">아마겟돈 클래스 수강생 커뮤니티</p>
      </div>
      <div className="px-4 pt-1">
        {banners.length === 0 ? (
          <div className="h-[128px] rounded-xl border border-dashed border-gray-300 flex items-center justify-center text-xs text-gray-400">켜진 배너가 없어요</div>
        ) : (
          <div className="flex overflow-x-auto gap-2 snap-x snap-mandatory rounded-xl [scrollbar-width:none]">
            {banners.map((b, i) => {
              if (b.image_url != null) {
                const src = b.image_url_mobile || b.image_url
                return (
                  <div key={b.id ?? `new-${i}`} className="shrink-0 w-full snap-start rounded-xl overflow-hidden bg-gray-100">
                    {src ? <img src={src} alt={b.title ?? ''} className="block w-full h-auto" /> : <div className="h-[128px] flex items-center justify-center text-xs text-gray-400">이미지를 올려 주세요</div>}
                  </div>
                )
              }
              const c = colorOf(b.color ?? 'a')
              const dark = (b.color ?? 'a') === 'a'
              return (
                <div key={b.id ?? `new-${i}`} className="relative shrink-0 w-full snap-start h-[128px] rounded-xl overflow-hidden px-[18px] py-4 flex flex-col justify-between" style={{ background: c.bg, color: c.fg }}>
                  <span className="absolute -right-[30px] -top-[30px] w-[140px] h-[140px] rounded-full border-[18px] opacity-[.08]" style={{ borderColor: c.fg }} />
                  <span className="absolute right-[42px] -bottom-[40px] w-[90px] h-[90px] rounded-full opacity-[.06]" style={{ background: c.fg }} />
                  <div className="relative pr-14 min-w-0">
                    {b.eyebrow && <small className="block text-[12px] font-semibold opacity-75 truncate">{b.eyebrow}</small>}
                    <b className="block text-[18px] font-extrabold leading-tight mt-0.5 truncate">{b.title || '제목을 적어 주세요'}</b>
                    {b.subtitle && <span className="block text-[12.5px] opacity-80 truncate">{b.subtitle}</span>}
                  </div>
                  {b.button_text && (
                    <span className="relative self-start h-[30px] px-3 rounded-full text-[12.5px] font-bold inline-flex items-center gap-0.5"
                      style={dark ? { background: '#2ED573', color: '#0b2a1e' } : { background: '#191919', color: '#fff' }}>
                      {b.button_text}<i className="ti ti-chevron-right text-sm" />
                    </span>
                  )}
                  {normIcon(b.icon) && (
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.04)' }}>
                      <i className={`ti ${normIcon(b.icon)} text-[26px]`} style={{ color: dark ? '#2ED573' : '#13803f' }} />
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
        <div className="flex justify-center gap-[5px] mt-2 mb-1">
          {banners.map((b, i) => <i key={b.id ?? `d-${i}`} className={`h-[5px] rounded-sm ${i === 0 ? 'w-[14px] bg-gray-900' : 'w-[5px] bg-gray-300'}`} />)}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 px-4 pt-2 pb-5">
        {tiles.map((t) => (
          <div key={t.id} className={`flex items-center gap-2.5 h-[62px] px-3 rounded-[10px] border min-w-0 ${t.highlight ? 'bg-[#f3fbf6] border-[#dcf2e5]' : 'bg-white border-gray-200'}`}>
            <span className={`w-[34px] h-[34px] rounded-[9px] flex items-center justify-center shrink-0 ${t.highlight ? 'bg-[#13402e] text-white' : 'bg-[#e3f6ea] text-[#13803f]'}`}>
              <i className={`ti ${normIcon(t.icon) || 'ti-point'} text-[19px]`} />
            </span>
            <span className="min-w-0">
              <b className="block text-[14px] font-bold truncate text-gray-900">{t.title}</b>
              {t.subtitle && <span className="block text-[11.5px] text-gray-400 truncate">{t.subtitle}</span>}
            </span>
          </div>
        ))}
        {tiles.length === 0 && <p className="col-span-2 text-xs text-gray-400 text-center py-4">켜진 타일이 없어요</p>}
      </div>
    </div>
  )
}

export default function AdminCommunityHome() {
  const [boards, setBoards] = useState<CommunityBoard[]>([])
  const [banners, setBanners] = useState<CommunityBanner[]>([])
  const [tiles, setTiles] = useState<CommunityTile[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const reload = () => setTick((t) => t + 1)
  const [busy, setBusy] = useState(false)

  const [draft, setDraft] = useState<Partial<CommunityBanner> | null>(null)
  const [draftKey, setDraftKey] = useState(0)
  const [deleteBanner, setDeleteBanner] = useState<CommunityBanner | null>(null)
  const [tileEdit, setTileEdit] = useState<Partial<CommunityTile> | null>(null)
  const [deleteTile, setDeleteTile] = useState<CommunityTile | null>(null)

  useEffect(() => {
    let alive = true
    Promise.all([communityAdminService.boards(), communityAdminService.banners(), communityAdminService.tiles()])
      .then(([b, bn, t]) => {
        if (!alive) return
        setBoards(b); setBanners(bn); setTiles(t); setLoadError(null); setLoading(false)
      })
      .catch((e) => { if (alive) { setLoadError(errMsg(e)); setLoading(false) } })
    return () => { alive = false }
  }, [tick])

  const boardName = (id: number) => boards.find((b) => b.id === id)?.name

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      setBusy(true)
      await fn()
      toast.success(ok)
      reload()
      return true
    } catch (e) {
      toast.error(errMsg(e))
      return false
    } finally {
      setBusy(false)
    }
  }

  const editBanner = (b: Partial<CommunityBanner>) => { setDraft({ ...b }); setDraftKey((k) => k + 1) }

  const saveDraft = async () => {
    if (!draft) return
    const img = isImageDraft(draft)
    if (img && !draft.image_url?.trim()) { toast.error('PC 이미지를 올려 주세요.'); return }
    if (!draft.title?.trim()) { toast.error(img ? '이미지 설명을 적어 주세요(이미지가 안 보일 때 대신 읽히는 글).' : '제목을 적어 주세요.'); return }
    if (!validLinkUrl(draft.link_url ?? '')) { toast.error('주소는 / 또는 https:// 로 시작해야 해요.'); return }
    const payload = { ...draft, icon: normIcon(draft.icon) || null, sort_order: draft.id ? draft.sort_order : Math.max(0, ...banners.map((b) => b.sort_order)) + 1 }
    try {
      setBusy(true)
      const id = await communityAdminService.saveBanner(payload)
      toast.success('배너를 저장했어요.')
      setDraft({ ...payload, id })
      reload()
    } catch (e) {
      toast.error(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  const saveTile = async () => {
    if (!tileEdit) return
    if (!tileEdit.title?.trim()) { toast.error('제목을 적어 주세요.'); return }
    if (!validLinkUrl(tileEdit.link_url ?? '')) { toast.error('주소는 / 또는 https:// 로 시작해야 해요.'); return }
    const payload = { ...tileEdit, icon: normIcon(tileEdit.icon) || null, sort_order: tileEdit.id ? tileEdit.sort_order : Math.max(0, ...tiles.map((t) => t.sort_order)) + 1 }
    if (await run(() => communityAdminService.saveTile(payload), '타일을 저장했어요.')) setTileEdit(null)
  }

  // 미리보기: 켜진 배너 + 편집 중인 내용 반영
  const previewBanners = useMemo(() => {
    const list: Partial<CommunityBanner>[] = banners.map((b) => (draft?.id === b.id ? { ...b, ...draft } : b))
    if (draft && !draft.id) list.push(draft)
    return list.filter((b) => b.enabled !== false)
  }, [banners, draft])
  const previewTiles = tiles.filter((t) => t.enabled)

  return (
    <AdminLayout>
      <PageHeader
        title="홈 꾸미기"
        desc="커뮤니티 첫 화면의 배너 슬라이드와 바로가기 타일을 바꿔요."
        right={<a href="/community" target="_blank" rel="noopener noreferrer" className="bg-white text-gray-700 border border-gray-200 px-4 py-2 rounded-xl text-sm font-bold no-underline hover:border-[#2ED573] hover:text-[#13b05a] transition-colors inline-flex items-center gap-1.5"><i className="ti ti-eye text-sm" /> 사이트에서 보기</a>}
      />
      <p className="mb-5 flex items-center gap-1.5 text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-4 py-2.5">
        <i className="ti ti-alert-circle" /> 근거 없는 수익 문구(예: 누구나 월 300)는 쓰지 않아요.
      </p>

      {loadError ? <LoadError message={loadError} onRetry={reload} /> : loading ? <LoadingRows /> : (
        <div className="flex gap-6 items-start max-xl:flex-col">
          <div className="flex-1 min-w-0 w-full space-y-5">
            {/* 배너 목록 */}
            <div className={cardCls}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h2 className="text-sm font-bold text-gray-900">배너 슬라이드 <span className="text-xs text-gray-400 font-normal">켜진 {banners.filter((b) => b.enabled).length}장</span></h2>
                <span className="flex gap-2">
                  <button type="button" className={btnPrimary} onClick={() => editBanner(NEW_IMAGE_BANNER)}><i className="ti ti-photo-plus text-xs" /> 이미지 배너 추가</button>
                  <button type="button" className={btnLine} onClick={() => editBanner(NEW_BANNER)}><i className="ti ti-plus text-xs" /> 글자 배너 추가</button>
                </span>
              </div>
              {banners.length === 0 && <p className="px-5 py-6 text-sm text-gray-400 text-center">배너가 없어요. '슬라이드 추가'로 만들어 보세요.</p>}
              {banners.map((b, i) => {
                const c = colorOf(b.color)
                return (
                  <div key={b.id} className={`flex items-center gap-3 px-5 py-3 border-b border-gray-50 last:border-none cursor-pointer ${draft?.id === b.id ? 'bg-[#2ED573]/5' : 'hover:bg-gray-50'}`} onClick={() => editBanner(b)}>
                    {b.image_url ? (
                      <img src={b.image_url} alt="" className="w-[72px] h-10 rounded-lg object-cover shrink-0 bg-gray-100" />
                    ) : (
                      <span className="w-14 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: c.bg, color: b.color === 'a' ? '#2ED573' : '#13803f' }}>
                        <i className={`ti ${normIcon(b.icon) || 'ti-photo'} text-lg`} />
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{b.image_url ? <span className="text-[11px] font-bold text-[#13b05a] mr-1">이미지</span> : null}{b.title}</p>
                      <p className="text-xs text-gray-400 truncate">
                        {[b.eyebrow, b.button_text].filter(Boolean).join(' · ')}{b.button_text ? ' → ' : ' · '}{linkText(b.link_board_id, b.link_url, boardName)}
                      </p>
                    </div>
                    <span onClick={(e) => e.stopPropagation()} className="flex items-center gap-1">
                      <MoveButtons onUp={() => run(() => moveRow('community_banners', banners, i, -1), '순서를 바꿨어요.')} onDown={() => run(() => moveRow('community_banners', banners, i, 1), '순서를 바꿨어요.')} upDisabled={busy || i === 0} downDisabled={busy || i === banners.length - 1} />
                      <Toggle checked={b.enabled} disabled={busy} label="켜고 끄기" onChange={(v) => run(() => communityAdminService.setBannerEnabled(b.id, v), v ? '배너를 켰어요.' : '배너를 껐어요.')} />
                      <IconBtn icon="ti-trash" label="삭제" tone="red" onClick={() => setDeleteBanner(b)} />
                    </span>
                  </div>
                )
              })}
            </div>

            {/* 배너 편집 */}
            {draft && (
              <div className={`${cardCls} p-5`} key={draftKey}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-gray-900">{isImageDraft(draft) ? (draft.id ? '이미지 배너 수정' : '새 이미지 배너') : (draft.id ? '배너 수정' : '새 배너')}</h3>
                  <button type="button" className="text-xs text-gray-400 bg-transparent border-none cursor-pointer hover:text-gray-700" onClick={() => setDraft(null)}>닫기</button>
                </div>
                {isImageDraft(draft) ? (
                <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-4">
                  <Field label="PC 이미지 *" hint="가로형 권장(예: 1200×680). 잘리지 않고 비율 그대로 보여요." className="col-span-2 max-sm:col-span-1">
                    <ImageUploader bucket="banners" path="community" currentUrl={draft.image_url || null} objectFit="contain" className="w-full h-44 bg-gray-50"
                      onUpload={(url) => setDraft({ ...draft, image_url: url || '' })} />
                  </Field>
                  <Field label="모바일 이미지(선택)" hint="비워 두면 PC 이미지를 그대로 써요." className="col-span-2 max-sm:col-span-1">
                    <ImageUploader bucket="banners" path="community" currentUrl={draft.image_url_mobile || null} objectFit="contain" className="w-full h-36 bg-gray-50"
                      onUpload={(url) => setDraft({ ...draft, image_url_mobile: url || null })} />
                  </Field>
                  <Field label="이미지 설명 *" hint="이미지가 안 보일 때 대신 읽히는 글(화면에는 안 나와요)" className="col-span-2 max-sm:col-span-1">
                    <input value={draft.title ?? ''} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className={inputCls} placeholder="예: 무료강의 10/23 AI 블로그 수익화 정답지" maxLength={80} />
                  </Field>
                  <Field label="누르면 이동" hint="강의 상세는 /course/강의번호, 바깥 주소는 https://..." className="col-span-2 max-sm:col-span-1">
                    <LinkEditor value={draft} boards={boards} onChange={(v) => setDraft({ ...draft, ...v })} />
                  </Field>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" className="accent-[#2ED573]" checked={draft.enabled !== false} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} />
                    켜기(사용자 화면에 보이기)
                  </label>
                </div>
                ) : (
                <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-4">
                  <Field label="작은 글씨">
                    <input value={draft.eyebrow ?? ''} onChange={(e) => setDraft({ ...draft, eyebrow: e.target.value })} className={inputCls} placeholder="예: 무료 라이브" maxLength={30} />
                  </Field>
                  <Field label="버튼 글자">
                    <input value={draft.button_text ?? ''} onChange={(e) => setDraft({ ...draft, button_text: e.target.value })} className={inputCls} placeholder="예: 신청하기" maxLength={12} />
                  </Field>
                  <Field label="제목 *" className="col-span-2 max-sm:col-span-1">
                    <input value={draft.title ?? ''} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className={inputCls} maxLength={40} />
                  </Field>
                  <Field label="설명 한 줄" className="col-span-2 max-sm:col-span-1">
                    <input value={draft.subtitle ?? ''} onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })} className={inputCls} maxLength={60} />
                  </Field>
                  <Field label="누르면 이동" className="col-span-2 max-sm:col-span-1">
                    <LinkEditor value={draft} boards={boards} onChange={(v) => setDraft({ ...draft, ...v })} />
                  </Field>
                  <Field label="아이콘" hint="tabler 아이콘 이름(tabler.io/icons) 예: ti-broadcast, ti-flag, ti-book">
                    <IconInput value={draft.icon ?? ''} onChange={(v) => setDraft({ ...draft, icon: v })} />
                  </Field>
                  <Field label="색">
                    <div className="flex gap-2 pt-1">
                      {COLORS.map((c) => (
                        <button key={c.key} type="button" title={c.label} aria-label={c.label} onClick={() => setDraft({ ...draft, color: c.key })}
                          className={`w-10 h-10 rounded-lg cursor-pointer border-2 ${draft.color === c.key ? 'border-[#2ED573] ring-2 ring-[#2ED573]/30' : 'border-gray-200'}`}
                          style={{ background: c.bg }} />
                      ))}
                    </div>
                  </Field>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" className="accent-[#2ED573]" checked={draft.enabled !== false} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} />
                    켜기(사용자 화면에 보이기)
                  </label>
                </div>
                )}
                <div className="flex justify-end gap-2 mt-5">
                  <button type="button" className={btnLine} onClick={() => setDraft(null)}>취소</button>
                  <button type="button" className={btnPrimary} disabled={busy} onClick={saveDraft}><i className="ti ti-device-floppy text-sm" /> 저장</button>
                </div>
              </div>
            )}

            {/* 바로가기 타일 */}
            <div className={cardCls}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 gap-2 flex-wrap">
                <h2 className="text-sm font-bold text-gray-900">바로가기 타일 <span className="text-xs text-gray-400 font-normal">2열 · 끄면 사용자 화면에서 빠져요</span></h2>
                <button type="button" className={btnLine} onClick={() => setTileEdit({ ...NEW_TILE })}><i className="ti ti-plus text-xs" /> 타일 추가</button>
              </div>
              {tiles.length === 0 && <p className="px-5 py-6 text-sm text-gray-400 text-center">타일이 없어요.</p>}
              {tiles.map((t, i) => (
                <div key={t.id} className="flex items-center gap-3 px-5 py-2.5 border-b border-gray-50 last:border-none hover:bg-gray-50">
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${t.highlight ? 'bg-[#13402e] text-white' : 'bg-[#e3f6ea] text-[#13803f]'}`}>
                    <i className={`ti ${normIcon(t.icon) || 'ti-point'}`} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate"><b className="text-gray-900">{t.title}</b> <span className="text-gray-400 text-xs">{t.subtitle}</span></p>
                    <p className="text-xs text-gray-400 truncate">{linkText(t.link_board_id, t.link_url, boardName)}</p>
                  </div>
                  {t.highlight ? <Chip tone="green">강조 색</Chip> : <Chip>기본</Chip>}
                  <MoveButtons onUp={() => run(() => moveRow('community_tiles', tiles, i, -1), '순서를 바꿨어요.')} onDown={() => run(() => moveRow('community_tiles', tiles, i, 1), '순서를 바꿨어요.')} upDisabled={busy || i === 0} downDisabled={busy || i === tiles.length - 1} />
                  <Toggle checked={t.enabled} disabled={busy} label="켜고 끄기" onChange={(v) => run(() => communityAdminService.setTileEnabled(t.id, v), v ? '타일을 켰어요.' : '타일을 껐어요.')} />
                  <IconBtn icon="ti-pencil" label="수정" tone="blue" onClick={() => setTileEdit({ ...t })} />
                  <IconBtn icon="ti-trash" label="삭제" tone="red" onClick={() => setDeleteTile(t)} />
                </div>
              ))}
            </div>
          </div>

          <div className="xl:sticky xl:top-6 shrink-0 max-xl:w-full max-xl:flex max-xl:flex-col max-xl:items-center">
            <p className="text-xs text-gray-400 text-center mb-2">미리보기(저장 전 편집 내용 포함)</p>
            <PhonePreview banners={previewBanners} tiles={previewTiles} />
          </div>
        </div>
      )}

      <AdminFormModal isOpen={!!tileEdit} onClose={() => setTileEdit(null)} title={tileEdit?.id ? '타일 수정' : '새 타일'} onSubmit={saveTile} loading={busy} maxWidthClass="max-w-[520px]">
        {tileEdit && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-4">
              <Field label="제목 *"><input value={tileEdit.title ?? ''} onChange={(e) => setTileEdit({ ...tileEdit, title: e.target.value })} className={inputCls} maxLength={12} /></Field>
              <Field label="부제"><input value={tileEdit.subtitle ?? ''} onChange={(e) => setTileEdit({ ...tileEdit, subtitle: e.target.value })} className={inputCls} maxLength={20} /></Field>
            </div>
            <Field label="아이콘" hint="tabler 아이콘 이름 예: ti-book, ti-notebook, ti-help-circle">
              <IconInput value={tileEdit.icon ?? ''} onChange={(v) => setTileEdit({ ...tileEdit, icon: v })} />
            </Field>
            <Field label="누르면 이동">
              <LinkEditor value={tileEdit} boards={boards} onChange={(v) => setTileEdit({ ...tileEdit, ...v })} />
            </Field>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" className="accent-[#2ED573]" checked={!!tileEdit.highlight} onChange={(e) => setTileEdit({ ...tileEdit, highlight: e.target.checked })} /> 강조 색
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" className="accent-[#2ED573]" checked={tileEdit.enabled !== false} onChange={(e) => setTileEdit({ ...tileEdit, enabled: e.target.checked })} /> 켜기
              </label>
            </div>
          </div>
        )}
      </AdminFormModal>

      <ConfirmDialog
        isOpen={!!deleteBanner}
        onClose={() => setDeleteBanner(null)}
        onConfirm={async () => {
          if (!deleteBanner) return
          if (await run(() => communityAdminService.deleteBanner(deleteBanner.id), '배너를 지웠어요.')) {
            if (draft?.id === deleteBanner.id) setDraft(null)
            setDeleteBanner(null)
          }
        }}
        title="배너 삭제"
        message={`'${deleteBanner?.title ?? ''}' 배너를 지울까요? 잠깐 안 보이게 하려면 끄기만 해도 돼요.`}
        loading={busy}
      />
      <ConfirmDialog
        isOpen={!!deleteTile}
        onClose={() => setDeleteTile(null)}
        onConfirm={async () => {
          if (!deleteTile) return
          if (await run(() => communityAdminService.deleteTile(deleteTile.id), '타일을 지웠어요.')) setDeleteTile(null)
        }}
        title="타일 삭제"
        message={`'${deleteTile?.title ?? ''}' 타일을 지울까요?`}
        loading={busy}
      />
    </AdminLayout>
  )
}
