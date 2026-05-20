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
        Insert: Omit<Purchase, 'id' | 'purchased_at'> & { purchased_at?: string }
        Update: Partial<Omit<Purchase, 'id'>>
      }
      banners: {
        Row: Banner
        Insert: Omit<Banner, 'id' | 'created_at'>
        Update: Partial<Omit<Banner, 'id' | 'created_at'>>
      }
      point_logs: {
        Row: PointLog
        Insert: Omit<PointLog, 'id' | 'created_at'>
        Update: Partial<Omit<PointLog, 'id' | 'created_at'>>
      }
      course_progress: {
        Row: CourseProgress
        Insert: Omit<CourseProgress, 'id' | 'created_at'>
        Update: Partial<Omit<CourseProgress, 'id' | 'created_at'>>
      }
      achievements: {
        Row: Achievement
        Insert: Omit<Achievement, 'id' | 'created_at'>
        Update: Partial<Omit<Achievement, 'id' | 'created_at'>>
      }
      landing_categories: {
        Row: LandingCategory
        Insert: Omit<LandingCategory, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<LandingCategory, 'id' | 'created_at'>>
      }
      refund_policy_templates: {
        Row: RefundPolicyTemplate
        Insert: Omit<RefundPolicyTemplate, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<RefundPolicyTemplate, 'id' | 'created_at'>>
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
  email: string | null
  name: string | null
  phone: string | null
  birth_date: string | null
  gender: 'male' | 'female' | null
  address: string | null
  points: number
  role: 'user' | 'admin'
  provider: string | null
  last_active_at: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_content: string | null
  utm_term: string | null
  signup_referrer: string | null
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
  // 홈 히어로 카드 (왼쪽 텍스트 + 오른쪽 누끼 이미지)
  hero_enabled: boolean
  hero_title: string | null
  hero_title_color: string
  hero_bg_from: string
  hero_bg_to: string
  hero_bullets: string[]
  hero_bullets_line_height: number
  hero_portrait_url: string | null
  hero_sort_order: number
  created_at: string
  updated_at: string
}

export interface CourseSeo {
  title?: string
  author?: string
  description?: string
  keywords?: string
  ogTitle?: string
  ogDescription?: string
  ogImage?: string
  twitterTitle?: string
  twitterDescription?: string
  twitterImage?: string
}

export interface Course {
  id: number
  instructor_id: number | null
  title: string
  description: string | null
  thumbnail_url: string | null
  video_url: string | null
  // 홍보 영상 대신 이미지로 노출하고 싶을 때. video_url 과 둘 중 택1로 사용.
  promo_image_url: string | null
  landing_image_url: string | null
  landing_image_urls: string[] | null
  landing_image_links: string[] | null
  original_price: number | null
  sale_price: number | null
  // 가격을 "월 N원 (M개월 할부 시)" 로 표시. 0 이면 할부 미적용(원가 그대로 표시).
  installment_months: number
  course_type: 'free' | 'premium'
  enrollment_start: string | null
  enrollment_deadline: string | null
  // 강의 진행 일시. UI 에서 강의일시로 입력받고 schedules 테이블과 1:1 동기화된다.
  scheduled_at: string | null
  // 강의별 알림톡 템플릿 변수. webhook-send 가 payload 에 자동 주입.
  webhook_variables: Record<string, string>
  duration_days: number
  is_published: boolean
  is_on_sale: boolean
  reviews_enabled: boolean
  search_keywords: string | null
  strengths: string[] | null
  features: string[] | null
  seo: CourseSeo | null
  reward_points: number
  max_enrollments: number | null
  discount_start: string | null
  discount_end: string | null
  landing_category_ids: number[] | null
  related_course_ids: number[] | null
  sort_order: number
  landing_category_id: number | null
  refund_policy: string | null
  after_purchase_url: string | null
  applicants_min: number | null
  applicants_max: number | null
  applicants_refresh_min: number | null
  applicants_refresh_max: number | null
  applicants_daily_growth: number | null
  created_at: string
  updated_at: string
}

export interface LandingCategorySeo {
  title?: string
  author?: string
  description?: string
  keywords?: string
  ogTitle?: string
  ogDescription?: string
  ogImage?: string
  twitterTitle?: string
  twitterDescription?: string
  twitterImage?: string
}

