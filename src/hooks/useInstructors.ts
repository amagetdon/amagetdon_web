import { useState, useEffect } from 'react'
import { instructorService } from '../services/instructorService'
import { useStaleRefreshKey } from './useVisibilityRefresh'
import { getCached } from '../lib/cache'
import type { Instructor } from '../types'

export function useInstructors(options?: { featured?: boolean; limit?: number }) {
  const cacheKey = options?.featured ? `instructors:featured:${options?.limit ?? 6}` : 'instructors:all'
  const cached = getCached<Instructor[]>(cacheKey)
  const [instructors, setInstructors] = useState<Instructor[]>(cached || [])
  const [loading, setLoading] = useState(!cached)
  const [error, setError] = useState<string | null>(null)
  const refreshKey = useStaleRefreshKey()

  useEffect(() => {
    const fetch = async () => {
      try {
        if (!cached) setLoading(true)
        const data = options?.featured
          ? await instructorService.getFeatured(options?.limit)
          : await instructorService.getAll()
        setInstructors(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : '강사 정보를 불러오는데 실패했습니다')
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [options?.featured, options?.limit, refreshKey])

  return { instructors, loading, error }
}

export function useInstructor(id: number | null) {
  const [instructor, setInstructor] = useState<Instructor | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const refreshKey = useStaleRefreshKey()

  useEffect(() => {
    if (!id) return
    const fetch = async () => {
      try {
        setLoading(true)
        const data = await instructorService.getById(id)
        setInstructor(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : '강사 정보를 불러오는데 실패했습니다')
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [id, refreshKey])

  return { instructor, loading, error }
}
