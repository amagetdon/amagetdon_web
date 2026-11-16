import { useState, type ReactNode } from 'react'
import ImageUploader from '../ImageUploader'
import type { FormField } from '../../../lib/landingTemplate/formTypes'
import { isEmptyValue, isRec, setKey, type Rec } from './values'

// 템플릿 랜딩 입력 화면의 칸 하나. 명세(FormField)의 kind 에 따라 입력 방식을 고르고, 묶음·목록은 안쪽 칸을 다시 그린다.
// 값이 비면 onChange(undefined) 를 불러 자료에서 그 키를 지운다(빈 글자·빈 목록이 자료에 남지 않게).

const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white'
const miniBtn = 'w-7 h-7 shrink-0 rounded-md border border-gray-200 bg-white text-gray-500 text-xs cursor-pointer hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed'
const addBtn = 'px-3 py-1.5 rounded-lg border border-dashed border-gray-300 bg-white text-sm text-gray-600 cursor-pointer hover:bg-gray-50'

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list
  const next = list.slice()
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

function RowTools({ index, count, onMove, onRemove }: { index: number; count: number; onMove: (to: number) => void; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-1">
      <button type="button" className={miniBtn} disabled={index === 0} onClick={() => onMove(index - 1)} aria-label="위로">↑</button>
      <button type="button" className={miniBtn} disabled={index === count - 1} onClick={() => onMove(index + 1)} aria-label="아래로">↓</button>
      <button type="button" className={`${miniBtn} text-red-500`} onClick={onRemove} aria-label="지우기">✕</button>
    </div>
  )
}

function Labeled({ field, children }: { field: FormField; children: ReactNode }) {
  return (
    <div>
      <p className="text-sm font-bold text-gray-800 mb-1">
        {field.label}
        {field.required && <span className="ml-1 text-xs font-medium text-red-500">필수</span>}
      </p>
      {children}
      {field.hint && <p className="text-xs text-gray-400 mt-1 whitespace-pre-line">{field.hint}</p>}
    </div>
  )
}

/** 그림 1장 — 올리거나 주소를 직접 적는다. 올릴 때마다 새 파일 이름을 써서 다른 곳에서 쓰는 그림을 덮어쓰지 않는다. */
function ImageInput({ value, onChange, uploadPrefix }: { value: unknown; onChange: (v: unknown) => void; uploadPrefix: string }) {
  const [token, setToken] = useState(() => crypto.randomUUID().slice(0, 8))
  const url = typeof value === 'string' ? value : ''
  // 주소를 손으로 적을 때는 다 적고 칸을 벗어날 때(또는 Enter) 반영한다 — 한 글자마다 그림을 불러오지 않게
  const [typed, setTyped] = useState<string | null>(null)
  const commit = () => {
    if (typed == null) return
    const next = typed.trim()
    setTyped(null)
    if (next !== url) onChange(next || undefined)
  }
  return (
    <div className="flex items-start gap-3">
      <ImageUploader
        bucket="courses"
        path={`${uploadPrefix}/${token}`}
        currentUrl={url || null}
        onUpload={(next) => { onChange(next); setToken(crypto.randomUUID().slice(0, 8)) }}
        className="w-[120px] h-[120px] shrink-0"
        objectFit="contain"
        compress={false}
      />
      <div className="flex-1 min-w-0 space-y-1">
        <input value={typed ?? url} onChange={(e) => setTyped(e.target.value)} onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit() } }}
          placeholder="그림을 올리거나 주소(https://…)를 붙여 넣기" className={inputCls} />
        {url && <button type="button" onClick={() => onChange(undefined)} className="text-xs text-red-500 bg-transparent border-none p-0 cursor-pointer">그림 빼기</button>}
      </div>
    </div>
  )
}

