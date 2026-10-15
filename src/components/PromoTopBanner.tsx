import { remainingMs, timeParts, useNow, type TopBannerSettings } from '../lib/promoSettings'

// 상세 페이지 맨 위 타이머 배너 — 진한 빨강 그라데이션, 흰 글씨, 숫자는 반투명 칸에 한 자리씩 (대표님 레퍼런스 10/16)
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
    <div className="md:sticky md:top-0 z-40 w-full text-white text-center px-4 py-2.5 max-sm:py-2 shadow-[0_2px_8px_rgba(127,13,13,0.35)]"
      style={{ background: 'linear-gradient(90deg, #6b0a0a 0%, #b91c1c 45%, #dc2626 55%, #6b0a0a 100%)' }}>
      {ended ? (
        <p className="text-sm font-bold m-0">{settings.end_text}</p>
      ) : (
        <div className="flex items-center justify-center gap-x-3 gap-y-1.5 flex-wrap">
          {text && <span className="text-[15px] max-sm:text-[13px] font-bold tracking-tight">{text}</span>}
          {hasTimer && (
            <span className="inline-flex items-center gap-1 tabular-nums">
              {timeParts(left).map((p) => (
                <span key={p.u} className="inline-flex items-center gap-[3px]">
                  {String(p.v).padStart(2, '0').split('').map((ch, i) => (
                    <span key={i} className="inline-flex items-center justify-center w-[22px] h-[26px] max-sm:w-[19px] max-sm:h-[23px] rounded-[5px] bg-white/20 text-[15px] max-sm:text-[13px] font-extrabold">{ch}</span>
                  ))}
                  <span className="text-[12px] font-bold text-white/85 mr-1">{p.u}</span>
                </span>
              ))}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
