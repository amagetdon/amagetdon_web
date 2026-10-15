import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import type { ApplyCardSettings, TopBannerSettings } from '../../lib/promoSettings'

// 관리자 — 상세 페이지 '신청 카드'·'상단 타이머 배너' 설정 (강의·전자책 공용, 10/16)
// 이 칸만 따로 저장한다(다른 강의 정보 저장과 별개). 저장하면 상세 페이지에 바로 반영(새로고침 시).

const LOOPS: { value: string; label: string }[] = [
  { value: '', label: '반복 안 함 (끝나면 멈춤)' },
  { value: '10', label: '10분마다 다시 시작' },
  { value: '30', label: '30분마다 다시 시작' },
  { value: '60', label: '1시간마다 다시 시작' },
  { value: '1440', label: '24시간마다 다시 시작' },
]

// datetime-local(한국 시간) ↔ ISO
const toLocalInput = (iso?: string | null) => {
  if (!iso) return ''
  const d = new Date(new Date(iso).getTime() + 9 * 3600_000)
  return d.toISOString().slice(0, 16)
}
const fromLocalInput = (v: string) => (v ? new Date(`${v}:00+09:00`).toISOString() : null)
const numOrNull = (v: string) => (v.trim() === '' ? null : Math.max(0, Math.floor(Number(v)) || 0))

const input = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2ED573]'
const label = 'block text-xs font-bold text-gray-600 mb-1'

