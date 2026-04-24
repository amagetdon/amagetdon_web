import { useQuery } from '@tanstack/react-query'
import { courseService } from '../services/courseService'
import type { CourseWithInstructor, CourseWithCurriculum } from '../types'

// React Query 기반 — 동일 queryKey 는 자동 dedup (페이지에서 여러 컴포넌트가 같은 데이터 fetch 해도 API 1회만)
export function useCourses(type?: 'free' | 'premium') {
  const q = useQuery<CourseWithInstructor[]>({
    queryKey: ['courses', 'public', type ?? 'all'],
    queryFn: () => courseService.getAllPublic(type),
  })
  return { courses: q.data ?? [], loading: q.isLoading, error: q.error ? ((q.error as Error).message || '강의를 불러오는데 실패했습니다') : null }
}

export function useCourse(id: number | null) {
  const q = useQuery<CourseWithCurriculum | null>({
    queryKey: ['course', id],
    queryFn: () => (id ? courseService.getById(id) : Promise.resolve(null)),
    enabled: id != null,
  })
  return { course: q.data ?? null, loading: q.isLoading, error: q.error ? ((q.error as Error).message || '강의를 불러오는데 실패했습니다') : null }
}

export function useCoursesByInstructor(instructorId: number | null) {
  const q = useQuery<CourseWithInstructor[]>({
    queryKey: ['courses', 'by-instructor', instructorId],
    queryFn: () => (instructorId ? courseService.getByInstructor(instructorId) : Promise.resolve([])),
    enabled: instructorId != null,
  })
  return { courses: q.data ?? [], loading: q.isLoading, error: q.error ? ((q.error as Error).message || '강의를 불러오는데 실패했습니다') : null }
}
