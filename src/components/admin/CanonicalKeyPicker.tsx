import { useEffect, useMemo, useRef, useState } from 'react'

export interface CanonicalOption {
  key: string
  label: string
  group: string
}

// 카테고리 그룹핑된 canonical 키 정의
// webhook-template-analyze 의 CANONICAL_KEYS 와 동기화
export const CANONICAL_GROUPS: CanonicalOption[] = [
  // 상품 정보
  { key: 'TITLE', label: '강의/전자책/쿠폰 제목', group: '상품' },
  { key: 'instructor_name', label: '강사 이름', group: '상품' },
  { key: 'course_url', label: '상품 페이지 URL', group: '상품' },
  { key: 'price', label: '가격', group: '상품' },
  // 사용자
  { key: 'user_name', label: '구매자 이름', group: '사용자' },
  { key: 'user_phone', label: '전화번호(하이픈)', group: '사용자' },
  { key: 'ITEM2_NOH', label: '전화번호(하이픈X)', group: '사용자' },
  { key: 'user_email', label: '이메일', group: '사용자' },
  // 일시
  { key: '강의일시', label: '전체 일시(날짜+시간)', group: '일시' },
  { key: 'SCHEDULED_DATE', label: '날짜(yyyy.mm.dd)', group: '일시' },
  { key: 'SCHEDULED_TIME', label: '시간(HH:mm)', group: '일시' },
  // 쿠폰
  { key: 'coupon_name', label: '쿠폰 이름', group: '쿠폰' },
  { key: 'coupon_value', label: '쿠폰 할인값', group: '쿠폰' },
  { key: 'expires_at', label: '만료일', group: '쿠폰' },
  // 포인트
  { key: 'point_amount', label: '포인트 충전 금액', group: '포인트' },
  { key: 'point_balance', label: '포인트 잔액', group: '포인트' },
  // 시스템
  { key: 'DBNO', label: '발송 고유번호', group: '시스템' },
]

interface Props {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  customOptions?: Array<{ key: string; description?: string }> // 사용자 정의 canonical
  accentColor?: 'green' | 'blue'
  /** 고정 URL/텍스트 입력 허용 여부 (slot 채움용). 기본 false */
  allowFreeInput?: boolean
}

export default function CanonicalKeyPicker({ value, onChange, placeholder, customOptions = [], accentColor = 'green', allowFreeInput = false }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)

  const allOptions = useMemo(() => {
    const base: CanonicalOption[] = [...CANONICAL_GROUPS]
    for (const c of customOptions) {
      base.push({ key: c.key, label: c.description || '사용자 정의', group: '사용자 정의 변수' })
    }
    return base
  }, [customOptions])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return allOptions
    return allOptions.filter((o) =>
      o.key.toLowerCase().includes(q)
      || o.label.toLowerCase().includes(q)
      || o.group.toLowerCase().includes(q),
    )
  }, [allOptions, query])

  const grouped = useMemo(() => {
    const map = new Map<string, CanonicalOption[]>()
    for (const o of filtered) {
      if (!map.has(o.group)) map.set(o.group, [])
      map.get(o.group)!.push(o)
    }
    return Array.from(map.entries())
  }, [filtered])

  // 바깥 클릭 닫기
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const focusRing = accentColor === 'blue' ? 'focus:border-[#2ED573]' : 'focus:border-[#2ED573]'
  const borderColor = accentColor === 'blue' ? 'border-blue-300' : 'border-gray-300'

  const selected = allOptions.find((o) => o.key === value)

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full border ${borderColor} rounded-lg px-2 py-1.5 text-xs outline-none ${focusRing} bg-white font-mono text-left flex items-center justify-between gap-1 cursor-pointer hover:border-gray-400`}
      >
        <span className={value ? 'text-gray-900' : 'text-gray-400'}>
          {value || placeholder || '선택'}
        </span>
        <i className={`ti ti-chevron-${open ? 'up' : 'down'} text-gray-400 shrink-0`} />
      </button>
      {selected && (
        <p className="text-[10px] text-gray-500 mt-1 truncate">→ {selected.label}</p>
      )}

      {open && (
        <div className="absolute z-[70] mt-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg max-h-[320px] overflow-hidden flex flex-col">
          <div className="p-2 border-b border-gray-100 flex items-center gap-2">
            <i className="ti ti-search text-gray-400 text-xs" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="변수명 · 설명 · 그룹 검색"
              className="flex-1 text-xs outline-none border-none bg-transparent"
            />
            {value && (
              <button
                type="button"
                onClick={() => { onChange(''); setOpen(false); setQuery('') }}
                className="text-[10px] text-gray-400 hover:text-red-500 bg-transparent border-none cursor-pointer"
              >
                <i className="ti ti-x" /> 해제
              </button>
            )}
          </div>

          <div className="overflow-y-auto flex-1">
            {allowFreeInput && query.trim() && !allOptions.some((o) => o.key === query.trim()) && (
              <button
                type="button"
                onClick={() => { onChange(query.trim()); setOpen(false); setQuery('') }}
                className="w-full text-left px-3 py-2 text-xs bg-amber-50 hover:bg-amber-100 border-b border-amber-100 border-l-0 border-r-0 border-t-0 cursor-pointer"
              >
                <i className="ti ti-plus text-amber-700 mr-1" />
                <code className="font-mono text-amber-900">{query.trim()}</code>
                <span className="text-[10px] text-amber-700 ml-2">고정값/URL 그대로 사용</span>
              </button>
            )}

            {grouped.length === 0 && (
              <div className="px-3 py-6 text-center text-xs text-gray-400">검색 결과 없음</div>
            )}

            {grouped.map(([group, items]) => (
              <div key={group}>
                <div className="sticky top-0 bg-gray-50 px-3 py-1 text-[10px] font-bold text-gray-500 border-b border-gray-100">
                  {group}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-0">
                  {items.map((o) => (
                    <button
                      key={o.key}
                      type="button"
                      onClick={() => { onChange(o.key); setOpen(false); setQuery('') }}
                      className={`text-left px-3 py-2 text-xs border-b border-gray-50 border-l-0 border-r-0 border-t-0 bg-white hover:bg-[#2ED573]/5 cursor-pointer ${value === o.key ? 'bg-[#2ED573]/10' : ''}`}
                    >
                      <code className="font-mono text-[11px] text-gray-900 block truncate">{o.key}</code>
                      <span className="text-[10px] text-gray-500 block truncate">{o.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
