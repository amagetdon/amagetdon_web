import { useParams } from 'react-router-dom'
import CourseDetailPage from './CourseDetailPage'
import NotFoundPage from './NotFoundPage'
import { COURSE_VARIANTS } from '../lib/courseVariants'

// 미노출 강의 랜딩 /c/:slug — 설정은 lib/courseVariants.ts. 강의 상세 화면을 그대로 쓰고 제목·면책조항만 바꾼다.
export default function CourseVariantPage() {
  const { slug = '' } = useParams<{ slug: string }>()
  const variant = Object.prototype.hasOwnProperty.call(COURSE_VARIANTS, slug) ? COURSE_VARIANTS[slug] : null
  if (!variant) return <NotFoundPage />
  return <CourseDetailPage key={slug} variant={variant} />
}
