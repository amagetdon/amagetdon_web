import { useQuery } from '@tanstack/react-query'
import { instructorService } from '../services/instructorService'
import type { Instructor } from '../types'

export function useInstructors(options?: { featured?: boolean; limit?: number }) {
  const featured = options?.featured
  const limit = options?.limit
  const q = useQuery<Instructor[]>({
    queryKey: ['instructors', featured ? 'featured' : 'all', limit ?? null],
    queryFn: () => (featured ? instructorService.getFeatured(limit) : instructorService.getAll()),
  })
  return { instructors: q.data ?? [], loading: q.isLoading, error: q.error ? ((q.error as Error).message || '강사 정보를 불러오는데 실패했습니다') : null }
}

export function useInstructor(id: number | null) {
  const q = useQuery<Instructor | null>({
    queryKey: ['instructor', id],
    queryFn: () => (id ? instructorService.getById(id) : Promise.resolve(null)),
    enabled: id != null,
  })
  return { instructor: q.data ?? null, loading: q.isLoading, error: q.error ? ((q.error as Error).message || '강사 정보를 불러오는데 실패했습니다') : null }
}
