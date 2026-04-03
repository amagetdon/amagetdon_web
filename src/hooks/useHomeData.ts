import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type {
  Banner,
  CourseWithInstructor,
  EbookWithInstructor,
  Instructor,
  Result,
  ReviewWithCourse,
  ScheduleWithDetails,
} from '../types'

interface HomeData {
  heroBanners: Banner[]
  freeEbooks: EbookWithInstructor[]
  freeCourses: CourseWithInstructor[]
  instructors: Instructor[]
  results: Result[]
  reviews: ReviewWithCourse[]
  schedules: ScheduleWithDetails[]
  bottomLinks: Banner[]
}

const EMPTY: HomeData = {
  heroBanners: [],
  freeEbooks: [],
  freeCourses: [],
  instructors: [],
  results: [],
  reviews: [],
  schedules: [],
  bottomLinks: [],
}

import { withTimeout } from '../lib/fetchWithTimeout'

export function useHomeData(year: number, month: number) {
  const [data, setData] = useState<HomeData>(EMPTY)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const startDate = new Date(year, month - 1, 1).toISOString()
    const endDate = new Date(year, month, 0, 23, 59, 59).toISOString()

    const load = async (attempt = 1) => {
      try {
        const queries = [
          supabase.from('banners').select('*').eq('page_key', 'hero').eq('is_published', true).order('sort_order'),
          supabase.from('ebooks').select('*, instructor:instructors(id, name)').eq('is_free', true).order('sort_order'),
          supabase.from('courses').select('*, instructor:instructors(id, name)').eq('course_type', 'free').order('sort_order'),
          supabase.from('instructors').select('*').eq('is_published', true).order('sort_order'),
          supabase.from('results').select('*').order('sort_order').order('created_at', { ascending: false }).limit(4),
          supabase.from('reviews').select('*, course:courses(id, title)').eq('is_published', true).order('created_at', { ascending: false }).limit(5),
          supabase.from('schedules').select('*, course:courses(id, title), instructor:instructors(id, name)').gte('scheduled_at', startDate).lte('scheduled_at', endDate).order('scheduled_at'),
          supabase.from('banners').select('*').eq('page_key', 'bottom_links').eq('is_published', true).order('sort_order'),
        ]

        const results = await Promise.allSettled(queries.map((q) => withTimeout(q, 15000)))

        if (cancelled) return

        const getValue = <T,>(r: PromiseSettledResult<{ data: T | null }>, fallback: T): T =>
          r.status === 'fulfilled' ? (r.data ?? fallback) : fallback

        const [hero, ebooks, courses, instructors, resultData, reviews, schedules, bottomLinks] = results
        setData({
          heroBanners: getValue(hero, []) as Banner[],
          freeEbooks: getValue(ebooks, []) as EbookWithInstructor[],
          freeCourses: getValue(courses, []) as CourseWithInstructor[],
          instructors: getValue(instructors, []) as Instructor[],
          results: getValue(resultData, []) as Result[],
          reviews: getValue(reviews, []) as ReviewWithCourse[],
          schedules: getValue(schedules, []) as ScheduleWithDetails[],
          bottomLinks: getValue(bottomLinks, []) as Banner[],
        })
      } catch {
        if (!cancelled && attempt < 3) {
          await new Promise((r) => setTimeout(r, 1000 * attempt))
          return load(attempt + 1)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [year, month])

  return { data, loading }
}
