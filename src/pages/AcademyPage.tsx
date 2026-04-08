import HeroSection from '../components/HeroSection'
import ScheduleCalendar from '../components/ScheduleCalendar'
import FreeCourses from '../components/FreeCourses'
import VideoPromo from '../components/VideoPromo'
import FreeEbooks from '../components/FreeEbooks'
import SecretBooks from '../components/SecretBooks'
import CouponBanner from '../components/CouponBanner'

function AcademyPage() {
  return (
    <>
      <HeroSection />
      <VideoPromo />
      <ScheduleCalendar title="이달의 무료강의를 확인하세요" />
      <FreeCourses />
      <FreeEbooks />
      <CouponBanner />
      <SecretBooks />
    </>
  )
}

export default AcademyPage
