// 웹툰 랜딩 대사 목록(PM 대사목록.json) → 컷 설정 코드(src/lib/webtoon-cuts/<slug>.ts) 변환
// 쓰는 법: node scripts/webtoon-dialogue.mjs "<대사목록.json>" <slug> [--hold PROOF2,PROOF3,E1b]
// - 컷 그림 = 파일 이름 앞 두 자리(public/webtoon/<slug>/NN.webp — scripts/webtoon-images.sh 로 먼저 변환)
// - 실제 자료(real)·후기 넘기기(carousel) 그림은 scripts/webtoon-real-assets.mjs 가 real/·reviews/ 로 변환(같은 이름 규칙)
// - 위치: {x, anchor, y, maxW} 또는 예전 position "upper-left 10%"
// - 종류: caption_small → caption, text_scene → 글자 장면(card), review → 후기 카드, real → 실제 자료, carousel → 후기 넘기기
// - transitions(청월당 측정 전환값): 컷 아래·위 흐림(그림 폭 %)과 컷 사이 띠
// - --hold: 공개 전 확인이 끝나지 않은 자료(컷 id 또는 파일 이름 앞부분) — 그림 대신 '확인 중' 자리 표시, 저장소에 올리지 않음
// 표지·페이월 문구는 자동으로 바꾸지 않는다 → src/lib/webtoonLandings.ts 에서 직접 맞춘다.
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

/** 변환된 그림(public/webtoon/<slug>/NN.webp)의 실제 세로/가로 비율 — 컷마다 4:5·1:1·9:16 이 섞여도 자리가 맞게.
 *  읽지 못하면 null(→ 9:16 기본값) */
function ratioOf(file) {
  try {
    const [w, h] = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file])
      .toString().trim().split(',').map(Number)
    return w > 0 && h > 0 ? Math.round((h / w) * 10000) / 10000 : null
  } catch { return null }
}

const args = process.argv.slice(2)
const holdIdx = args.indexOf('--hold')
const hold = holdIdx >= 0 ? String(args[holdIdx + 1] || '').split(',').map((s) => s.trim()).filter(Boolean) : []
const [src, slug] = args.filter((_, i) => i !== holdIdx && i !== holdIdx + 1)
if (!src || !slug) { console.error('쓰는 법: node scripts/webtoon-dialogue.mjs <대사목록.json> <slug> [--hold ID,파일앞부분]'); process.exit(1) }
const data = JSON.parse(fs.readFileSync(src, 'utf8'))
const num = (file) => (file ? String(file).slice(0, 2) : null)
const isHeld = (idOrFile) => hold.some((h) => idOrFile === h || path.basename(String(idOrFile)).startsWith(h))
/** 실제 자료 그림의 저장 이름 — real/<컷id>-<순번>.webp (scripts/webtoon-real-assets.mjs 와 같은 규칙) */
const realName = (id, i) => `real/${id}-${i + 1}.webp`
const pct = (v) => (v == null ? undefined : parseFloat(String(v)))

function pos(b) {
  if (b.x != null || b.y != null) {
    return { top: Number(b.y ?? 10), align: ['left', 'right'].includes(b.x) ? b.x : 'center', ...(b.anchor ? { anchor: b.anchor } : {}) }
  }
  const p = b.position || ''
  const top = Number((p.match(/(\d+(?:\.\d+)?)\s*%/) || [])[1] ?? (/(lower|bottom)/.test(p) ? 85 : /middle/.test(p) ? 50 : 10))
  const align = /left/.test(p) ? 'left' : /right/.test(p) ? 'right' : 'center'
  return { top, align }
}

function tail(t) {
  if (!t) return {}
  if (['up', 'down', 'none'].includes(t)) return { tail: t }
  const s = String(t)
  const dir = /아래/.test(s) ? 'down' : /위/.test(s) ? 'up' : undefined
  const tailX = /오른쪽/.test(s) ? 78 : /왼쪽/.test(s) ? 22 : undefined
  return { ...(dir ? { tail: dir } : {}), ...(tailX != null ? { tailX } : {}) }
}

const TYPE = { narration: 'narration', speech: 'speech', dark_box: 'dark_box', sfx: 'sfx', caption_small: 'caption', caption: 'caption' }
const before = (b) => (b ? { type: b.type === 'speech' ? 'speech' : 'narration', text: b.text, ...(b.speaker ? { speaker: b.speaker } : {}) } : undefined)

const cuts = data.cuts.map((c) => {
  if (c.type === 'review') {
    return { kind: 'review', id: c.cut, n: num(c.image), review: { ...(c.header ? { header: c.header } : {}), note: c.note || '' } }
  }
  if (c.type === 'real') {
    const files = c.images ?? (c.image ? [c.image] : [])
    const shown = files.map((f, i) => ({ f, i })).filter(({ f }) => !isHeld(c.cut) && !isHeld(f))
    const real = {
      ...(c.before ? { before: before(c.before) } : {}),
      images: shown.map(({ i }) => realName(c.cut, i)),
      ...(c.note ? { note: c.note } : {}),
      ...(shown.length === 0 ? { pending: '실제 자료 · 공개 전 확인 중' } : {}),
    }
    return { kind: 'real', id: c.cut, real }
  }
  if (c.type === 'carousel') {
    return { kind: 'carousel', id: c.cut, carousel: { ...(c.before ? { before: before(c.before) } : {}), images: (c.images ?? []).map((_, i) => `reviews/h${i + 1}.webp`), note: c.note || '' } }
  }
  if (c.type === 'text_scene' || !c.image) {
    const lines = c.lines ?? []
    const card = { lines }
    // 숫자·핵심 줄은 초록 강조
    const highlight = lines.map((l, i) => (/\d+억 원$|초안은 1분|글 한 편부터|따로 있어요/.test(l) && i > 0 ? i : -1)).filter((i) => i >= 0)
    if (highlight.length) card.highlight = highlight
    if (c.emphasis) card.emphasis = c.emphasis
    if (c.caption_small) card.note = c.caption_small
    if (c.small_images) card.images = c.small_images.map(num)
    if (c.animation) card.animation = 'typing'
    return { kind: 'text', id: c.cut, card }
  }
  return {
    kind: 'cut',
    id: c.cut,
    n: num(c.image),
    bubbles: (c.bubbles ?? []).map((b) => {
      const w = b.w ?? (b.width != null ? parseFloat(String(b.width)) : undefined)
      return {
        type: TYPE[b.type] ?? 'narration', ...(b.speaker ? { speaker: b.speaker } : {}), ...pos(b), text: b.text,
        ...(Number.isFinite(w) ? { w } : {}), ...(b.maxW != null ? { maxW: Number(b.maxW) } : {}),
        ...tail(b.tail), ...(b.tail_x != null ? { tailX: Number(b.tail_x) } : {}),
      }
    }),
  }
})

