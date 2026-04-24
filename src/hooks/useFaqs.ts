import { useQuery } from '@tanstack/react-query'
import { faqService } from '../services/faqService'
import type { Faq } from '../types'

export function useFaqs(options?: { search?: string; page?: number; perPage?: number }) {
  const search = options?.search
  const page = options?.page
  const perPage = options?.perPage
  const q = useQuery<{ data: Faq[]; count: number }>({
    queryKey: ['faqs', search ?? null, page ?? null, perPage ?? null],
    queryFn: () => faqService.getAll({ search, page, perPage }),
  })
  return {
    faqs: q.data?.data ?? [],
    totalCount: q.data?.count ?? 0,
    loading: q.isLoading,
    error: q.error ? ((q.error as Error).message || 'FAQ를 불러오는데 실패했습니다') : null,
  }
}
