// 웹툰 랜딩 대사 목록(PM 대사목록.json) → 컷 설정 코드(src/lib/webtoon-cuts/<slug>.ts) 변환
// 쓰는 법: node scripts/webtoon-dialogue.mjs "<대사목록.json>" <slug>
// - 컷 그림 = 파일 이름 앞 두 자리(public/webtoon/<slug>/NN.webp — scripts/webtoon-images.sh 로 먼저 변환)
// - 위치 "upper-left 10%" → 위 10%, 왼쪽. 종류 caption_small → caption, text_scene → 글자 장면(card)
// 표지·대화 화면 문구는 자동으로 바꾸지 않는다 → src/lib/webtoonLandings.ts 에서 직접 맞춘다.
import fs from 'node:fs'
import path from 'node:path'

const [src, slug] = process.argv.slice(2)
if (!src || !slug) { console.error('쓰는 법: node scripts/webtoon-dialogue.mjs <대사목록.json> <slug>'); process.exit(1) }
const data = JSON.parse(fs.readFileSync(src, 'utf8'))
const num = (file) => (file ? String(file).slice(0, 2) : null)

function pos(p = '') {
  const top = Number((p.match(/(\d+(?:\.\d+)?)\s*%/) || [])[1] ?? (/(lower|bottom)/.test(p) ? 85 : /middle/.test(p) ? 50 : 10))
  const align = /left/.test(p) ? 'left' : /right/.test(p) ? 'right' : 'center'
  return { top, align }
}

const TYPE = { narration: 'narration', speech: 'speech', dark_box: 'dark_box', sfx: 'sfx', caption_small: 'caption', caption: 'caption' }

const cuts = data.cuts.map((c) => {
  if (c.type === 'text_scene' || !c.image) {
    const lines = c.lines ?? []
    const card = { lines }
    // 첫 줄이 질문·제목이면 제목으로(C22 '왜 하필…?'), 숫자 강조 줄은 초록
    const highlight = lines.map((l, i) => (/\d+억 원$|초안은 1분|글 한 편부터/.test(l) && i > 0 ? i : -1)).filter((i) => i >= 0)
    if (highlight.length) card.highlight = highlight
    if (c.caption_small) card.note = c.caption_small
    if (c.small_images) card.images = c.small_images.map(num)
    if (c.animation) card.animation = 'typing'
    return { id: c.cut, ratio: 'R', bubbles: [], card }
  }
  return {
    id: c.cut,
    n: num(c.image),
    bubbles: (c.bubbles ?? []).map((b) => {
      // 선택 항목: 폭(width "45%"·w), 꼬리 방향(tail up/down/none), 꼬리 가로 위치(tail_x %)
      const w = b.w ?? (b.width != null ? parseFloat(String(b.width)) : undefined)
      const tailX = b.tailX ?? b.tail_x
      return {
        type: TYPE[b.type] ?? 'narration', ...(b.speaker ? { speaker: b.speaker } : {}), ...pos(b.position), text: b.text,
        ...(Number.isFinite(w) ? { w } : {}), ...(b.tail ? { tail: b.tail } : {}), ...(tailX != null ? { tailX: Number(tailX) } : {}),
      }
    }),
  }
})

const lines = cuts.map((c) => {
  if (c.card) return `  textCut(${JSON.stringify(c.id)}, ${JSON.stringify(c.card)}),`
  return `  cut(${JSON.stringify(c.n)}, ${JSON.stringify(c.id)}, ${JSON.stringify(c.bubbles)}),`
})
const out = `// 자동 생성 — scripts/webtoon-dialogue.mjs (${path.basename(src)}). 직접 고치지 말고 대사 목록을 고쳐 다시 만든다.
import type { Bubble, WebtoonCut } from '../webtoonLandings'

const BASE = '/webtoon/${slug}'
const R = 1376 / 768
const cut = (n: string, id: string, bubbles: Bubble[]): WebtoonCut => ({ id, src: \`\${BASE}/\${n}.webp\`, ratio: R, bubbles })
const textCut = (id: string, card: NonNullable<WebtoonCut['card']>): WebtoonCut => ({
  id, ratio: R, bubbles: [], card: { ...card, images: card.images?.map((n) => \`\${BASE}/\${n}.webp\`) },
})

export const CUTS: WebtoonCut[] = [
${lines.join('\n')}
]
`
const dest = `src/lib/webtoon-cuts/${slug}.ts`
fs.mkdirSync(path.dirname(dest), { recursive: true })
fs.writeFileSync(dest, out)
console.log(`완료: ${dest} (컷 ${cuts.length}개, 글자 장면 ${cuts.filter((c) => c.card).length}개)`)
