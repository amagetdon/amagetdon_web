import { useState } from 'react'
import FieldEditor from './FieldEditor'
import { isEmptyValue, isRec, setKey, type Rec } from './values'
import { LANDING_FORM } from '../../../lib/landingTemplate/form'
import type { FormSection } from '../../../lib/landingTemplate/formTypes'
import type { LandingDoc } from '../../../lib/landingTemplate'

// 템플릿 랜딩 자료를 섹션별 칸으로 입력하는 화면.
//  - 맨 위 '기본 정보'는 한 번만 적는 값(강의명·일정·대표 숫자). 다른 섹션이 이 값을 가져다 쓴다.
//  - 섹션은 표준 순서대로 나오고, 자료가 없는 선택 섹션은 비워 두면 랜딩에서 빠진다.
//  - 편집 중에는 빈 항목(방금 추가한 빈 칸)을 그대로 두고, 바깥으로 내보낼 때만 정리한다.

/** 내보낼 때 정리: 빈 글자·빈 항목·빈 묶음을 지운다. 섹션 자체({})는 켜 둔 표시일 수 있어 남긴다. */
function clean(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(clean).filter((x) => !isEmptyValue(x))
  if (isRec(value)) {
    const out: Rec = {}
    for (const [k, v] of Object.entries(value)) {
      const c = clean(v)
      if (!isEmptyValue(c)) out[k] = c
    }
    return out
  }
  return typeof value === 'string' ? value.replace(/\s+$/, '') : value
}

function cleanDoc(doc: LandingDoc): LandingDoc {
  const sections: Rec = {}
  for (const [k, v] of Object.entries(doc.sections)) sections[k] = isRec(v) ? clean(v) : v
  const theme = clean(doc.theme ?? {}) as LandingDoc['theme']
  return { ...doc, facts: clean(doc.facts) as Rec, sections, ...(isEmptyValue(theme) ? { theme: undefined } : { theme }) }
}

/** 섹션에 채워진 칸이 있는지 */
const hasContent = (v: unknown) => isRec(v) && !isEmptyValue(clean(v))

export default function LandingForm({ value, onChange, uploadPrefix }: {
  value: LandingDoc
  onChange: (doc: LandingDoc) => void
  uploadPrefix: string
}) {
  const [draft, setDraft] = useState<LandingDoc>(value)
  const [open, setOpen] = useState<Set<string>>(() => new Set(['__facts']))
  const spec = LANDING_FORM[draft.type]

  const apply = (next: LandingDoc) => { setDraft(next); onChange(cleanDoc(next)) }
  const toggleOpen = (key: string) => setOpen((prev) => { const s = new Set(prev); if (s.has(key)) s.delete(key); else s.add(key); return s })

  const setSection = (key: string, data: Rec, keepEmpty: boolean) => {
    const sections = { ...draft.sections }
    if (isEmptyValue(data) && !keepEmpty) delete sections[key]
    else sections[key] = data
    apply({ ...draft, sections })
  }

  const sectionCard = (s: FormSection) => {
    const present = s.key in draft.sections
    const data = isRec(draft.sections[s.key]) ? (draft.sections[s.key] as Rec) : {}
    const filled = hasContent(data)
    const isOpen = open.has(s.key)
    // 상태 표시: 채움 / 켜 둠(칸 없이 들어가는 섹션) / 비어 있음
    const state = filled ? '채움' : s.factsOnly || (s.toggle && present) ? '자동' : s.required ? '필수 · 비어 있음' : '비어 있음'
    const stateCls = filled ? 'bg-[#2ED573]/15 text-[#1a9d54]' : state === '자동' ? 'bg-gray-100 text-gray-500' : s.required ? 'bg-red-50 text-red-500' : 'bg-gray-100 text-gray-400'
    return (
      <div key={s.key} className="border border-gray-200 rounded-xl bg-white overflow-hidden">
        <button type="button" onClick={() => toggleOpen(s.key)} className="w-full flex items-center gap-3 px-4 py-3 bg-transparent border-none cursor-pointer text-left">
          <i className={`ti ${isOpen ? 'ti-chevron-down' : 'ti-chevron-right'} text-xs text-gray-400`} />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-gray-900">
              {s.block != null && <span className="text-gray-400 mr-1.5">{s.block}.</span>}{s.name}
              {!s.required && <span className="ml-1.5 text-xs font-medium text-gray-400">선택</span>}
            </span>
            <span className="block text-xs text-gray-400 truncate">{s.role}</span>
          </span>
          <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${stateCls}`}>{state}</span>
        </button>
        {isOpen && (
          <div className="px-4 pb-4 pt-1 space-y-4 border-t border-gray-100">
            {s.note && <p className="text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2 whitespace-pre-line">{s.note}</p>}
            {s.toggle && (
              <label className="flex items-center gap-2 text-sm font-bold text-gray-800 cursor-pointer">
                <input type="checkbox" checked={present} onChange={(e) => {
                  const sections = { ...draft.sections }
                  if (e.target.checked) sections[s.key] = data
                  else delete sections[s.key]
                  apply({ ...draft, sections })
                }} />
                이 섹션 넣기
              </label>
            )}
            {s.fields.length === 0 && <p className="text-xs text-gray-400">따로 적을 칸이 없습니다. 기본 정보의 값으로 만들어집니다.</p>}
            {s.fields.map((f) => (
              <FieldEditor key={f.key} field={f} value={data[f.key]} uploadPrefix={uploadPrefix}
                onChange={(v) => setSection(s.key, setKey(data, f.key, v), !!s.toggle && present)} />
            ))}
          </div>
        )}
      </div>
    )
  }

  const factsOpen = open.has('__facts')
  const theme = (draft.theme ?? {}) as Rec
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-bold text-gray-800">강의 종류</span>
        {([['free', '무료 강의'], ['paid', '유료 강의']] as const).map(([type, text]) => (
          <button key={type} type="button"
            onClick={() => {
              if (type === draft.type) return
              if (Object.keys(draft.sections).length && !confirm('강의 종류를 바꾸면 섹션 구성이 달라집니다. 기본 정보는 남고, 맞지 않는 섹션 자료는 랜딩에 쓰이지 않습니다. 바꿀까요?')) return
              apply({ ...draft, type })
            }}
            className={`px-3 py-1.5 rounded-lg text-sm border-none cursor-pointer ${draft.type === type ? 'bg-gray-900 text-white font-bold' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {text}
          </button>
        ))}
      </div>

      <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
        <button type="button" onClick={() => toggleOpen('__facts')} className="w-full flex items-center gap-3 px-4 py-3 bg-transparent border-none cursor-pointer text-left">
          <i className={`ti ${factsOpen ? 'ti-chevron-down' : 'ti-chevron-right'} text-xs text-gray-400`} />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-gray-900">기본 정보</span>
            <span className="block text-xs text-gray-400">강의명·일정·대표 숫자처럼 한 번만 적는 값입니다. 모든 섹션이 이 값을 가져다 씁니다.</span>
          </span>
        </button>
        {factsOpen && (
          <div className="px-4 pb-4 pt-1 space-y-4 border-t border-gray-100">
            {spec.facts.map((f) => (
              <FieldEditor key={f.key} field={f} value={draft.facts[f.key]} uploadPrefix={uploadPrefix}
                onChange={(v) => apply({ ...draft, facts: setKey(draft.facts, f.key, v) })} />
            ))}
            <ExtraFacts facts={draft.facts} known={spec.facts.map((f) => f.key)} onChange={(facts) => apply({ ...draft, facts })} />
            <div className="pt-3 border-t border-gray-100 space-y-4">
              <p className="text-xs font-bold text-gray-500">색·바탕</p>
              {LANDING_FORM.theme.map((f) => (
                <FieldEditor key={f.key} field={f} value={theme[f.key]} uploadPrefix={uploadPrefix}
                  onChange={(v) => apply({ ...draft, theme: setKey(theme, f.key, v) as LandingDoc['theme'] })} />
              ))}
            </div>
          </div>
        )}
      </div>

      {spec.sections.map(sectionCard)}
    </div>
  )
}

