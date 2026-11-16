import { useCallback, useState } from 'react'
import TemplateLanding from '../TemplateLanding'
import type { LandingReport } from '../../lib/landingTemplate'
import { isLandingDoc } from '../../lib/landingTemplate/guard'

// 템플릿 랜딩 자료 편집 (1단계: 자료를 JSON 으로 직접 넣고 미리보기·점검 결과 확인).
// 섹션별 입력 화면과 자동 제작은 다음 단계에서 이 자리에 들어온다. 자료 형식: src/lib/landingTemplate/README.md

const toText = (v: unknown) => (v == null ? '' : JSON.stringify(v, null, 2))

export default function TemplateLandingEditor({ value, onChange }: {
  value: unknown
  /** 올바른 자료일 때만 불린다 (잘못된 JSON 은 저장 대상에 반영되지 않음) */
  onChange: (doc: unknown) => void
}) {
  const [text, setText] = useState(() => toText(value))
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState(false)
  const [report, setReport] = useState<LandingReport | null>(null)
  const valid = isLandingDoc(value)

  const handleText = (next: string) => {
    setText(next)
    if (!next.trim()) { setError(null); onChange(null); return }
    try {
      const parsed: unknown = JSON.parse(next)
      if (!isLandingDoc(parsed)) { setError('형식이 맞지 않습니다. version·type(free 또는 paid)·facts·sections 가 있어야 합니다.'); return }
      setError(null)
      onChange(parsed)
    } catch (e) {
      setError(`JSON 을 읽을 수 없습니다: ${(e as Error).message}`)
    }
  }

  const handleReport = useCallback((r: LandingReport) => setReport(r), [])

  const list = (title: string, items: string[], tone: string) => items.length > 0 && (
    <div>
      <p className={`text-xs font-bold mb-1 ${tone}`}>{title} ({items.length})</p>
      <ul className="text-xs text-gray-600 list-disc pl-4 space-y-0.5">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
    </div>
  )

  return (
    <div className="space-y-3">
      <textarea
        value={text}
        onChange={(e) => handleText(e.target.value)}
        spellCheck={false}
        placeholder='{ "version": 1, "type": "free", "facts": { ... }, "sections": { ... } }'
        className="w-full h-[260px] px-3 py-2 border border-gray-200 rounded-lg text-xs font-mono"
      />
      {error
        ? <p className="text-xs text-red-500">{error} (고치기 전까지는 마지막으로 올바르던 자료가 저장됩니다)</p>
        : <p className="text-xs text-gray-400">랜딩 자료(JSON)입니다. 날짜·강의명 같은 값은 facts 에 한 번만 적고, 이미지는 올린 주소(https)로 적습니다.</p>}

      <button type="button" onClick={() => setPreview((v) => !v)} disabled={!valid}
        className="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium cursor-pointer hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
        {preview ? '미리보기 닫기' : '미리보기·점검 결과'}
      </button>

      {preview && valid && (
        <div className="grid grid-cols-[minmax(0,420px)_1fr] max-lg:grid-cols-1 gap-4 items-start">
          <div className="border border-gray-200 rounded-xl overflow-hidden max-h-[720px] overflow-y-auto">
            <TemplateLanding doc={value} onReport={handleReport} onApply={() => {}} />
          </div>
          {report && (
            <div className="space-y-3 bg-gray-50 rounded-xl p-4">
              <p className="text-sm font-bold">점검 결과</p>
              {list('자료가 부족한 필수 섹션', report.lacking, 'text-red-500')}
              {list('검사에서 걸린 것', report.checks, 'text-amber-600')}
              {list('자료가 없어 뺀 선택 섹션', report.skipped, 'text-gray-500')}
              {list('사용한 섹션(순서대로)', report.used, 'text-[#2ED573]')}
              {report.lacking.length + report.checks.length === 0 && <p className="text-xs text-gray-500">걸린 것이 없습니다.</p>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
