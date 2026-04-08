import { useState, useEffect } from 'react'
import { scheduleService } from '../services/scheduleService'
import { getCached } from '../lib/cache'
import type { ScheduleWithDetails } from '../types'

export function useSchedules(year: number, month: number) {
  const cacheKey = `schedules:${year}-${month}`
  const cached = getCached<ScheduleWithDetails[]>(cacheKey)
  const [schedules, setSchedules] = useState<ScheduleWithDetails[]>(cached || [])
  const [loading, setLoading] = useState(!cached)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!year || !month) {
      setLoading(false)
      return
    }
    const fetch = async () => {
      try {
        if (!cached) setLoading(true)
        const data = await scheduleService.getByMonth(year, month)
        setSchedules(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : '일정을 불러오는데 실패했습니다')
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [year, month])

  return { schedules, loading, error }
}