export default function AdminPromoSettings({ kind, id }: { kind: 'course' | 'ebook'; id: number }) {
  const table = kind === 'course' ? 'courses' : 'ebooks'
  const [card, setCard] = useState<ApplyCardSettings>({})
  const [banner, setBanner] = useState<TopBannerSettings>({})
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from(table).select('apply_card, top_banner').eq('id', id).maybeSingle().then(({ data }) => {
      const r = (data ?? {}) as { apply_card?: ApplyCardSettings | null; top_banner?: TopBannerSettings | null }
      setCard(r.apply_card ?? {})
      setBanner(r.top_banner ?? {})
      setLoaded(true)
    })
  }, [table, id])

  const save = async () => {
    setSaving(true)
    const { error } = await supabase.from(table).update({ apply_card: card, top_banner: banner } as never).eq('id', id)
    setSaving(false)
    if (error) { toast.error(`저장 실패: ${error.message}`); return }
    toast.success('저장했어요. 상세 페이지를 새로고침하면 바로 보여요.')
  }

  if (!loaded) return <div className="text-sm text-gray-400">불러오는 중…</div>

  const cd = card.countdown ?? {}
  return (
    <div className="space-y-6">
      <div className="border border-gray-200 rounded-xl p-4 space-y-3">
        <label className="flex items-center gap-2 text-sm font-bold cursor-pointer">
          <input type="checkbox" checked={!!card.enabled} onChange={(e) => setCard({ ...card, enabled: e.target.checked })} />
          신청 카드 꾸미기 켜기
        </label>
        <p className="text-xs text-gray-400 m-0">끄면 지금 화면 그대로. 숫자는 직접 입력한 값이 그대로 보여요(실제 수와 다르지 않게 관리해 주세요).</p>
        {kind === 'course' && (
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={card.show_schedule !== false} onChange={(e) => setCard({ ...card, show_schedule: e.target.checked })} />
            강의 일시 표시 (강의일시 칸 값 사용: "10월 23일 금요일 / 오후 7시 30분 시작")
          </label>
        )}
        <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-3">
          <div>
            <span className={label}>할인 문구 (가격 위, 비우면 안 보임)</span>
            <input className={input} value={card.discount_label ?? ''} placeholder="선착순 100% 할인" onChange={(e) => setCard({ ...card, discount_label: e.target.value })} />
          </div>
          <div>
            <span className={label}>신청 버튼 문구 (비우면 기본 문구)</span>
            <input className={input} value={card.button_label ?? ''} placeholder="무료 강의 참여하기" onChange={(e) => setCard({ ...card, button_label: e.target.value })} />
          </div>
          <div>
            <span className={label}>강조색 (버튼·체크)</span>
            <select className={input} value={card.accent ?? 'green'} onChange={(e) => setCard({ ...card, accent: e.target.value as 'green' | 'blue' })}>
              <option value="green">초록 (사이트 기본색)</option>
              <option value="blue">파랑</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-3 max-sm:grid-cols-1 gap-3">
          <div>
            <span className={label}>남은 자리 배지</span>
            <select className={input} value={(card.seats_mode ?? (card.seats != null ? 'manual' : ''))} onChange={(e) => setCard({ ...card, seats_mode: (e.target.value || null) as 'manual' | 'range' | null })}>
              <option value="">표시 안 함</option>
              <option value="manual">직접 입력한 숫자</option>
              <option value="range">범위 안에서 자동 (하루 동안 천천히 줄어듦)</option>
            </select>
          </div>
          {(card.seats_mode ?? (card.seats != null ? 'manual' : '')) === 'manual' && (
            <div>
              <span className={label}>남은 자리 숫자</span>
              <input className={input} type="number" min={0} value={card.seats ?? ''} placeholder="12" onChange={(e) => setCard({ ...card, seats: numOrNull(e.target.value) })} />
            </div>
          )}
          {(card.seats_mode ?? (card.seats != null ? 'manual' : '')) === 'range' && (<>
            <div>
              <span className={label}>최소</span>
              <input className={input} type="number" min={0} value={card.seats_min ?? ''} placeholder="20" onChange={(e) => setCard({ ...card, seats_min: numOrNull(e.target.value) })} />
            </div>
            <div>
              <span className={label}>최대</span>
              <input className={input} type="number" min={0} value={card.seats_max ?? ''} placeholder="30" onChange={(e) => setCard({ ...card, seats_max: numOrNull(e.target.value) })} />
            </div>
          </>)}
        </div>
        <div className="grid grid-cols-3 max-sm:grid-cols-1 gap-3">
          <div>
            <span className={label}>카운트다운 문구</span>
            <input className={input} value={cd.label ?? ''} placeholder="선착순 마감까지" onChange={(e) => setCard({ ...card, countdown: { ...cd, label: e.target.value } })} />
          </div>
          <div>
            <span className={label}>카운트다운 종료 (한국 시간, 비우면 기존 '모집 마감까지')</span>
            <input className={input} type="datetime-local" value={toLocalInput(cd.end_at)} onChange={(e) => setCard({ ...card, countdown: { ...cd, end_at: fromLocalInput(e.target.value) } })} />
          </div>
          <div>
            <span className={label}>끝나면</span>
            <select className={input} value={cd.loop_minutes ? String(cd.loop_minutes) : ''} onChange={(e) => setCard({ ...card, countdown: { ...cd, loop_minutes: e.target.value ? Number(e.target.value) : null } })}>
              {LOOPS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="border border-gray-200 rounded-xl p-4 space-y-3">
        <label className="flex items-center gap-2 text-sm font-bold cursor-pointer">
          <input type="checkbox" checked={!!banner.enabled} onChange={(e) => setBanner({ ...banner, enabled: e.target.checked })} />
          상단 타이머 배너 켜기 (PC는 스크롤해도 위에 고정, 휴대폰은 맨 위에만)
        </label>
        <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-3">
          <div>
            <span className={label}>문구 ({'{n}'} 자리에 숫자가 들어감)</span>
            <input className={input} value={banner.template ?? ''} placeholder="오늘 남은 할인 수량: {n}개" onChange={(e) => setBanner({ ...banner, template: e.target.value })} />
          </div>
          <div>
            <span className={label}>숫자 ({'{n}'})</span>
            <input className={input} type="number" min={0} value={banner.number ?? ''} placeholder="22" onChange={(e) => setBanner({ ...banner, number: numOrNull(e.target.value) })} />
          </div>
          <div>
            <span className={label}>타이머 종료 (한국 시간, 비우면 타이머 없이 문구만)</span>
            <input className={input} type="datetime-local" value={toLocalInput(banner.end_at)} onChange={(e) => setBanner({ ...banner, end_at: fromLocalInput(e.target.value) })} />
          </div>
          <div>
            <span className={label}>끝나면</span>
            <select className={input} value={banner.loop_minutes ? String(banner.loop_minutes) : ''} onChange={(e) => setBanner({ ...banner, loop_minutes: e.target.value ? Number(e.target.value) : null })}>
              {LOOPS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </div>
          <div className="col-span-2 max-sm:col-span-1">
            <span className={label}>반복 없이 끝났을 때 보일 문구 (비우면 배너 숨김)</span>
            <input className={input} value={banner.end_text ?? ''} placeholder="오늘 할인이 마감됐어요" onChange={(e) => setBanner({ ...banner, end_text: e.target.value })} />
          </div>
        </div>
      </div>

      <button type="button" onClick={save} disabled={saving}
        className="px-5 py-2.5 rounded-lg bg-gray-900 text-white text-sm font-bold border-none cursor-pointer disabled:opacity-50">
        {saving ? '저장 중…' : '신청 카드·배너 저장'}
      </button>
    </div>
  )
}
