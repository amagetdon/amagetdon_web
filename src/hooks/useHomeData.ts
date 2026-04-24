import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { withTimeout } from '../lib/fetchWithTimeout'
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

async function fetchHomeData(year: number, month: number): Promise<HomeData> {
  const startDate = new Date(year, month - 1, 1).toISOString()
  const endDate = new Date(year, month, 0, 23, 59, 59).toISOString()

  const queries = [
    supabase.from('banners').select('*').eq('page_key', 'hero').eq('is_published', true).order('sort_order').then((r) => r),
    supabase.from('ebooks').select('*, instructor:instructors(id, name)').eq('is_free', true).order('sort_order').then((r) => r),
    supabase.from('courses').select('*, instructor:instructors(id, name)').eq('course_type', 'free').eq('is_published', true).or(`enrollment_start.is.null,enrollment_start.lte.${new Date().toISOString()}`).order('sort_order').then((r) => r),
    supabase.from('instructors').select('*').eq('is_published', true).order('sort_order').then((r) => r),
    supabase.from('results').select('*').order('sort_order').order('created_at', { ascending: false }).limit(4).then((r) => r),
    supabase.from('reviews').select('*, course:courses(id, title)').eq('is_published', true).gte('rating', 4).order('created_at', { ascending: false }).limit(10).then((r) => r),
    supabase.from('schedules').select('*, course:courses(id, title), instructor:instructors(id, name, image_url, thumbnail_url)').gte('scheduled_at', startDate).lte('scheduled_at', endDate).order('scheduled_at').then((r) => r),
    supabase.from('banners').select('*').eq('page_key', 'bottom_links').eq('is_published', true).order('sort_order').then((r) => r),
  ]

  const results = await Promise.allSettled(queries.map((q) => withTimeout(q, 15000)))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getData = (r: PromiseSettledResult<any>) => (r.status === 'fulfilled' ? (r.value.data ?? []) : [])
  const [hero, ebooks, courses, instructors, resultData, reviews, schedules, bottomLinks] = results

  return {
    heroBanners: getData(hero) as Banner[],
    freeEbooks: getData(ebooks) as EbookWithInstructor[],
    freeCourses: getData(courses) as CourseWithInstructor[],
    instructors: getData(instructors) as Instructor[],
    results: getData(resultData) as Result[],
    reviews: getData(reviews) as ReviewWithCourse[],
    schedules: getData(schedules) as ScheduleWithDetails[],
    bottomLinks: getData(bottomLinks) as Banner[],
  }
}

export function useHomeData(year: number, month: number) {
  const q = useQuery<HomeData>({
    queryKey: ['home-data', year, month],
    queryFn: () => fetchHomeData(year, month),
    // 홈 데이터는 비교적 오래 유지 — 탐색 중 반복 fetch 방지
    staleTime: 60_000,
  })
  return { data: q.data ?? EMPTY, loading: q.isLoading }
}
