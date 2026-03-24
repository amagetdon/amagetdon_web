import { useState, useEffect } from 'react'
import { courseService } from '../services/courseService'
import type { CourseWithInstructor, CourseWithCurriculum } from '../types'

export function useCourses(type?: 'free' | 'premium') {
  const [courses, setCourses] = useState<CourseWithInstructor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetch = async () => {
      try {
        setLoading(true)
        const data = await courseService.getAll(type)
        setCourses(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : '강의를 불러오는데 실패했습니다')
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [type])

  return { courses, loading, error }
}

export function useCourse(id: number | null) {
  const [course, setCourse] = useState<CourseWithCurriculum | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
  }, [id])

  return { course, loading, error }
}

export function useCoursesByInstructor(instructorId: number | null) {
  const [courses, setCourses] = useState<CourseWithInstructor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
  }, [instructorId])

  return { courses, loading, error }
}
