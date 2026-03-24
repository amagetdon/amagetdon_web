import { useState, useEffect, useCallback } from 'react'
import { reviewService } from '../services/reviewService'
import type { ReviewWithCourse } from '../types'

export function useReviews(options?: { page?: number; perPage?: number; instructorId?: number }) {
  const [reviews, setReviews] = useState<ReviewWithCourse[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    try {
      setLoading(true)
      const { data, count } = await reviewService.getAll(options)
      setReviews(data)
      setTotalCount(count)
    } catch (err) {
      setError(err instanceof Error ? err.message : '후기를 불러오는데 실패했습니다')
    } finally {
      setLoading(false)
    }
  }, [options?.page, options?.perPage, options?.instructorId])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { reviews, totalCount, loading, error, refetch: fetch }
}

export function useFeaturedReviews(limit = 5) {
  const [reviews, setReviews] = useState<ReviewWithCourse[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    reviewService.getFeatured(limit).then(setReviews).catch(() => {}).finally(() => setLoading(false))
  }, [limit])

  return { reviews, loading }
}
