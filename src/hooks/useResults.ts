import { useQuery, useQueryClient } from '@tanstack/react-query'
import { resultService } from '../services/resultService'
import type { Result } from '../types'

export function useResults(options?: { page?: number; perPage?: number }) {
  const page = options?.page
  const perPage = options?.perPage
  const queryClient = useQueryClient()
  const queryKey = ['results', page ?? null, perPage ?? null]
  const q = useQuery<{ data: Result[]; count: number }>({
    queryKey,
    queryFn: () => resultService.getAll({ page, perPage }),
  })
  return {
    results: q.data?.data ?? [],
    totalCount: q.data?.count ?? 0,
    loading: q.isLoading,
    error: q.error ? ((q.error as Error).message || '성과를 불러오는데 실패했습니다') : null,
    refetch: () => queryClient.invalidateQueries({ queryKey }),
  }
}

export function useFeaturedResults(limit = 4) {
  const q = useQuery<Result[]>({
    queryKey: ['results', 'featured', limit],
    queryFn: () => resultService.getFeatured(limit),
  })
  return { results: q.data ?? [], loading: q.isLoading }
}