export type LandingCategoryType = 'course_list' | 'detail'

export interface LandingCategory {
  id: number
  slug: string
  name: string
  is_published: boolean
  allow_guest_purchase: boolean
  show_hero: boolean
  sort_order: number
  seo: LandingCategorySeo | null
  type: LandingCategoryType
  content_html: string | null
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

export interface CurriculumVideo {
  url: string
  is_redirect: boolean
  label?: string | null
}

export interface CurriculumItem {
  id: number
  course_id: number
  week: number | null
  label: string
  description: string | null
  // deprecated — 단일 URL 시절 컬럼. 새 코드는 video_urls 만 읽고 쓴다.
  video_url: string | null
  is_redirect: boolean
  // 한 항목에 들어가는 영상/외부 링크 목록. 마이그레이션으로 기존 video_url 데이터를 옮겨둠.
  video_urls: CurriculumVideo[]
  sort_order: number
  created_at: string
}

export interface EbookSeo {
  title?: string
  author?: string
  description?: string
  keywords?: string
  ogTitle?: string
  ogDescription?: string
  ogImage?: string
  twitterTitle?: string
  twitterDescription?: string
  twitterImage?: string
}

export interface Ebook {
  id: number
  instructor_id: number | null
  title: string
  thumbnail_url: string | null
  landing_image_url: string | null
  landing_image_urls: string[] | null
  landing_image_links: string[] | null
  file_url: string | null
  original_price: number | null
  sale_price: number | null
  is_free: boolean
  is_hot: boolean
  is_published: boolean
  is_on_sale: boolean
  open_date: string | null
  close_date: string | null
  duration_days: number
  search_keywords: string | null
  strengths: string[] | null
  features: string[] | null
  seo: EbookSeo | null
  reward_points: number
  max_purchases: number | null
  discount_start: string | null
  discount_end: string | null
  related_ebook_ids: number[] | null
  sort_order: number
  refund_policy: string | null
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
  email: string | null
  phone: string | null
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
  instructor: Pick<Instructor, 'id' | 'name' | 'image_url' | 'thumbnail_url'> | null
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
  coupon_id: number | null
  title: string
  original_price: number | null
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

export interface Achievement {
  id: number
  user_id: string
  author_name: string
  title: string
  content: string
  image_url: string | null
  course_id: number | null
  likes_count: number
  is_published: boolean
  created_at: string
}

export interface AchievementWithCourse extends Achievement {
  course: { id: number; title: string } | null
}

export interface Coupon {
  id: number
  title: string
  description: string | null
  discount_type: 'fixed' | 'percent'
  discount_value: number
  min_purchase: number
  max_discount: number | null
  brand_name: string | null
  banner_image_url: string | null
  banner_bg_color: string | null
  banner_text_color: string | null
  code: string
  max_claims: number | null
  claims_count: number
  use_days: number | null
  expires_at: string | null
  is_published: boolean
  // 적용 범위 — 'all' 전체, 'course' 강의(course_id 비면 전체 강의), 'ebook' 전자책(ebook_id 비면 전체 전자책)
  applies_to: 'all' | 'course' | 'ebook'
  course_id: number | null
  ebook_id: number | null
  // 쿠폰 받기 성공 후 이동할 채널 링크(빈 값이면 이동 없음)
  redirect_url: string | null
  created_at: string
}

export interface CouponClaim {
  id: number
  coupon_id: number
  user_id: string
  used_at: string | null
  claimed_at: string
}

export interface RefundPolicyTemplate {
  id: number
  name: string
  content: string
  sort_order: number
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface Banner {
  id: number
  page_key: string
  title: string | null
  subtitle: string | null
  image_url: string
  video_url: string | null
  media_type: 'image' | 'video'
  link_url: string | null
  overlay_opacity: number | null
  sort_order: number
  is_published: boolean
  created_at: string
  // 모바일 전용 변형 — 비어 있으면 PC 필드를 폴백으로 사용
  title_mobile: string | null
  subtitle_mobile: string | null
  image_url_mobile: string | null
  video_url_mobile: string | null
  overlay_opacity_mobile: number | null
}
