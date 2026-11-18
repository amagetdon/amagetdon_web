import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { storageService } from '../../../services/storageService'
import { landingAgentService, type AgentUsage, type LibraryImage } from '../../../services/landingAgentService'
import { isSupportedRef, prepareRefs } from './prepareRefs'
import { collectImageUrls, describeSpec, fillBlanks, mergeResult, sanitizeResult, type CleanResult } from '../../../lib/landingTemplate/agent'
import { LANDING_FORM } from '../../../lib/landingTemplate/form'
import type { LandingDoc } from '../../../lib/landingTemplate'

// '자료로 초안 만들기' — 강의 자료를 넣으면 AI 가 섹션별 문구 초안을 만든다.
//  · 자료 넣기: 기획서·교안·만들어 둔 상세페이지 그림을 한꺼번에 넣는다(그림·PDF·글 파일). 읽기만 하고 보관하지 않는다.
//  · 랜딩에 쓸 그림: 랜딩에 실제로 들어갈 그림(가릴 곳은 미리 가린 것). 저장되고, AI 가 맞는 칸에 넣는다.
//  · 자료 메모: 파일로 없는 내용을 덧붙일 때만 적는다.
// 결과는 바로 게시되지 않는다 — 입력 화면에 채워지고, 사람이 고친 뒤 저장한다. 직전 상태로 되돌릴 수 있다.

const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white'

