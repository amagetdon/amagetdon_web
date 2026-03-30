import HeroSection from '../components/HeroSection'
import FreeEbooks from '../components/FreeEbooks'
import ScheduleCalendar from '../components/ScheduleCalendar'
import FreeCourses from '../components/FreeCourses'
import RealResults from '../components/RealResults'
import InstructorSection from '../components/InstructorSection'
import BottomLinks from '../components/BottomLinks'

function HomePage() {
  return (
    <>
      <HeroSection />
      <FreeEbooks />
      <ScheduleCalendar />
      <FreeCourses />
      <RealResults />
      <InstructorSection />
      <BottomLinks />
    </>
  )
}

export default HomePage
