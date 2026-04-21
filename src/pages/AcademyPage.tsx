import ScheduleCalendar from '../components/ScheduleCalendar'
import FreeCourses from '../components/FreeCourses'
import PremiumCourses from '../components/PremiumCourses'
import VideoPromo from '../components/VideoPromo'
import FreeEbooks from '../components/FreeEbooks'
import SecretBooks from '../components/SecretBooks'
import CouponBanner from '../components/CouponBanner'

function AcademyPage() {
  return (
    <>
      <VideoPromo />
      <ScheduleCalendar title="이달의 무료강의를 확인하세요" />
      <PremiumCourses />
      <FreeCourses />
      <FreeEbooks />
      <CouponBanner />
      <SecretBooks />
    </>
  )
}

export default AcademyPage
