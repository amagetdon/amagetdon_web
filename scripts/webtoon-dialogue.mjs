// 웹툰 랜딩 대사 목록(PM 대사목록.json) → 컷 설정 코드(src/lib/webtoon-cuts/<slug>.ts) 변환
// 쓰는 법: node scripts/webtoon-dialogue.mjs "<대사목록.json>" <slug>
// - 컷 그림 = 파일 이름 앞 두 자리(public/webtoon/<slug>/NN.webp — scripts/webtoon-images.sh 로 먼저 변환)
// - 위치: v6 형식 {x: left|center|right, anchor: top|bottom, y: %, maxW: %} 또는 예전 형식 position "upper-left 10%"
// - 종류: caption_small → caption, text_scene → 글자 장면(card), review → 후기 카드
// - 꼬리(tail): "아래 오른쪽"·"위 오른쪽(입 방향)" 같은 설명에서 위/아래·왼쪽/오른쪽을 읽는다
// 표지·대화 화면 문구는 자동으로 바꾸지 않는다 → src/lib/webtoonLandings.ts 에서 직접 맞춘다.
import fs from 'node:fs'
import path from 'node:path'

const [src, slug] = process.argv.slice(2)
if (!src || !slug) { console.error('쓰는 법: node scripts/webtoon-dialogue.mjs <대사목록.json> <slug>'); process.exit(1) }
const data = JSON.parse(fs.readFileSync(src, 'utf8'))
const num = (file) => (file ? String(file).slice(0, 2) : null)

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

const cuts = data.cuts.map((c) => {
  if (c.type === 'review') {
    return { kind: 'review', id: c.cut, n: num(c.image), review: { ...(c.header ? { header: c.header } : {}), note: c.note || '' } }
  }
  if (c.type === 'text_scene' || !c.image) {
    const lines = c.lines ?? []
    const card = { lines }
    // 숫자·핵심 줄은 초록 강조
    const highlight = lines.map((l, i) => (/\d+억 원$|초안은 1분|글 한 편부터|따로 있어요/.test(l) && i > 0 ? i : -1)).filter((i) => i >= 0)
    if (highlight.length) card.highlight = highlight
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

const lines = cuts.map((c) => {
  if (c.kind === 'text') return `  textCut(${JSON.stringify(c.id)}, ${JSON.stringify(c.card)}),`
  if (c.kind === 'review') return `  reviewCut(${JSON.stringify(c.n)}, ${JSON.stringify(c.id)}, ${JSON.stringify(c.review)}),`
  return `  cut(${JSON.stringify(c.n)}, ${JSON.stringify(c.id)}, ${JSON.stringify(c.bubbles)}),`
})
const out = `// 자동 생성 — scripts/webtoon-dialogue.mjs (${path.basename(src)}). 직접 고치지 말고 대사 목록을 고쳐 다시 만든다.
import type { Bubble, WebtoonCut } from '../webtoonLandings'

const BASE = '/webtoon/${slug}'
const R = 1376 / 768
const cut = (n: string, id: string, bubbles: Bubble[]): WebtoonCut => ({ id, src: \`\${BASE}/\${n}.webp\`, ratio: R, bubbles })
${cuts.some((c) => c.kind === 'text') ? `const textCut = (id: string, card: NonNullable<WebtoonCut['card']>): WebtoonCut => ({
  id, ratio: R, bubbles: [], card: { ...card, images: card.images?.map((n) => \`\${BASE}/\${n}.webp\`) },
})
` : ''}${cuts.some((c) => c.kind === 'review') ? `const reviewCut = (n: string, id: string, review: NonNullable<WebtoonCut['review']>): WebtoonCut => ({ id, src: \`\${BASE}/\${n}.webp\`, ratio: 1, bubbles: [], review })
` : ''}
export const CUTS: WebtoonCut[] = [
${lines.join('\n')}
]
`
const dest = `src/lib/webtoon-cuts/${slug}.ts`
fs.mkdirSync(path.dirname(dest), { recursive: true })
fs.writeFileSync(dest, out)
console.log(`완료: ${dest} (컷 ${cuts.length}개 · 글자 장면 ${cuts.filter((c) => c.kind === 'text').length} · 후기 ${cuts.filter((c) => c.kind === 'review').length})`)
