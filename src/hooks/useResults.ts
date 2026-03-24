import { useState, useEffect, useCallback } from 'react'
import { resultService } from '../services/resultService'
import type { Result } from '../types'

export function useResults(options?: { page?: number; perPage?: number }) {
  const [results, setResults] = useState<Result[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    try {
      setLoading(true)
      const { data, count } = await resultService.getAll(options)
      setResults(data)
      setTotalCount(count)
    } catch (err) {
      setError(err instanceof Error ? err.message : '성과를 불러오는데 실패했습니다')
    } finally {
      setLoading(false)
    }
  }, [options?.page, options?.perPage])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { results, totalCount, loading, error, refetch: fetch }
}

export function useFeaturedResults(limit = 4) {
  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    resultService.getFeatured(limit).then(setResults).catch(() => {}).finally(() => setLoading(false))
  }, [limit])

  return { results, loading }
}
