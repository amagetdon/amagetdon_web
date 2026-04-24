import { useQuery, useQueryClient } from '@tanstack/react-query'
import { reviewService } from '../services/reviewService'
import type { ReviewWithCourse } from '../types'

export function useReviews(options?: { page?: number; perPage?: number; instructorId?: number }) {
  const page = options?.page
  const perPage = options?.perPage
  const instructorId = options?.instructorId
  const queryClient = useQueryClient()
  const queryKey = ['reviews', page ?? null, perPage ?? null, instructorId ?? null]
  const q = useQuery<{ data: ReviewWithCourse[]; count: number }>({
    queryKey,
    queryFn: () => reviewService.getAll({ page, perPage, instructorId }),
  })
  return {
    reviews: q.data?.data ?? [],
    totalCount: q.data?.count ?? 0,
    loading: q.isLoading,
    error: q.error ? ((q.error as Error).message || '후기를 불러오는데 실패했습니다') : null,
    refetch: () => queryClient.invalidateQueries({ queryKey }),
  }
}

export function useFeaturedReviews(limit = 5) {
  const q = useQuery<ReviewWithCourse[]>({
    queryKey: ['reviews', 'featured', limit],
    queryFn: () => reviewService.getFeatured(limit),
  })
  return { reviews: q.data ?? [], loading: q.isLoading }
}
