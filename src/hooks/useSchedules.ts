import { useQuery } from '@tanstack/react-query'
import { scheduleService } from '../services/scheduleService'
import type { ScheduleWithDetails } from '../types'

export function useSchedules(year: number, month: number) {
  const q = useQuery<ScheduleWithDetails[]>({
    queryKey: ['schedules', year, month],
    queryFn: () => scheduleService.getByMonth(year, month),
    enabled: !!year && !!month,
  })
  return { schedules: q.data ?? [], loading: q.isLoading, error: q.error ? ((q.error as Error).message || '일정을 불러오는데 실패했습니다') : null }
}
