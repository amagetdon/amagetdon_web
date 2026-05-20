// pdfjs-dist 의 cmaps·standard_fonts 를 public/ 으로 복사.
// jsDelivr CDN 의존 제거 — 인터미턴트 CDN 실패·CORS·버전 매칭 변수가 사라져 dev↔prod 동작이 동일해짐.
// package.json 의 postinstall / prebuild 에서 호출.
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const src = path.join(root, 'node_modules', 'pdfjs-dist')
const dst = path.join(root, 'public')

const targets = ['cmaps', 'standard_fonts']

for (const name of targets) {
  const from = path.join(src, name)
  const to = path.join(dst, name)
  if (!fs.existsSync(from)) {
    console.warn(`[copy-pdfjs-assets] 원본 없음, skip: ${from}`)
    continue
  }
  fs.rmSync(to, { recursive: true, force: true })
  fs.cpSync(from, to, { recursive: true })
  console.log(`[copy-pdfjs-assets] ${name}/ → public/${name}/`)
}