export default function FieldEditor({ field, value, onChange, uploadPrefix }: {
  field: FormField
  value: unknown
  onChange: (value: unknown) => void
  /** 그림을 올릴 저장 위치(강의별) */
  uploadPrefix: string
}) {
  const text = typeof value === 'string' ? value : value == null ? '' : String(value)

  switch (field.kind) {
    case 'text':
    case 'link':
      return <Labeled field={field}><input value={text} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} className={inputCls} /></Labeled>
    case 'longtext':
      return (
        <Labeled field={field}>
          <textarea value={text} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder}
            rows={Math.min(8, Math.max(2, text.split('\n').length + 1))} className={`${inputCls} resize-y`} />
        </Labeled>
      )
    case 'date':
      return <Labeled field={field}><input type="date" value={text} onChange={(e) => onChange(e.target.value)} className={`${inputCls} max-w-[200px]`} /></Labeled>
    case 'time':
      return <Labeled field={field}><input type="time" value={text} onChange={(e) => onChange(e.target.value)} className={`${inputCls} max-w-[160px]`} /></Labeled>
    case 'color':
      return (
        <Labeled field={field}>
          <div className="flex items-center gap-2">
            <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(text) ? text : '#2b33e6'} onChange={(e) => onChange(e.target.value)} className="w-10 h-10 p-0 border border-gray-200 rounded-lg bg-white cursor-pointer" />
            <input value={text} onChange={(e) => onChange(e.target.value.trim())} placeholder="#RRGGBB" className={`${inputCls} max-w-[140px]`} />
            {text && <button type="button" onClick={() => onChange(undefined)} className="text-xs text-gray-400 bg-transparent border-none p-0 cursor-pointer">기본값으로</button>}
          </div>
        </Labeled>
      )
    case 'flag':
      return (
        <div>
          <label className="flex items-center gap-2 text-sm font-bold text-gray-800 cursor-pointer">
            <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked ? true : undefined)} />
            {field.label}
          </label>
          {field.hint && <p className="text-xs text-gray-400 mt-1">{field.hint}</p>}
        </div>
      )
    case 'select':
      return (
        <Labeled field={field}>
          <select value={text} onChange={(e) => onChange(e.target.value)} className={`${inputCls} max-w-[240px]`}>
            <option value="">고르지 않음</option>
            {field.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Labeled>
      )
    case 'image':
      return <Labeled field={field}><ImageInput value={value} onChange={onChange} uploadPrefix={uploadPrefix} /></Labeled>

    case 'strings': {
      const list = Array.isArray(value) ? value.map((x) => (typeof x === 'string' ? x : '')) : []
      const update = (next: string[]) => onChange(next.length ? next : undefined)
      const full = field.max != null && list.length >= field.max
      return (
        <Labeled field={field}>
          <div className="space-y-2">
            {list.map((item, i) => (
              <div key={i} className="flex items-start gap-2">
                {field.long
                  ? <textarea value={item} rows={2} onChange={(e) => update(list.map((x, j) => (j === i ? e.target.value : x)))} className={`${inputCls} resize-y`} />
                  : <input value={item} onChange={(e) => update(list.map((x, j) => (j === i ? e.target.value : x)))} className={inputCls} />}
                <RowTools index={i} count={list.length} onMove={(to) => update(move(list, i, to))} onRemove={() => update(list.filter((_, j) => j !== i))} />
              </div>
            ))}
            <button type="button" className={addBtn} disabled={full} onClick={() => update([...list, ''])}>+ {field.itemLabel ?? '항목'} 추가</button>
          </div>
        </Labeled>
      )
    }

    case 'images': {
      const list = Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string') : []
      const update = (next: string[]) => onChange(next.length ? next : undefined)
      const full = field.max != null && list.length >= field.max
      return (
        <Labeled field={field}>
          <div className="space-y-3">
            {list.map((item, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="flex-1 min-w-0"><ImageInput value={item} uploadPrefix={uploadPrefix} onChange={(v) => update(typeof v === 'string' && v ? list.map((x, j) => (j === i ? v : x)) : list.filter((_, j) => j !== i))} /></div>
                <RowTools index={i} count={list.length} onMove={(to) => update(move(list, i, to))} onRemove={() => update(list.filter((_, j) => j !== i))} />
              </div>
            ))}
            {!full && <NewImage key={list.length} uploadPrefix={uploadPrefix} onAdd={(url) => update([...list, url])} />}
          </div>
        </Labeled>
      )
    }

    case 'group': {
      const obj = isRec(value) ? value : {}
      return (
        <Labeled field={field}>
          <div className="border border-gray-200 rounded-xl p-3 space-y-4 bg-gray-50/60">
            {field.fields.map((f) => (
              <FieldEditor key={f.key} field={f} value={obj[f.key]} uploadPrefix={uploadPrefix} onChange={(v) => { const next = setKey(obj, f.key, v); onChange(isEmptyValue(next) ? undefined : next) }} />
            ))}
          </div>
        </Labeled>
      )
    }

    case 'items': {
      // 저장된 항목이 글자 하나면 첫 칸의 값으로 본다
      const first = field.fields[0]?.key
      const list: Rec[] = Array.isArray(value) ? value.map((x) => (isRec(x) ? x : first && typeof x === 'string' ? { [first]: x } : {})) : []
      const update = (next: Rec[]) => onChange(next.length ? next : undefined)
      const full = field.max != null && list.length >= field.max
      return (
        <Labeled field={field}>
          <div className="space-y-3">
            {list.map((item, i) => (
              <div key={i} className="border border-gray-200 rounded-xl bg-white">
                <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-100">
                  <p className="text-xs font-bold text-gray-500">{field.itemLabel} {i + 1}</p>
                  <RowTools index={i} count={list.length} onMove={(to) => update(move(list, i, to))} onRemove={() => update(list.filter((_, j) => j !== i))} />
                </div>
                <div className="p-3 space-y-4">
                  {field.fields.map((f) => (
                    <FieldEditor key={f.key} field={f} value={item[f.key]} uploadPrefix={uploadPrefix} onChange={(v) => update(list.map((x, j) => (j === i ? setKey(x, f.key, v) : x)))} />
                  ))}
                </div>
              </div>
            ))}
            <button type="button" className={addBtn} disabled={full} onClick={() => update([...list, {}])}>+ {field.itemLabel} 추가</button>
          </div>
        </Labeled>
      )
    }

    case 'keyed': {
      // 키가 이름인 묶음 — 화면에서는 [이름, 내용] 목록으로 다룬다. 이름이 비거나 겹치면 저장 때 뒤의 것이 남으므로 화면에 알린다.
      const entries: [string, Rec][] = isRec(value) ? Object.entries(value).map(([k, v]) => [k, isRec(v) ? v : {}]) : []
      const update = (next: [string, Rec][]) => onChange(next.length ? Object.fromEntries(next) : undefined)
      const freeName = () => { let n = entries.length + 1; while (entries.some(([k]) => k === String(n))) n++; return String(n) }
      return (
        <Labeled field={field}>
          <div className="space-y-3">
            {entries.map(([name, item], i) => (
              <div key={i} className="border border-gray-200 rounded-xl bg-white">
                <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-100">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-bold text-gray-500 whitespace-nowrap">{field.keyLabel}</span>
                    <input value={name} onChange={(e) => {
                      const nextName = e.target.value
                      if (!nextName || entries.some(([k], j) => j !== i && k === nextName)) return // 비거나 겹치는 이름은 받지 않는다
                      update(entries.map((x, j) => (j === i ? [nextName, x[1]] : x)))
                    }} className={`${inputCls} max-w-[220px] py-1`} />
                  </div>
                  <button type="button" className={`${miniBtn} text-red-500`} onClick={() => update(entries.filter((_, j) => j !== i))} aria-label="지우기">✕</button>
                </div>
                <div className="p-3 space-y-4">
                  {field.fields.map((f) => (
                    <FieldEditor key={f.key} field={f} value={item[f.key]} uploadPrefix={uploadPrefix} onChange={(v) => update(entries.map((x, j) => (j === i ? [x[0], setKey(x[1], f.key, v)] : x)))} />
                  ))}
                </div>
              </div>
            ))}
            <button type="button" className={addBtn} onClick={() => update([...entries, [freeName(), {}]])}>+ {field.itemLabel} 추가</button>
          </div>
        </Labeled>
      )
    }
  }
}

/** 그림 목록 끝의 '새 그림' 칸 — 올리면 목록에 더해지고 칸은 새로 만들어진다 */
function NewImage({ uploadPrefix, onAdd }: { uploadPrefix: string; onAdd: (url: string) => void }) {
  return <ImageInput value="" uploadPrefix={uploadPrefix} onChange={(v) => { if (typeof v === 'string' && v) onAdd(v) }} />
}
