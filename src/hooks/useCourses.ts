import { useState, useEffect } from 'react'
import { courseService } from '../services/courseService'
import { useStaleRefreshKey } from './useVisibilityRefresh'
import { getCached } from '../lib/cache'
import type { CourseWithInstructor, CourseWithCurriculum } from '../types'

export function useCourses(type?: 'free' | 'premium') {
  const cacheKey = `courses:public:${type || 'all'}`
  const cached = getCached<CourseWithInstructor[]>(cacheKey)
  const [courses, setCourses] = useState<CourseWithInstructor[]>(cached || [])
  const [loading, setLoading] = useState(!cached)
  const [error, setError] = useState<string | null>(null)
  const refreshKey = useStaleRefreshKey()

  useEffect(() => {
    const fetch = async () => {
      try {
        if (!cached) setLoading(true)
        const data = await courseService.getAllPublic(type)
        setCourses(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : '강의를 불러오는데 실패했습니다')
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [type, refreshKey])

  return { courses, loading, error }
}

export function useCourse(id: number | null) {
  const [course, setCourse] = useState<CourseWithCurriculum | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const refreshKey = useStaleRefreshKey()

  useEffect(() => {
    if (!id) return
    const fetch = async () => {
      try {
        setLoading(true)
        const data = await courseService.getById(id)
        setCourse(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : '강의를 불러오는데 실패했습니다')
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [id, refreshKey])

  return { course, loading, error }
}

export function useCoursesByInstructor(instructorId: number | null) {
  const [courses, setCourses] = useState<CourseWithInstructor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const refreshKey = useStaleRefreshKey()

  useEffect(() => {
    if (!instructorId) return
    const fetch = async () => {
      try {
        setLoading(true)
        const data = await courseService.getByInstructor(instructorId)
        setCourses(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : '강의를 불러오는데 실패했습니다')
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [instructorId, refreshKey])

  return { courses, loading, error }
}
