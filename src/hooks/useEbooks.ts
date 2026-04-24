import { useQuery } from '@tanstack/react-query'
import { ebookService } from '../services/ebookService'
import type { EbookWithInstructor } from '../types'

export function useEbooks(options?: { isFree?: boolean; limit?: number }) {
  const isFree = options?.isFree
  const limit = options?.limit
  const q = useQuery<EbookWithInstructor[]>({
    queryKey: ['ebooks', isFree ?? 'all', limit ?? 'all'],
    queryFn: () => ebookService.getAll({ isFree, limit }),
  })
  return { ebooks: q.data ?? [], loading: q.isLoading, error: q.error ? ((q.error as Error).message || '전자책을 불러오는데 실패했습니다') : null }
}

export function useEbooksByInstructor(instructorId: number | null) {
  const q = useQuery<EbookWithInstructor[]>({
    queryKey: ['ebooks', 'by-instructor', instructorId],
    queryFn: () => (instructorId ? ebookService.getByInstructor(instructorId) : Promise.resolve([])),
    enabled: instructorId != null,
  })
  return { ebooks: q.data ?? [], loading: q.isLoading, error: q.error ? ((q.error as Error).message || '전자책을 불러오는데 실패했습니다') : null }
}
