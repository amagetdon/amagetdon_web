// 커뮤니티 어드민 화면 공통 값·도우미(컴포넌트 없음)

export const inputCls =
  'w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] focus:ring-2 focus:ring-[#2ED573]/10 transition-all bg-white'
export const selectCls =
  'py-2 px-3 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-[#2ED573] cursor-pointer'
export const btnPrimary =
  'bg-[#2ED573] text-white px-4 py-2 rounded-xl text-sm font-bold cursor-pointer border-none hover:bg-[#25B866] transition-colors shadow-sm shadow-[#2ED573]/20 flex items-center gap-1.5 disabled:opacity-50'
export const btnDark =
  'bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-bold cursor-pointer border-none hover:bg-black transition-colors flex items-center gap-1.5'
export const btnLine =
  'bg-white text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer hover:border-[#2ED573] hover:text-[#13b05a] transition-colors inline-flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed'
export const btnLineRed =
  'bg-white text-red-500 border border-red-200 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer hover:bg-red-50 transition-colors inline-flex items-center gap-1 disabled:opacity-40'
export const cardCls = 'bg-white rounded-xl shadow-sm'

/** 'book' · 'ti-book' · 'ti ti-book' 어느 것이든 'ti-book' 으로 */
export function normIcon(v: string | null | undefined): string {
  const s = (v ?? '').trim().replace(/^ti\s+/, '')
  if (!s) return ''
  return s.startsWith('ti-') ? s : `ti-${s}`
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso)
  return `${d.getFullYear() % 100}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso)
  return `${fmtDate(iso)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function errMsg(e: unknown, fallback = '처리하지 못했어요.'): string {
  return e instanceof Error && e.message ? e.message : fallback
}

/** 연결 주소 검사: 비우거나, /로 시작하거나, https:// 로 시작 */
export function validLinkUrl(v: string): boolean {
  const s = v.trim()
  return !s || s.startsWith('/') || s.startsWith('https://')
}

/** 관리자 화면에서 연결 표시용 */
export function linkText(boardId: number | null, url: string | null, boardName: (id: number) => string | undefined): string {
  if (boardId) return `게시판: ${boardName(boardId) ?? '(지워진 게시판)'}`
  if (url) return url
  return '연결 없음'
}
