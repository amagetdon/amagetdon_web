export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'created_at' | 'updated_at'>
        Update: Partial<Omit<Profile, 'id' | 'created_at'>>
      }
      instructors: {
        Row: Instructor
        Insert: Omit<Instructor, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Instructor, 'id' | 'created_at'>>
      }
      courses: {
        Row: Course
        Insert: Omit<Course, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Course, 'id' | 'created_at'>>
      }
      curriculum_items: {
        Row: CurriculumItem
        Insert: Omit<CurriculumItem, 'id' | 'created_at'>
        Update: Partial<Omit<CurriculumItem, 'id' | 'created_at'>>
      }
      ebooks: {
        Row: Ebook
        Insert: Omit<Ebook, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Ebook, 'id' | 'created_at'>>
      }
      reviews: {
        Row: Review
        Insert: Omit<Review, 'id' | 'created_at'>
        Update: Partial<Omit<Review, 'id' | 'created_at'>>
      }
      results: {
        Row: Result
        Insert: Omit<Result, 'id' | 'created_at'>
        Update: Partial<Omit<Result, 'id' | 'created_at'>>
      }
      schedules: {
        Row: Schedule
        Insert: Omit<Schedule, 'id' | 'created_at'>
        Update: Partial<Omit<Schedule, 'id' | 'created_at'>>
      }
      faqs: {
        Row: Faq
        Insert: Omit<Faq, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Faq, 'id' | 'created_at'>>
      }
      purchases: {
        Row: Purchase
        Insert: Omit<Purchase, 'id'>
        Update: Partial<Omit<Purchase, 'id'>>
      }
      banners: {
        Row: Banner
        Insert: Omit<Banner, 'id' | 'created_at'>
        Update: Partial<Omit<Banner, 'id' | 'created_at'>>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      course_type: 'free' | 'premium'
      user_role: 'user' | 'admin'
    }
  }
}

export interface Profile {
  id: string
  name: string | null
  phone: string | null
  birth_date: string | null
  gender: 'male' | 'female' | null
  address: string | null
  points: number
  role: 'user' | 'admin'
  created_at: string
  updated_at: string
}

export interface Instructor {
  id: number
  name: string
  title: string
  headline: string | null
  bio: string | null
  bio_bullets: string[] | null
  careers: string[] | null
  image_url: string | null
  thumbnail_url: string | null
  has_active_course: boolean
  sort_order: number
  is_published: boolean
  created_at: string
  updated_at: string
}

export interface Course {
  id: number
  instructor_id: number | null
  title: string
  description: string | null
  thumbnail_url: string | null
  video_url: string | null
  landing_image_url: string | null
  original_price: number | null
  sale_price: number | null
  course_type: 'free' | 'premium'
  enrollment_deadline: string | null
  duration_days: number
  is_published: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface CourseWithInstructor extends Course {
  instructor: Pick<Instructor, 'id' | 'name'> | null
}

export interface CourseWithCurriculum extends Course {
  instructor: Pick<Instructor, 'id' | 'name'> | null
  curriculum_items: CurriculumItem[]
}

export interface CurriculumItem {
  id: number
  course_id: number
  week: number | null
  label: string
  video_url: string | null
  sort_order: number
  created_at: string
}

export interface Ebook {
  id: number
  instructor_id: number | null
  title: string
  thumbnail_url: string | null
  file_url: string | null
  original_price: number | null
  sale_price: number | null
  is_free: boolean
  is_hot: boolean
  is_published: boolean
  duration_days: number
  sort_order: number
  created_at: string
  updated_at: string
}

export interface EbookWithInstructor extends Ebook {
  instructor: Pick<Instructor, 'id' | 'name'> | null
}

export interface Review {
  id: number
  user_id: string | null
  course_id: number | null
  instructor_id: number | null
  author_name: string
  title: string
  content: string
  rating: number
  is_published: boolean
  created_at: string
}

export interface ReviewWithCourse extends Review {
  course: Pick<Course, 'id' | 'title'> | null
}

export interface Result {
  id: number
  user_id: string | null
  author_name: string
  title: string
  preview: string | null
  content: string
  image_url: string | null
  video_url: string | null
  link_url: string | null
  likes_count: number
  is_published: boolean
  created_at: string
}

export interface SiteSetting {
  id: number
  key: string
  value: Record<string, unknown>
  updated_at: string
}

export interface HeroContent {
  badge_text: string
  title: string
  image_url: string | null
}

export interface Schedule {
  id: number
  course_id: number | null
  instructor_id: number | null
  scheduled_at: string
  title: string
  created_at: string
}

export interface ScheduleWithDetails extends Schedule {
  course: Pick<Course, 'id' | 'title'> | null
  instructor: Pick<Instructor, 'id' | 'name'> | null
}

export interface Faq {
  id: number
  question: string
  answer: string
  video_url: string | null
  file_url: string | null
  file_name: string | null
  sort_order: number
  is_published: boolean
  created_at: string
  updated_at: string
}

export interface Purchase {
  id: number
  user_id: string
  course_id: number | null
  ebook_id: number | null
  title: string
  price: number
  purchased_at: string
  expires_at: string | null
}

export interface PurchaseWithDetails extends Purchase {
  course: CourseWithInstructor | null
  ebook: EbookWithInstructor | null
}

export interface CourseProgress {
  id: number
  user_id: string
  course_id: number
  curriculum_item_id: number
  is_completed: boolean
  completed_at: string | null
  last_watched_at: string
  created_at: string
}

export interface PointLog {
  id: number
  user_id: string
  amount: number
  balance: number
  type: 'charge' | 'deduct' | 'use' | 'refund'
  memo: string | null
  admin_id: string | null
  created_at: string
}

export interface Banner {
  id: number
  page_key: string
  title: string | null
  subtitle: string | null
  image_url: string
  link_url: string | null
  sort_order: number
  is_published: boolean
  created_at: string
}