/** 직접 이름을 붙여 쓰는 값 — 정해진 칸에 없는 기본 정보(글·숫자). 글 안에서 {이름} 으로 불러 쓴다. */
function ExtraFacts({ facts, known, onChange }: { facts: Rec; known: string[]; onChange: (facts: Rec) => void }) {
  const extras = Object.entries(facts).filter(([k, v]) => !known.includes(k) && (typeof v === 'string' || typeof v === 'number'))
  const inputCls = 'px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white'
  const rename = (from: string, to: string) => {
    // 비거나 이미 있는 이름은 받지 않는다 (다른 값을 덮어쓰지 않게)
    if (!to || to === from || to in facts) return
    const next: Rec = {}
    for (const [k, v] of Object.entries(facts)) next[k === from ? to : k] = v
    onChange(next)
  }
  const add = () => {
    let n = 1
    while (`값${n}` in facts) n++
    onChange({ ...facts, [`값${n}`]: '' })
  }
  return (
    <div>
      <p className="text-sm font-bold text-gray-800 mb-1">직접 이름 붙여 쓰는 값</p>
      <div className="space-y-2">
        {extras.map(([name, v]) => (
          <div key={name} className="flex items-center gap-2">
            <input defaultValue={name} onBlur={(e) => rename(name, e.target.value.trim())} className={`${inputCls} w-[160px]`} aria-label="이름" />
            <input value={String(v)} onChange={(e) => onChange({ ...facts, [name]: e.target.value })} className={`${inputCls} flex-1 min-w-0`} aria-label="값" />
            <button type="button" onClick={() => { const next = { ...facts }; delete next[name]; onChange(next) }}
              className="w-7 h-7 shrink-0 rounded-md border border-gray-200 bg-white text-red-500 text-xs cursor-pointer" aria-label="지우기">✕</button>
          </div>
        ))}
        <button type="button" onClick={add} className="px-3 py-1.5 rounded-lg border border-dashed border-gray-300 bg-white text-sm text-gray-600 cursor-pointer hover:bg-gray-50">+ 값 추가</button>
      </div>
      <p className="text-xs text-gray-400 mt-1">여러 섹션에서 반복해 쓰는 글·숫자를 이름과 함께 한 번만 적어 두고, 글 안에서 {'{이름}'} 으로 불러 씁니다. 예: 이름 "모집인원", 값 "30명" → 글에 {'{모집인원}'}</p>
    </div>
  )
}
