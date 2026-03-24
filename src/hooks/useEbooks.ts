import { useState, useEffect } from 'react'
import { ebookService } from '../services/ebookService'
import type { EbookWithInstructor } from '../types'

export function useEbooks(options?: { isFree?: boolean; limit?: number }) {
  const [ebooks, setEbooks] = useState<EbookWithInstructor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetch = async () => {
      try {
        setLoading(true)
        const data = await ebookService.getAll(options)
        setEbooks(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : '전자책을 불러오는데 실패했습니다')
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [options?.isFree, options?.limit])

  return { ebooks, loading, error }
}

export function useEbooksByInstructor(instructorId: number | null) {
  const [ebooks, setEbooks] = useState<EbookWithInstructor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!instructorId) return
    const fetch = async () => {
      try {
        setLoading(true)
        const data = await ebookService.getByInstructor(instructorId)
        setEbooks(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : '전자책을 불러오는데 실패했습니다')
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [instructorId])

  return { ebooks, loading, error }
}
