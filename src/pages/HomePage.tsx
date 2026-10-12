import { useState } from 'react'
import { useHomeData } from '../hooks/useHomeData'
import HomeEbooks from '../components/HomeEbooks'
import ScheduleCalendar from '../components/ScheduleCalendar'
import FreeCourses from '../components/FreeCourses'
import PremiumCourses from '../components/PremiumCourses'
import RealResults from '../components/RealResults'
import InstructorSection from '../components/InstructorSection'
import BottomLinks from '../components/BottomLinks'
import CouponBanner from '../components/CouponBanner'

function HomePage() {
  const today = new Date()
  const [calYear] = useState(today.getFullYear())
  const [calMonth] = useState(today.getMonth() + 1)
  const { data, loading } = useHomeData(calYear, calMonth)

  return (
    <>
      <h1 className="sr-only">아마겟돈 클래스 — 실전 강사진의 온라인 강의와 전자책</h1>
      <HomeEbooks ebooks={data.freeEbooks} loading={loading} />
      <CouponBanner />
      <ScheduleCalendar schedules={data.schedules} />
      <PremiumCourses courses={data.premiumCourses} loading={loading} />
      <FreeCourses courses={data.freeCourses} loading={loading} />
      <RealResults results={data.results} reviews={data.reviews} loading={loading} />
      <InstructorSection instructors={data.instructors} loading={loading} />
      <BottomLinks links={data.bottomLinks} />
    </>
  )
}

export default HomePage
