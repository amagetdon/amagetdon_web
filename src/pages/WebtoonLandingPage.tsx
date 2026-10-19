import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { setChromeHidden } from '../lib/chrome'
import { logProductVisit } from '../lib/attribution'
import { trackViewItem, buildContentId, courseCategoryLabel } from '../lib/tracking'
import { r2Proxy } from '../lib/image'
import { useCourse } from '../hooks/useCourses'
import {
  WEBTOON_LANDINGS, BLOG_EXP_OPTIONS, DAILY_TIME_OPTIONS, CONCERN_MAX,
  type WebtoonCut, type WebtoonLanding,
} from '../lib/webtoonLandings'

// 웹툰식 랜딩 /w/:slug — 표지(W1) → 웹툰(W2) → 대화형 신청(W3~W7). 화면 흐름은 PM 스토리보드 v3 '5 · 화면 흐름표'.
// 단계는 주소 ?step= 로 나누고 새로고침 없이 바꾼다(뒤로 가기 = 앞 단계). 강의 상세·기존 신청 흐름과는 별개 페이지.
// 데모 1단계: 카카오 신청은 아직 연결 전 — 버튼을 누르면 뒤 화면을 미리 보기만 하고 아무것도 저장하지 않는다.
const DEMO = true

type Step = 'cover' | 'webtoon' | 'signup' | 'saved' | 'q1' | 'q2' | 'done'
const STEPS: Step[] = ['cover', 'webtoon', 'signup', 'saved', 'q1', 'q2', 'done']
const GREEN = '#2ED573'

function pushEvent(event: string, data: Record<string, unknown> = {}) {
  try {
    const w = window as unknown as { dataLayer?: unknown[] }
    w.dataLayer = w.dataLayer || []
    w.dataLayer.push({ event, ...data })
  } catch { /* GTM 없음 */ }
}

const fill = (s: string, name: string) => s.replace(/\{name\}/g, name)

export default function WebtoonLandingPage() {
  const { slug } = useParams<{ slug: string }>()
  const cfg = slug ? WEBTOON_LANDINGS[slug] : undefined
  const [params, setParams] = useSearchParams()
  const raw = params.get('step') as Step | null
  const step: Step = raw && STEPS.includes(raw) ? raw : 'cover'
  const { course } = useCourse(cfg?.courseId ?? null)

  // 사이트 머리글·바닥글·상담 버튼 숨김
  useEffect(() => {
    setChromeHidden(true)
    return () => setChromeHidden(false)
  }, [])

  // 129 통합 대시보드 '유입' — 강의 상세 주소가 아니라서 여기서 직접 기록
  useEffect(() => {
    if (cfg) logProductVisit(`course_${cfg.courseId}`)
  }, [cfg])

  // ViewContent — 표지 진입 1회 (강의 상세와 같은 이벤트)
  const viewFired = useRef(false)
  useEffect(() => {
    if (!course || viewFired.current) return
    viewFired.current = true
    trackViewItem({
      contentId: buildContentId('course', course.id),
      contentName: course.title,
      contentCategory: courseCategoryLabel(course.course_type),
      instructorName: course.instructor?.name ?? null,
      value: 0,
    })
  }, [course])

  const go = useCallback((s: Step, replace = false) => {
    const p = new URLSearchParams(window.location.search)
    if (s === 'cover') p.delete('step')
    else p.set('step', s)
    setParams(p, { replace })
    window.scrollTo(0, 0)
  }, [setParams])

  if (!cfg) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-black text-white gap-4">
        <p>페이지를 찾을 수 없어요.</p>
        <Link to="/" className="underline">홈으로</Link>
      </div>
    )
  }

  const name = '회원' // 데모: 로그인 연결 후 회원 이름으로 바뀜

  return (
    <div className="bg-black min-h-[100dvh] text-white">
      {DEMO && !['cover', 'webtoon'].includes(step) && (
        <div className="fixed top-0 inset-x-0 z-50 bg-yellow-300 text-black text-[11px] text-center py-1 font-bold">
          데모 화면 · 카카오 신청 연결 전이라 아무것도 저장되지 않아요
        </div>
      )}
      {step === 'cover' && <Cover cfg={cfg} onNext={() => go('webtoon')} />}
      {step === 'webtoon' && <Webtoon cfg={cfg} onNext={(via) => { pushEvent(via === 'skip' ? 'webtoon_skip' : 'webtoon_end_click', { landing: cfg.slug }); go('signup') }} />}
      {step === 'signup' && (
        <ChatScreen bg={cfg.portrait} speaker={cfg.speaker} line={cfg.lines.signup} onBack={() => go('webtoon')}>
          <button
            type="button"
            onClick={() => {
              if (DEMO) { toast('데모: 카카오 로그인 연결은 다음 단계예요. 뒤 화면을 미리 보여 드릴게요.'); go('saved', true); return }
            }}
            className="w-full h-14 rounded-xl bg-[#FEE500] text-[#191919] font-bold text-[16px] flex items-center justify-center gap-2 active:scale-[0.98] transition"
          >
            <KakaoIcon />
            카카오로 1초 만에 신청하기
          </button>
          <p className="text-[11px] text-white/60 text-center mt-3 leading-relaxed">
            가입하면 <Link to="/terms" className="underline">이용약관</Link>·<Link to="/privacy" className="underline">개인정보 처리방침</Link>에 동의하게 돼요
          </p>
        </ChatScreen>
      )}
      {step === 'saved' && <Saved cfg={cfg} name={name} onDone={() => go('q1', true)} />}
      {step === 'q1' && <Question1 cfg={cfg} name={name} onBack={() => go('signup')} onNext={() => go('q2')} />}
      {step === 'q2' && <Question2 cfg={cfg} onBack={() => go('q1')} onNext={() => go('done')} />}
      {step === 'done' && <Done cfg={cfg} name={name} openChatUrl={course?.after_purchase_url ?? null} />}
    </div>
  )
}