export default function AgentPanel({ doc, onApply, uploadPrefix, courseId, known }: {
  doc: LandingDoc
  /** 초안을 자료에 반영(또는 되돌리기)할 때 불린다 */
  onApply: (doc: LandingDoc) => void
  uploadPrefix: string
  /** 저장된 강의면 자료 메모·그림 목록을 강의별로 보관한다 */
  courseId: number | null
  /** 강의 등록 칸에 이미 적은 값(강의명·강사명·라이브 일시). 기본 정보의 빈칸을 이 값으로 채워서 보낸다 */
  known?: Record<string, unknown>
}) {
  // 아직 아무 섹션도 채우지 않았으면 이 칸부터 보이게 연다
  const [open, setOpen] = useState(() => Object.keys(doc.sections).length === 0)
  const [dragging, setDragging] = useState(false)
  const [notes, setNotes] = useState('')
  const [library, setLibrary] = useState<LibraryImage[]>([])
  const [refs, setRefs] = useState<File[]>([])
  const [instruction, setInstruction] = useState('')
  const [scope, setScope] = useState('')
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState('')
  const [uploading, setUploading] = useState(false)
  const [outcome, setOutcome] = useState<{ clean: CleanResult; usage: AgentUsage | null; scope: string; warnings: string[] } | null>(null)
  const [previous, setPrevious] = useState<LandingDoc | null>(null)
  const loaded = useRef(false)

  // 보관해 둔 자료 불러오기 (강의당 한 번)
  useEffect(() => {
    if (!open || loaded.current || courseId == null) return
    loaded.current = true
    landingAgentService.loadMaterials(courseId).then((m) => {
      if (!m) return
      setNotes((cur) => cur || m.notes)
      setLibrary((cur) => (cur.length ? cur : m.images))
    })
  }, [open, courseId])

  const sections = LANDING_FORM[doc.type].sections

  const addLibrary = async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true)
    try {
      const added: LibraryImage[] = []
      for (const file of Array.from(files)) {
        const url = await storageService.uploadImage('courses', `${uploadPrefix}/library`, file, { compress: false })
        added.push({ label: file.name.replace(/\.[^.]+$/, ''), url })
      }
      setLibrary((cur) => [...cur, ...added])
    } catch (e) {
      toast.error(`그림 올리기 실패: ${(e as Error).message}`)
    } finally {
      setUploading(false)
    }
  }

  const addRefs = (files: File[]) => {
    const ok = files.filter(isSupportedRef)
    const bad = files.filter((f) => !isSupportedRef(f))
    if (bad.length) toast.error(`읽을 수 없는 형식이라 뺐습니다: ${bad.map((f) => f.name).join(', ')}. PPT·워드·한글은 PDF 로 저장해서 넣어 주세요.`)
    if (ok.length) setRefs((cur) => [...cur, ...ok])
  }

  const run = async () => {
    if (!notes.trim() && !library.length && !refs.length) return toast.error("자료를 하나 이상 넣어 주세요. 기획서나 교안 파일을 끌어다 놓으면 됩니다.")
    const scopeSection = sections.find((s) => s.key === scope)
    const hasContent = scopeSection ? scopeSection.key in doc.sections : Object.keys(doc.sections).length > 0
    if (hasContent && !confirm(scopeSection
      ? `"${scopeSection.name}" 섹션의 글을 새 초안으로 바꿉니다. 직접 고친 글이 있으면 덮어써집니다(되돌리기 가능). 계속할까요?`
      : '이미 채운 섹션의 글이 새 초안으로 바뀝니다. 직접 고친 글이 있으면 덮어써집니다(되돌리기 가능). 계속할까요?')) return

    setRunning(true)
    setOutcome(null)
    setProgress('자료를 준비하고 있습니다…')
    try {
      // 그림·PDF 는 파일 하나씩 올려 두고(합계 크기 제한 없음), 글 파일은 글만 꺼낸다. 올린 것은 초안을 만든 뒤 서버가 지운다.
      const prepared = await prepareRefs(refs, setProgress)
      if (courseId != null) void landingAgentService.saveMaterials(courseId, notes, library)
      // 강의 등록 칸에 이미 적은 값으로 기본 정보의 빈칸을 채운다(같은 값을 두 번 적지 않게)
      const base = fillBlanks(doc, known)

      const { result, usage } = await landingAgentService.generate({
        type: doc.type,
        spec: describeSpec(doc.type),
        facts: base.facts,
        sections: doc.sections,
        notes,
        library,
        refs: prepared.refs,
        texts: prepared.texts,
        scope: scopeSection ? `섹션 "${scopeSection.key}"(${scopeSection.name}) 만. 기본 정보는 바꾸지 않습니다.` : '',
        instruction,
      }, setProgress)

      // 그림 칸에는 '랜딩에 쓸 그림'과 이미 랜딩에 들어 있는 그림만 허용
      const allowed = collectImageUrls(doc)
      library.forEach((x) => allowed.add(x.url))
      const clean = sanitizeResult(doc.type, result, allowed)
      setPrevious(doc)
      onApply(mergeResult(base, clean, scopeSection?.key ?? null))
      setOutcome({ clean, usage, scope: scopeSection?.name ?? '전체', warnings: prepared.warnings })
      toast.success('초안을 입력 화면에 채웠습니다. 미리보기와 점검 결과를 확인해 주세요.')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setRunning(false)
      setProgress('')
    }
  }

  const undo = () => {
    if (!previous) return
    onApply(previous)
    setPrevious(null)
    setOutcome(null)
    toast('초안을 만들기 전 상태로 되돌렸습니다.')
  }

  const list = (title: string, items: string[], tone: string) => items.length > 0 && (
    <div>
      <p className={`text-xs font-bold mb-1 ${tone}`}>{title} ({items.length})</p>
      <ul className="text-xs text-gray-600 list-disc pl-4 space-y-0.5">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
    </div>
  )

  return (
    <div className="border border-[#2ED573]/40 rounded-xl bg-[#2ED573]/5 overflow-hidden">
      <button type="button" onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-3 px-4 py-3 bg-transparent border-none cursor-pointer text-left">
        <i className={`ti ${open ? 'ti-chevron-down' : 'ti-chevron-right'} text-xs text-gray-400`} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-gray-900">자료로 초안 만들기</span>
          <span className="block text-xs text-gray-500">강의 자료를 넣으면 AI 가 섹션별 글 초안을 채웁니다. 자료에 있는 내용만 쓰고, 부족한 자료는 알려 줍니다.</span>
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 space-y-4 border-t border-[#2ED573]/20">
          <div>
            <p className="text-sm font-bold text-gray-800 mb-1">자료 넣기 <span className="font-normal text-gray-400">— 가진 자료를 통째로 넣으면 됩니다</span></p>
            <label
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); addRefs(Array.from(e.dataTransfer.files)) }}
              className={`block px-4 py-6 rounded-xl border-2 border-dashed text-center cursor-pointer transition-colors ${dragging ? 'border-[#2ED573] bg-[#2ED573]/10' : 'border-gray-300 bg-white hover:bg-gray-50'}`}>
              <span className="block text-sm font-bold text-gray-700">파일을 여기로 끌어다 놓거나 눌러서 고르기</span>
              <span className="block text-xs text-gray-500 mt-1">기획서, 교안, 강사 원고, 이미 만들어 둔 상세페이지 그림 — 그림·PDF·글 파일(txt·md·html), 여러 개를 한꺼번에</span>
              <input type="file" accept="image/*,application/pdf,text/*,.txt,.md,.markdown,.html,.htm,.csv,.json" multiple hidden
                onChange={(e) => { addRefs(Array.from(e.target.files ?? [])); e.target.value = '' }} />
            </label>
            {refs.length > 0 && (
              <div className="mt-2 space-y-1">
                {refs.map((f, i) => (
                  <div key={`${f.name}-${i}`} className="flex items-center gap-2 text-xs text-gray-600">
                    <span className="truncate">{f.name} · {(f.size / 1_000_000).toFixed(1)}MB</span>
                    <button type="button" onClick={() => setRefs((cur) => cur.filter((_, j) => j !== i))} className="text-red-500 bg-transparent border-none p-0 cursor-pointer shrink-0">빼기</button>
                  </div>
                ))}
                <button type="button" onClick={() => setRefs([])} className="text-xs text-gray-400 bg-transparent border-none p-0 cursor-pointer underline">모두 빼기</button>
              </div>
            )}
            <p className="text-xs text-gray-400 mt-1">AI 가 읽기만 하는 자료입니다. 랜딩에 그대로 들어가지 않고 보관하지도 않습니다(초안을 만드는 동안만 AI 에 전달하고 끝나면 지웁니다). 크기 제한 없이 넣어도 됩니다 — 세로로 긴 그림은 잘라서, 큰 PDF 는 글과 앞쪽 40쪽 그림으로 읽습니다. PPT·워드·한글은 PDF 로 저장해서 넣어 주세요.</p>
          </div>

          <div>
            <p className="text-sm font-bold text-gray-800 mb-1">랜딩에 쓸 그림</p>
            <div className="space-y-2">
              {library.map((img, i) => (
                <div key={img.url} className="flex items-center gap-2">
                  <img src={img.url} alt="" className="w-12 h-12 rounded-md object-cover border border-gray-200 bg-white shrink-0" />
                  <input value={img.label} onChange={(e) => setLibrary((cur) => cur.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                    placeholder="이 그림이 무엇인지 (예: 강사 사진, 과세표준증명 2026 상반기)" className={inputCls} />
                  <button type="button" onClick={() => setLibrary((cur) => cur.filter((_, j) => j !== i))}
                    className="w-7 h-7 shrink-0 rounded-md border border-gray-200 bg-white text-red-500 text-xs cursor-pointer" aria-label="빼기">✕</button>
                </div>
              ))}
              <label className={`inline-block px-3 py-1.5 rounded-lg border border-dashed border-gray-300 bg-white text-sm text-gray-600 ${uploading ? 'opacity-50' : 'cursor-pointer hover:bg-gray-50'}`}>
                {uploading ? '올리는 중…' : '+ 그림 올리기 (여러 장 가능)'}
                <input type="file" accept="image/*" multiple hidden disabled={uploading} onChange={(e) => { void addLibrary(e.target.files); e.target.value = '' }} />
              </label>
            </div>
            <p className="text-xs text-gray-400 mt-1">랜딩에 실제로 보일 그림입니다(강사 사진, 증빙 캡처, 선물 그림, 후기 캡처). <b className="text-gray-600">주민번호·사업자번호·주소·다른 사람 이름은 미리 가린 그림을 올려 주세요.</b> 올린 그림은 주소를 아는 사람이 볼 수 있습니다. 이름표를 적어 두면 AI 가 맞는 칸에 넣습니다.</p>
          </div>

          <div>
            <p className="text-sm font-bold text-gray-800 mb-1">자료 메모 <span className="font-normal text-gray-400">(선택)</span></p>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={`${inputCls} resize-y`}
              placeholder="파일로 없는 내용만 덧붙입니다. 예: 선물 5종 이름, 입장 방법, 강사가 카톡으로 보내 준 이력" />
            <p className="text-xs text-gray-400 mt-1">문장을 다듬을 필요는 없습니다. 사실과 숫자가 정확하면 됩니다. {courseId != null ? '초안을 만들 때 이 강의에 보관됩니다(관리자만 볼 수 있음).' : '강의를 한 번 저장하면 다음부터 이 메모가 보관됩니다.'}</p>
          </div>

          <div className="grid grid-cols-[200px_1fr] max-sm:grid-cols-1 gap-3">
            <div>
              <p className="text-sm font-bold text-gray-800 mb-1">만들 범위</p>
              <select value={scope} onChange={(e) => setScope(e.target.value)} className={inputCls}>
                <option value="">전체</option>
                {sections.map((s) => <option key={s.key} value={s.key}>{s.block != null ? `${s.block}. ` : ''}{s.name}만</option>)}
              </select>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-800 mb-1">요청 사항 (선택)</p>
              <input value={instruction} onChange={(e) => setInstruction(e.target.value)} className={inputCls} placeholder="예: 첫 화면 제목은 강사 별칭을 넣어서, 오해 깨기는 3개만" />
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button type="button" onClick={() => void run()} disabled={running || uploading}
              className="px-4 py-2 rounded-xl text-sm bg-[#2ED573] text-white font-bold border-none cursor-pointer disabled:opacity-50 disabled:cursor-wait">
              {running ? '만드는 중…' : scope ? '이 섹션 초안 만들기' : '초안 만들기'}
            </button>
            {previous && !running && (
              <button type="button" onClick={undo} className="px-4 py-2 rounded-xl text-sm bg-white border border-gray-200 text-gray-700 cursor-pointer">만들기 전으로 되돌리기</button>
            )}
            {running && <span className="text-xs text-gray-500">{progress} 1~3분쯤 걸립니다. 창을 닫지 마세요.</span>}
          </div>

          {outcome && (
            <div className="space-y-3 bg-white rounded-xl p-4 border border-gray-200">
              <p className="text-sm font-bold">초안 결과 — {outcome.scope}</p>
              {list('자료를 읽은 방식', outcome.warnings, 'text-gray-500')}
              {list('더 필요한 자료', outcome.clean.missing, 'text-red-500')}
              {list('검토할 점', outcome.clean.notes, 'text-amber-600')}
              {list('형식이 맞지 않아 뺀 것', outcome.clean.dropped, 'text-gray-500')}
              {outcome.clean.sources.length > 0 && (
                <details>
                  <summary className="text-xs font-bold text-gray-600 cursor-pointer">어느 자료에서 나온 글인지 ({outcome.clean.sources.length})</summary>
                  <ul className="text-xs text-gray-600 list-disc pl-4 space-y-0.5 mt-1">{outcome.clean.sources.map((s, i) => <li key={i}><b>{s.where}</b> ← {s.from}</li>)}</ul>
                </details>
              )}
              {outcome.usage && (
                <p className="text-xs text-gray-400">이번 사용료 약 ${outcome.usage.cost_usd.toFixed(3)} (읽은 양 {outcome.usage.input_tokens.toLocaleString('ko-KR')} · 쓴 양 {outcome.usage.output_tokens.toLocaleString('ko-KR')} 토큰)</p>
              )}
              <p className="text-xs text-gray-500">초안은 아직 저장되지 않았습니다. 아래 입력 화면에서 고친 뒤 강의를 저장해야 반영됩니다.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
