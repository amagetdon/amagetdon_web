import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import TemplateLanding from '../../components/TemplateLanding'
import TemplateLandingEditor from '../../components/admin/TemplateLandingEditor'
import type { LandingReport } from '../../lib/landingTemplate'
import { isLandingDoc } from '../../lib/landingTemplate/guard'

// 개발용(로컬 실행에서만 열림): 템플릿 랜딩을 강의 상세와 같은 배치(왼쪽 본문 + 오른쪽 신청 카드 자리)에 넣어 본다.
// 자료는 public/__fixtures/<이름>.json 에서 읽는다(저장소에 올리지 않는 폴더). 예: /__landing-preview?doc=free-115

export default function LandingPreviewPage() {
  const [params] = useSearchParams()
  const name = params.get('doc') || ''
  const validName = /^[\w-]+$/.test(name)
  const [doc, setDoc] = useState<unknown>(null)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<LandingReport | null>(null)

  useEffect(() => {
    if (!validName) return
    let cancelled = false
    fetch(`/__fixtures/${name}.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: unknown) => { if (!cancelled) { setDoc(d); setError(isLandingDoc(d) ? null : '랜딩 자료 형식이 아닙니다.') } })
      .catch((e: Error) => { if (!cancelled) setError(`자료를 읽지 못했습니다: ${e.message}`) })
    return () => { cancelled = true }
  }, [name, validName])

  // &edit=1 — 어드민 입력 화면을 같은 자료로 연다(저장은 되지 않음). doc 없이 edit=1 만 주면 빈 상태에서 시작.
  if (params.get('edit') === '1' && (doc !== null || !name)) {
    return (
      <section className="w-full bg-gray-50">
        <div className="max-w-[1300px] mx-auto px-5 py-8">
          <TemplateLandingEditor value={doc} onChange={setDoc} uploadPrefix="dev/landing-tpl" known={{ 강의명: "강의명 예시" }} />
        </div>
      </section>
    )
  }

  return (
    <section className="w-full bg-white">
      <div className="max-w-[1200px] mx-auto px-5 max-sm:px-4 py-8">
        <div className="grid grid-cols-[1fr_340px] gap-x-8 max-md:grid-cols-1 max-md:gap-y-6">
          <div className="min-w-0">
            {!validName && <p className="text-sm text-red-500">주소에 ?doc=자료이름 을 붙여 주세요.</p>}
            {error && <p className="text-sm text-red-500">{error}</p>}
            {isLandingDoc(doc) && (
              <div className="rounded-xl overflow-hidden">
                <TemplateLanding doc={doc} onReport={setReport} onApply={() => toast('신청 버튼 눌림')} />
              </div>
            )}
          </div>
          <aside className="max-md:hidden">
            <div className="sticky top-6 border border-gray-200 rounded-xl p-5 text-sm text-gray-500 space-y-2">
              <p className="font-bold text-gray-900">신청 카드 자리</p>
              {report && (
                <>
                  <p>사용한 섹션 {report.used.length}개 · 뺀 선택 섹션 {report.skipped.length}개</p>
                  <p>부족한 필수 섹션 {report.lacking.length}개 · 검사에서 걸린 것 {report.checks.length}개</p>
                </>
              )}
            </div>
          </aside>
        </div>
      </div>
    </section>
  )
}
