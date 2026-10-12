// /llms.txt (vercel.json rewrite) — AI 가 읽기 쉬운 한 장 요약(회사·강의·전자책·강사·FAQ). 요청 시 DB 로 생성, 캐시 1시간.
// 공개 정보만: 비공개·마감 상품, 유료 본문, 회원 정보 없음.
import { SITE, getPublicData, plain } from './_lib/public-data'

export const config = { runtime: 'edge' }

export default async function handler(): Promise<Response> {
  const d = await getPublicData()
  const biz = d.business
  const name = biz.siteTitle || d.seo.title || '아마겟돈 클래스'
  const company = biz.companyName || biz.mallName || '주식회사 아마겟돈 컴퍼니'
  const lines: string[] = []
  lines.push(`# ${name}`, '')
  lines.push(`> ${company}가 운영하는 온라인·오프라인 강의와 전자책 교육 플랫폼입니다.`, '')
  lines.push(`- 웹사이트: ${SITE}`)
  if (biz.ceoName) lines.push(`- 대표: ${biz.ceoName}`)
  if (biz.bizType) lines.push(`- 업종: ${biz.bizType}`)
  if (biz.email) lines.push(`- 이메일: ${biz.email}`)
  if (biz.phone) lines.push(`- 전화: ${biz.phone}`)
  if (biz.address) lines.push(`- 주소: ${biz.address}`)
  lines.push('')

  if (d.courses.length) {
    lines.push('## 강의', '')
    for (const c of d.courses) {
      const desc = plain(c.seo?.description, 120)
      const by = c.instructor?.name ? ` (강사 ${c.instructor.name})` : ''
      const kind = c.course_type === 'free' ? '무료' : c.course_type === 'pre_alert' ? '사전 알림' : '유료'
      lines.push(`- [${plain(c.title, 100)}](${SITE}/course/${c.id}): ${kind}${by}${desc ? ` — ${desc}` : ''}`)
    }
    lines.push('')
  }
  if (d.ebooks.length) {
    lines.push('## 전자책', '')
    for (const e of d.ebooks) {
      const desc = plain(e.seo?.description, 120)
      lines.push(`- [${plain(e.title, 100)}](${SITE}/ebook/${e.id}): ${e.is_free ? '무료' : '유료'}${desc ? ` — ${desc}` : ''}`)
    }
    lines.push('')
  }
  if (d.instructors.length) {
    lines.push('## 강사', '')
    for (const i of d.instructors) {
      const head = plain(i.headline, 120)
      lines.push(`- [${plain(i.name, 40)}](${SITE}/instructors/${i.id})${head ? `: ${head}` : ''}`)
    }
    lines.push('')
  }
  if (d.faqs.length) {
    lines.push('## 자주 묻는 질문', '')
    for (const f of d.faqs) lines.push(`- ${plain(f.question, 120)}: ${plain(f.answer, 240)}`)
    lines.push(`- 전체 FAQ: ${SITE}/faq`, '')
  }
  lines.push('## 더 보기', '')
  lines.push(`- 강의 목록: ${SITE}/academy`, `- 수강 후기: ${SITE}/reviews`, `- 뉴스레터: ${SITE}/board`, `- 사이트맵: ${SITE}/sitemap.xml`, '')

  return new Response(lines.join('\n'), {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=600, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
