import { useState, useEffect } from 'react'
import { scheduleService } from '../services/scheduleService'
import type { ScheduleWithDetails } from '../types'

export function useSchedules(year: number, month: number) {
  const [schedules, setSchedules] = useState<ScheduleWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!year || !month) {
      setLoading(false)
      return
    }
    const fetch = async () => {
      try {
        setLoading(true)
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