// 전환(이음새): from 컷 아래 흐림 + 띠, to 컷 위 흐림
const byId = new Map(cuts.map((c) => [c.id, c]))
for (const t of data.transitions ?? []) {
  const a = byId.get(t.from)
  const b = byId.get(t.to)
  const color = t.color || '#000000'
  const g = pct(t.gradient)
  const band = pct(t.band)
  if (a && g) a.fadeBottom = { size: g, color }
  if (a && band) a.band = { size: band, color }
  if (b && g) b.fadeTop = { size: g, color }
}

const extra = (c) => ['fadeTop', 'fadeBottom', 'band'].filter((k) => c[k]).map((k) => `${k}: ${JSON.stringify(c[k])}`).join(', ')
const wrap = (expr, c) => (extra(c) ? `{ ...${expr}, ${extra(c)} }` : expr)
const lines = cuts.map((c) => {
  if (c.kind === 'text') return `  ${wrap(`textCut(${JSON.stringify(c.id)}, ${JSON.stringify(c.card)})`, c)},`
  if (c.kind === 'review') return `  ${wrap(`reviewCut(${JSON.stringify(c.n)}, ${JSON.stringify(c.id)}, ${JSON.stringify(c.review)})`, c)},`
  if (c.kind === 'real') return `  ${wrap(`realCut(${JSON.stringify(c.id)}, ${JSON.stringify(c.real)})`, c)},`
  if (c.kind === 'carousel') return `  ${wrap(`carouselCut(${JSON.stringify(c.id)}, ${JSON.stringify(c.carousel)})`, c)},`
  const r = ratioOf(`public/webtoon/${slug}/${c.n}.webp`)
  if (r == null) console.warn(`  (비율 못 읽음 → 9:16) ${c.id} ${c.n}.webp`)
  return `  ${wrap(`cut(${JSON.stringify(c.n)}, ${JSON.stringify(c.id)}, ${JSON.stringify(c.bubbles)}${r != null ? `, ${r}` : ''})`, c)},`
})
const has = (k) => cuts.some((c) => c.kind === k)
const out = `// 자동 생성 — scripts/webtoon-dialogue.mjs (${path.basename(src)}${hold.length ? `, 보류: ${hold.join(',')}` : ''}). 직접 고치지 말고 대사 목록을 고쳐 다시 만든다.
import type { Bubble, WebtoonCut } from '../webtoonLandings'

const BASE = '/webtoon/${slug}'
const R = 1376 / 768
// ratio = 그림 실제 세로/가로(변환 때 그림 파일에서 읽음), 없으면 9:16
const cut = (n: string, id: string, bubbles: Bubble[], ratio = R): WebtoonCut => ({ id, src: \`\${BASE}/\${n}.webp\`, ratio, bubbles })
${has('text') ? `const textCut = (id: string, card: NonNullable<WebtoonCut['card']>): WebtoonCut => ({
  id, ratio: R, bubbles: [], card: { ...card, images: card.images?.map((n) => \`\${BASE}/\${n}.webp\`) },
})
` : ''}${has('review') ? `const reviewCut = (n: string, id: string, review: NonNullable<WebtoonCut['review']>): WebtoonCut => ({ id, src: \`\${BASE}/\${n}.webp\`, ratio: 1, bubbles: [], review })
` : ''}${has('real') ? `const realCut = (id: string, real: NonNullable<WebtoonCut['real']>): WebtoonCut => ({
  id, ratio: R, bubbles: [], real: { ...real, images: real.images.map((f) => \`\${BASE}/\${f}\`) },
})
` : ''}${has('carousel') ? `const carouselCut = (id: string, carousel: NonNullable<WebtoonCut['carousel']>): WebtoonCut => ({
  id, ratio: R, bubbles: [], carousel: { ...carousel, images: carousel.images.map((f) => \`\${BASE}/\${f}\`) },
})
` : ''}
export const CUTS: WebtoonCut[] = [
${lines.join('\n')}
]
`
const dest = `src/lib/webtoon-cuts/${slug}.ts`
fs.mkdirSync(path.dirname(dest), { recursive: true })
fs.writeFileSync(dest, out)
const count = (k) => cuts.filter((c) => c.kind === k).length
console.log(`완료: ${dest} (컷 ${cuts.length}개 · 그림 ${count('cut')} · 글자 장면 ${count('text')} · 실제 자료 ${count('real')} · 후기 넘기기 ${count('carousel')} · 전환 ${(data.transitions ?? []).length}${hold.length ? ` · 보류 ${hold.join(',')}` : ''})`)
