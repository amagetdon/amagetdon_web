import { useCallback, useState } from 'react'
import TemplateLanding from '../TemplateLanding'
import LandingForm from './landingForm/LandingForm'
import AgentPanel from './landingForm/AgentPanel'
import type { LandingDoc, LandingReport } from '../../lib/landingTemplate'
import { isLandingDoc } from '../../lib/landingTemplate/guard'

// 템플릿 랜딩 자료 편집 — 왼쪽은 섹션별 입력 화면, 오른쪽은 휴대폰 폭 미리보기와 점검 결과.
// '직접 편집'은 자료 전체를 JSON 으로 보고 고치는 화면(옮겨 붙이기·점검용).
// 자료 형식: src/lib/landingTemplate/README.md, 입력 칸 구성: src/lib/landingTemplate/form.ts

const toText = (v: unknown) => (v == null ? '' : JSON.stringify(v, null, 2))

function JsonEditor({ value, onChange }: { value: unknown; onChange: (doc: unknown) => void }) {
  const [text, setText] = useState(() => toText(value))
  const [error, setError] = useState<string | null>(null)
  const handle = (next: string) => {
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
  return (
    <div className="space-y-2">
      <textarea value={text} onChange={(e) => handle(e.target.value)} spellCheck={false}
        placeholder='{ "version": 1, "type": "free", "facts": { ... }, "sections": { ... } }'
        className="w-full h-[520px] px-3 py-2 border border-gray-200 rounded-lg text-xs font-mono" />
      {error
        ? <p className="text-xs text-red-500">{error} (고치기 전까지는 마지막으로 올바르던 자료가 저장됩니다)</p>
        : <p className="text-xs text-gray-400">자료 전체입니다. 다른 강의의 자료를 붙여 넣어 시작할 수도 있습니다.</p>}
    </div>
  )
}

function ReportPanel({ report }: { report: LandingReport }) {
  const list = (title: string, items: string[], tone: string) => items.length > 0 && (
    <div>
      <p className={`text-xs font-bold mb-1 ${tone}`}>{title} ({items.length})</p>
      <ul className="text-xs text-gray-600 list-disc pl-4 space-y-0.5">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
    </div>
  )
  return (
    <div className="space-y-3 bg-gray-50 rounded-xl p-4">
      <p className="text-sm font-bold">점검 결과</p>
      {list('자료가 부족한 필수 섹션', report.lacking, 'text-red-500')}
      {list('검사에서 걸린 것', report.checks, 'text-amber-600')}
      {list('자료가 없어 뺀 선택 섹션', report.skipped, 'text-gray-500')}
      {list('사용한 섹션(순서대로)', report.used, 'text-[#1a9d54]')}
      {report.lacking.length + report.checks.length === 0 && <p className="text-xs text-gray-500">걸린 것이 없습니다.</p>}
    </div>
  )
}

export default function TemplateLandingEditor({ value, onChange, uploadPrefix, defaultTitle, courseId = null }: {
  value: unknown
  /** 올바른 자료일 때만 불린다 (잘못된 JSON 은 저장 대상에 반영되지 않음) */
  onChange: (doc: unknown) => void
  /** 그림을 올릴 저장 위치(강의별) */
  uploadPrefix: string
  /** 새로 시작할 때 강의명 칸에 미리 넣을 값 */
  defaultTitle?: string
  /** 저장된 강의의 번호 — 초안 만들기용 자료를 강의별로 보관할 때 쓴다 */
  courseId?: number | null
}) {
  const [mode, setMode] = useState<'form' | 'json'>('form')
  // 화면을 오갈 때 입력 화면·직접 편집을 새 자료로 다시 시작시키는 번호
  const [rev, setRev] = useState(0)
  const [report, setReport] = useState<LandingReport | null>(null)
  const handleReport = useCallback((r: LandingReport) => setReport(r), [])
  const valid = isLandingDoc(value)

  const start = (type: LandingDoc['type']) => {
    onChange({ version: 1, type, facts: defaultTitle ? { 강의명: defaultTitle } : {}, sections: {} } satisfies LandingDoc)
    setRev((n) => n + 1)
  }
  const switchMode = (next: 'form' | 'json') => { setMode(next); setRev((n) => n + 1) }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1">
        {([['form', '입력 화면'], ['json', '직접 편집']] as const).map(([m, text]) => (
          <button key={m} type="button" onClick={() => switchMode(m)}
            className={`px-3 py-1.5 rounded-lg text-sm border-none cursor-pointer ${mode === m ? 'bg-gray-900 text-white font-bold' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {text}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_400px] max-xl:grid-cols-1 gap-4 items-start">
        <div className="min-w-0">
          {mode === 'json' ? (
            <JsonEditor key={rev} value={value} onChange={onChange} />
          ) : valid ? (
            <div className="space-y-3">
              {/* 초안을 반영하면 입력 화면을 새 자료로 다시 연다 */}
              <AgentPanel doc={value} uploadPrefix={uploadPrefix} courseId={courseId} onApply={(next) => { onChange(next); setRev((n) => n + 1) }} />
              <LandingForm key={rev} value={value} onChange={onChange} uploadPrefix={uploadPrefix} />
            </div>
          ) : (
            <div className="border border-dashed border-gray-300 rounded-xl p-6 text-center space-y-3">
              <p className="text-sm text-gray-600">아직 랜딩 자료가 없습니다. 강의 종류를 골라 시작하세요.</p>
              <div className="flex justify-center gap-2">
                <button type="button" onClick={() => start('free')} className="px-4 py-2 rounded-xl text-sm bg-[#2ED573] text-white font-bold border-none cursor-pointer">무료 강의 랜딩 시작</button>
                <button type="button" onClick={() => start('paid')} className="px-4 py-2 rounded-xl text-sm bg-gray-900 text-white font-bold border-none cursor-pointer">유료 강의 랜딩 시작</button>
              </div>
            </div>
          )}
        </div>

        {valid && (
          <div className="space-y-3 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto">
            <p className="text-xs font-bold text-gray-500">미리보기 (휴대폰 폭)</p>
            <div className="border border-gray-200 rounded-xl overflow-hidden max-h-[640px] overflow-y-auto">
              <TemplateLanding doc={value} onReport={handleReport} onApply={() => {}} />
            </div>
            {report && <ReportPanel report={report} />}
          </div>
        )}
      </div>
    </div>
  )
}
