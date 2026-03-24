import { useState, useEffect, useCallback } from 'react'
import { faqService } from '../services/faqService'
import type { Faq } from '../types'

export function useFaqs(options?: { search?: string; page?: number; perPage?: number }) {
  const [faqs, setFaqs] = useState<Faq[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    try {
      setLoading(true)
      const { data, count } = await faqService.getAll(options)
      setFaqs(data)
      setTotalCount(count)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'FAQ를 불러오는데 실패했습니다')
    } finally {
      setLoading(false)
    }
  }, [options?.search, options?.page, options?.perPage])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { faqs, totalCount, loading, error }
}
