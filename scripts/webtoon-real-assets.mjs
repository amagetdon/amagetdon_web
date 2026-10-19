// 웹툰 랜딩 실제 자료·후기 그림 변환 — 대사목록의 real(image/images)·carousel(images)을 읽어
// public/webtoon/<slug>/real/<컷id>-<순번>.webp, reviews/h<순번>.webp 로 만든다(ffmpeg 필요, 폭 최대 1125px).
// 쓰는 법: node scripts/webtoon-real-assets.mjs "<대사목록.json>" <slug> [--hold PROOF2,PROOF3,E1b]
// --hold 로 지정한 자료(컷 id 또는 파일 이름 앞부분)는 변환하지 않는다 — 공개 저장소에 올라가지 않게.
// ⚠️ 이 저장소는 공개(GitHub)다. 개인정보(생년월일·주소·계좌 등)가 보이는 자료는 반드시 --hold.
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const args = process.argv.slice(2)
const holdIdx = args.indexOf('--hold')
const hold = holdIdx >= 0 ? String(args[holdIdx + 1] || '').split(',').map((s) => s.trim()).filter(Boolean) : []
const [src, slug] = args.filter((_, i) => i !== holdIdx && i !== holdIdx + 1)
if (!src || !slug) { console.error('쓰는 법: node scripts/webtoon-real-assets.mjs <대사목록.json> <slug> [--hold ...]'); process.exit(1) }
const dir = path.dirname(src)
const data = JSON.parse(fs.readFileSync(src, 'utf8'))
const out = `public/webtoon/${slug}`
fs.mkdirSync(`${out}/real`, { recursive: true })
fs.mkdirSync(`${out}/reviews`, { recursive: true })
const isHeld = (id, f) => hold.some((h) => id === h || path.basename(f).startsWith(h))

function convert(from, to) {
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', path.join(dir, from), '-vf', "scale='min(1125,iw)':-2", '-c:v', 'libwebp', '-quality', '82', to])
  console.log(`  ${to}  ← ${from}`)
}

for (const c of data.cuts) {
  if (c.type === 'real') {
    const files = c.images ?? (c.image ? [c.image] : [])
    files.forEach((f, i) => {
      if (isHeld(c.cut, f)) { console.log(`  (보류) ${c.cut} ${f}`); return }
      convert(f, `${out}/real/${c.cut}-${i + 1}.webp`)
    })
  }
  if (c.type === 'carousel') (c.images ?? []).forEach((f, i) => convert(f, `${out}/reviews/h${i + 1}.webp`))
}
console.log('완료')
