import { formatClock, remainingMs, useNow, type TopBannerSettings } from '../lib/promoSettings'

// 상세 페이지 맨 위 타이머 배너 — "오늘 남은 할인 수량: 22개 · 00:10:28"
// PC 는 스크롤해도 위에 붙어 있고(sticky), 휴대폰은 맨 위에만.
export default function PromoTopBanner({ settings }: { settings: TopBannerSettings | null | undefined }) {
  const on = !!settings?.enabled
  const now = useNow(on && !!settings?.end_at)
  if (!on || !settings) return null
  const text = (settings.template || '').replace(/\{n\}/g, settings.number != null ? settings.number.toLocaleString() : '')
  const hasTimer = !!settings.end_at
  const left = hasTimer ? remainingMs(settings.end_at, settings.loop_minutes, now) : 0
  const ended = hasTimer && left <= 0
  if (ended && !settings.end_text) return null
  if (!text && !hasTimer) return null
  return (
    <div className="md:sticky md:top-0 z-40 w-full text-white text-center px-4 py-2.5 shadow-sm"
      style={{ background: 'linear-gradient(90deg, #7f0d0d 0%, #c81e1e 50%, #7f0d0d 100%)' }}>
      {ended ? (
        <p className="text-sm font-bold m-0">{settings.end_text}</p>
      ) : (
        <p className="m-0 flex items-center justify-center gap-2 flex-wrap text-sm max-sm:text-[13px] font-bold">
          {text && <span>{text}</span>}
          {hasTimer && (
            <span className="inline-flex items-center gap-1 bg-black/25 rounded-md px-2 py-0.5 tabular-nums tracking-wider">
              <i className="ti ti-clock text-xs" />{formatClock(left)}
            </span>
          )}
        </p>
      )}
    </div>
  )
}
