// 커뮤니티 어드민 화면 공통 부품
import type { ReactNode } from 'react'

export function PageHeader({ title, desc, right }: { title: string; desc: string; right?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3 mb-6 flex-wrap">
      <div>
        <p className="text-xs text-gray-400 mb-1">커뮤니티 · 아마 돈 벌고 있을걸요?</p>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        <p className="text-sm text-gray-500 mt-1">{desc}</p>
      </div>
      {right && <div className="flex items-center gap-2 flex-wrap">{right}</div>}
    </div>
  )
}

export function Toggle({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-6 rounded-full border-none cursor-pointer transition-colors shrink-0 disabled:opacity-50 ${checked ? 'bg-[#2ED573]' : 'bg-gray-300'}`}
    >
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`} />
    </button>
  )
}

export function MoveButtons({ onUp, onDown, upDisabled, downDisabled }: { onUp: () => void; onDown: () => void; upDisabled?: boolean; downDisabled?: boolean }) {
  const cls = 'w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-800 hover:bg-gray-100 bg-transparent border-none cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed'
  return (
    <span className="inline-flex items-center">
      <button type="button" className={cls} onClick={onUp} disabled={upDisabled} aria-label="위로"><i className="ti ti-arrow-up text-sm" /></button>
      <button type="button" className={cls} onClick={onDown} disabled={downDisabled} aria-label="아래로"><i className="ti ti-arrow-down text-sm" /></button>
    </span>
  )
}

export function IconBtn({ icon, label, onClick, tone = 'gray' }: { icon: string; label: string; onClick: () => void; tone?: 'gray' | 'red' | 'blue' }) {
  const hover = tone === 'red' ? 'hover:text-red-500 hover:bg-red-50' : tone === 'blue' ? 'hover:text-blue-500 hover:bg-blue-50' : 'hover:text-gray-800 hover:bg-gray-100'
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 bg-transparent border-none cursor-pointer transition-colors ${hover}`}
    >
      <i className={`ti ${icon} text-sm`} />
    </button>
  )
}

export function Chip({ children, tone = 'gray' }: { children: ReactNode; tone?: 'gray' | 'green' | 'red' | 'dark' | 'blue' | 'amber' }) {
  const t = {
    gray: 'bg-gray-100 text-gray-600',
    green: 'bg-[#2ED573]/10 text-[#13803f]',
    red: 'bg-red-50 text-red-600',
    dark: 'bg-gray-900 text-white',
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-700',
  }[tone]
  return <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-bold whitespace-nowrap ${t}`}>{children}</span>
}

export function Field({ label, children, hint, className = '' }: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <div className={className}>
      <label className="text-sm font-bold block mb-1">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}

export function LoadingRows() {
  return (
    <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
      {[1, 2, 3].map((i) => <div key={i} className="animate-pulse h-12 bg-gray-100 rounded" />)}
    </div>
  )
}

/** 조회 실패 시(대개 DB 적용 전) 안내 */
export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-8 text-center">
      <i className="ti ti-database-off text-3xl text-gray-300" />
      <p className="text-sm text-gray-600 mt-2">불러오지 못했어요: {message}</p>
      <p className="text-xs text-gray-400 mt-1">커뮤니티 DB(20261022000000_community.sql)가 아직 적용되지 않았으면 이렇게 보여요.</p>
      <button type="button" onClick={onRetry} className="mt-4 px-4 py-2 rounded-lg text-sm bg-gray-100 border-none cursor-pointer hover:bg-gray-200">다시 불러오기</button>
    </div>
  )
}