/* ───────── W1 표지 ───────── */
function Cover({ cfg, onNext }: { cfg: WebtoonLanding; onNext: () => void }) {
  const c = cfg.cover
  return (
    <section className="relative h-[100dvh] max-w-[480px] mx-auto overflow-hidden">
      {c.video ? (
        <video
          className="absolute inset-0 w-full h-full object-cover"
          src={r2Proxy(c.video)} poster={r2Proxy(c.poster)}
          autoPlay muted loop playsInline preload="auto"
        />
      ) : (
        <img className="absolute inset-0 w-full h-full object-cover" src={r2Proxy(c.poster)} alt="" fetchPriority="high" />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-transparent to-black/85" />
      <div className="relative h-full flex flex-col items-center px-6 pt-[9vh] pb-[calc(env(safe-area-inset-bottom)+28px)]">
        <p className="text-[15px] tracking-[0.3em] font-semibold" style={{ color: GREEN }}>{c.kicker}</p>
        <h1 className="mt-2 text-[40px] leading-tight font-black text-center drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">{c.title}</h1>
        <p className="mt-3 text-[16px] text-white/90 text-center">“ {c.quote} ”</p>
        <div className="flex-1" />
        <button
          type="button" onClick={onNext}
          className="w-full h-14 rounded-xl border-2 border-white bg-white/10 backdrop-blur-sm text-white font-bold text-[17px] active:scale-[0.98] transition"
        >
          {c.cta}
        </button>
        <p className="mt-3 text-[12px] text-white/70">{c.note}</p>
      </div>
    </section>
  )
}

/* ───────── W2 웹툰 ───────── */
function Webtoon({ cfg, onNext }: { cfg: WebtoonLanding; onNext: (via: 'skip' | 'end') => void }) {
  const [scrolled, setScrolled] = useState(false)
  const [endVisible, setEndVisible] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const sent = useRef(new Set<number>())

  useEffect(() => {
    const onScroll = () => {
      if (window.scrollY > 20) setScrolled(true)
      const max = document.documentElement.scrollHeight - window.innerHeight
      const pct = max > 0 ? (window.scrollY / max) * 100 : 100
      for (const mark of [25, 50, 75, 100]) {
        if (pct >= mark - 1 && !sent.current.has(mark)) {
          sent.current.add(mark)
          pushEvent('webtoon_progress', { landing: cfg.slug, percent: mark })
        }
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [cfg.slug])

  useEffect(() => {
    const el = endRef.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setEndVisible(e.isIntersecting), { threshold: 0.1 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <section className="max-w-[480px] mx-auto bg-[#0b0f14]">
      {!scrolled && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-[calc(env(safe-area-inset-bottom)+90px)] z-30 text-white/80 text-xs flex flex-col items-center animate-bounce pointer-events-none">
          <span>스크롤</span><span>▼</span>
        </div>
      )}
      {cfg.webtoon.cuts.map((cut, i) => <Cut key={cut.id} cut={cut} eager={i < 1} />)}
      <div ref={endRef} className="px-6 pt-10 pb-[calc(env(safe-area-inset-bottom)+48px)] flex flex-col items-center gap-3">
        <button
          type="button" onClick={() => onNext('end')}
          className="w-full h-14 rounded-xl text-black font-bold text-[17px] active:scale-[0.98] transition"
          style={{ background: GREEN }}
        >
          {cfg.webtoon.endCta}
        </button>
        <p className="text-[12px] text-white/60">유튜브 무료 라이브 · 다시보기 없음</p>
      </div>

      {!endVisible && (
        <div className="fixed z-40 right-[max(22px,calc(50vw-240px+22px))] bottom-[calc(env(safe-area-inset-bottom)+26px)] flex items-center gap-2">
          {!scrolled && (
            <span className="bg-white text-black text-[12px] font-bold rounded-full px-3 py-2 shadow-lg">{cfg.webtoon.skipBubble}</span>
          )}
          <button
            type="button" aria-label="웹툰 건너뛰기" onClick={() => onNext('skip')}
            className="w-10 h-10 rounded-full bg-white text-black font-black text-lg shadow-lg flex items-center justify-center active:scale-95"
          >
            »
          </button>
        </div>
      )}
    </section>
  )
}

function Cut({ cut, eager }: { cut: WebtoonCut; eager: boolean }) {
  const ratio = cut.ratio ?? 1.25
  return (
    <div className="relative">
      {cut.src ? (
        <img
          src={r2Proxy(cut.src)} alt="" className="w-full block"
          style={{ aspectRatio: `1 / ${ratio}` }}
          loading={eager ? 'eager' : 'lazy'} decoding="async"
        />
      ) : (
        <div className="w-full flex flex-col items-center justify-center gap-2 border-y border-white/10 bg-gradient-to-b from-[#121821] to-[#0b0f14] px-8 text-center" style={{ aspectRatio: `1 / ${ratio}` }}>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded" style={{ background: GREEN, color: '#000' }}>{cut.id} · 그림 준비 중</span>
          {cut.scene && <p className="text-[13px] text-white/50 leading-relaxed">{cut.scene}</p>}
        </div>
      )}
      {cut.texts && cut.texts.length > 0 && (
        <div className="absolute inset-x-0 bottom-0 px-5 pb-6 pt-16 flex flex-col gap-2 bg-gradient-to-t from-black/80 to-transparent">
          {cut.texts.map((t, i) => {
            if (t.kind === 'narration') return <p key={i} className="self-start max-w-[88%] bg-white text-black border-2 border-black px-3 py-2 text-[14px] leading-snug font-medium">{t.text}</p>
            if (t.kind === 'sfx') return <p key={i} className="self-end text-[34px] font-black italic text-white [-webkit-text-stroke:1.5px_black] rotate-[-6deg]">{t.text}</p>
            return (
              <div key={i} className={`max-w-[88%] ${i % 2 ? 'self-end' : 'self-start'}`}>
                {t.speaker && <span className="block text-[11px] mb-1 font-bold" style={{ color: GREEN }}>{t.speaker}</span>}
                <p className="bg-white text-black rounded-[22px] px-4 py-2.5 text-[15px] leading-snug font-semibold">{t.text}</p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ───────── 대화 화면 틀 (W3~W7 공용) ───────── */
function ChatScreen({ bg, speaker, line, onBack, children, delay = 1500 }: {
  bg: string; speaker: string; line: string; onBack?: () => void; children?: ReactNode; delay?: number
}) {
  const [shown, setShown] = useState(delay === 0)
  useEffect(() => {
    if (delay === 0) return
    const t = window.setTimeout(() => setShown(true), delay)
    return () => window.clearTimeout(t)
  }, [delay])
  return (
    <section className="relative min-h-[100dvh] max-w-[480px] mx-auto overflow-hidden">
      <img src={r2Proxy(bg)} alt="" className="fixed inset-0 w-full max-w-[480px] mx-auto h-full object-cover" fetchPriority="high" />
      <div className="fixed inset-0 max-w-[480px] mx-auto bg-gradient-to-b from-black/30 via-black/20 to-black/90" />
      {onBack && (
        <button type="button" onClick={onBack} aria-label="뒤로" className="absolute top-[calc(env(safe-area-inset-top)+28px)] left-4 z-20 w-10 h-10 rounded-full bg-black/40 text-white text-xl flex items-center justify-center">
          ‹
        </button>
      )}
      <div className={`relative z-10 min-h-[100dvh] flex flex-col justify-end px-5 pb-[calc(env(safe-area-inset-bottom)+24px)] transition-all duration-700 ${shown ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
        <div className="mb-5">
          <span className="text-[12px] font-bold" style={{ color: GREEN }}>{speaker}</span>
          <p className="mt-1 text-[19px] leading-relaxed font-bold whitespace-pre-line drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">“ {line} ”</p>
        </div>
        {children}
      </div>
    </section>
  )
}

/* ───────── W4 신청 저장(자동) ───────── */
function Saved({ cfg, name, onDone }: { cfg: WebtoonLanding; name: string; onDone: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(onDone, 1800)
    return () => window.clearTimeout(t)
  }, [onDone])
  return <ChatScreen bg={cfg.portrait} speaker={cfg.speaker} line={fill(cfg.lines.saved, name)} delay={0} />
}

/* ───────── W5 선택 질문 ───────── */
function Question1({ cfg, name, onBack, onNext }: { cfg: WebtoonLanding; name: string; onBack: () => void; onNext: () => void }) {
  const [exp, setExp] = useState<string | null>(null)
  const [time, setTime] = useState<string | null>(null)
  const [sheet, setSheet] = useState<null | 'exp' | 'time'>(null)
  const blank = (v: string | null, k: 'exp' | 'time') => (
    <button type="button" onClick={() => setSheet(k)} className="inline-flex items-center mx-1 px-3 py-1 rounded-lg border-b-2 font-bold" style={{ borderColor: GREEN, color: v ? '#fff' : GREEN, background: 'rgba(46,213,115,0.12)' }}>
      {v ?? '선택하기'} ▾
    </button>
  )
  const opts = sheet === 'exp' ? BLOG_EXP_OPTIONS : DAILY_TIME_OPTIONS
  return (
    <>
      <ChatScreen bg={cfg.portrait} speaker={cfg.speaker} line={fill(cfg.lines.q1, name)} onBack={onBack}>
        <div className="rounded-2xl bg-black/60 backdrop-blur px-4 py-4 text-[16px] leading-[2.4]">
          <p>블로그는 {blank(exp, 'exp')}.</p>
          <p>하루에 {blank(time, 'time')} 쓸 수 있어요.</p>
          <p className="text-[12px] text-white/60 leading-normal mt-1">* 답하지 않아도 다음으로 넘어갈 수 있어요.</p>
        </div>
        <button type="button" onClick={onNext} className="mt-4 w-full h-14 rounded-xl text-black font-bold text-[17px]" style={{ background: GREEN }}>다음으로</button>
      </ChatScreen>
      {sheet && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center" onClick={() => setSheet(null)}>
          <div className="w-full max-w-[480px] bg-white text-black rounded-t-2xl p-4 pb-[calc(env(safe-area-inset-bottom)+16px)]" onClick={(e) => e.stopPropagation()}>
            {opts.map((o) => (
              <button key={o} type="button" className="w-full text-left py-3.5 px-2 text-[16px] border-b last:border-0" onClick={() => { if (sheet === 'exp') setExp(o); else setTime(o); setSheet(null) }}>
                {o}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

/* ───────── W6 막힌 점 ───────── */
function Question2({ cfg, onBack, onNext }: { cfg: WebtoonLanding; onBack: () => void; onNext: () => void }) {
  const [text, setText] = useState('')
  return (
    <ChatScreen bg={cfg.portrait} speaker={cfg.speaker} line={cfg.lines.q2} onBack={onBack}>
      <textarea
        value={text} onChange={(e) => setText(e.target.value.slice(0, CONCERN_MAX))}
        placeholder="자유롭게 적어 주세요 (선택)" rows={4}
        className="w-full rounded-xl bg-white text-black p-3 text-[16px] resize-none"
      />
      <p className="text-right text-[11px] text-white/60 mt-1">{text.length}/{CONCERN_MAX}</p>
      <button type="button" onClick={onNext} className="mt-2 w-full h-14 rounded-xl text-black font-bold text-[17px]" style={{ background: GREEN }}>무료 라이브 신청 마치기</button>
    </ChatScreen>
  )
}

/* ───────── W7 완료 ───────── */
function Done({ cfg, name, openChatUrl }: { cfg: WebtoonLanding; name: string; openChatUrl: string | null }) {
  return (
    <ChatScreen bg={cfg.donePortrait} speaker={cfg.speaker} line={fill(cfg.lines.done, name)}>
      {cfg.doneNotes.map((n) => <p key={n} className="text-[13px] text-white/85 mb-3">{n}</p>)}
      <button
        type="button"
        onClick={() => { if (DEMO || !openChatUrl) { toast('데모: 오픈채팅 연결은 다음 단계예요.'); return } window.location.href = openChatUrl }}
        className="w-full h-14 rounded-xl text-black font-bold text-[17px]" style={{ background: GREEN }}
      >
        오픈채팅 입장하기
      </button>
      <button type="button" onClick={() => toast('데모: 캘린더 추가는 다음 단계예요.')} className="mt-2 w-full h-11 rounded-xl border border-white/50 text-white text-[14px]">캘린더에 추가</button>
      <p className="mt-4 text-[10px] text-white/50 leading-relaxed">{cfg.disclaimer}</p>
    </ChatScreen>
  )
}

function KakaoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="#191919" d="M12 3C6.48 3 2 6.48 2 10.77c0 2.76 1.84 5.18 4.6 6.55l-.94 3.44c-.08.3.26.54.52.37l4.1-2.71c.56.08 1.13.12 1.72.12 5.52 0 10-3.48 10-7.77S17.52 3 12 3z" /></svg>
  )
}
