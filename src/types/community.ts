// 커뮤니티 '아마 돈 벌고 있을걸요?' — DB 표(20261022000000_community.sql)와 같은 모양

export type CommunityLevel = 'member' | 'buyer' | 'paid' | 'cohort' | 'staff'
export type CommunityBoardKind = 'normal' | 'qna' | 'notice'
export type CommunityBadge = 'instructor' | 'staff'
export type CommunityGrade = 's' | 'r' | 'm' | 't'
export type CommunityVerify = 'none' | 'pending' | 'approved' | 'rejected'
export type CommunityReportReason = 'ad' | 'abuse' | 'privacy' | 'fake' | 'etc'
export type CommunityReportStatus = 'open' | 'hidden' | 'dismissed' | 'deleted' | 'restored'
export type CommunityPinScope = 'home' | 'board'
export type CommunityPinLabel = 'notice' | 'must' | 'pin'
export type CommunityBannerColor = 'a' | 'b' | 'c'
export type CommunityNotificationKind = 'comment' | 'reply' | 'instructor_answer' | 'remind_instructor' | 'admin'

export interface CommunityBoardGroup {
  id: number
  name: string
  sort_order: number
}

export interface CommunityBoard {
  id: number
  group_id: number | null
  slug: string
  name: string
  description: string | null
  icon: string | null
  kind: CommunityBoardKind
  read_level: CommunityLevel
  write_level: CommunityLevel
  course_ids: number[]
  heads: string[]
  allow_images: boolean
  sort_order: number
  enabled: boolean
}

export interface CommunityMember {
  user_id: string
  nickname: string
  badge: CommunityBadge | null
  instructor_id: number | null
  grade: CommunityGrade
  onboarded_at: string | null
  created_at: string
}

export interface CommunityPost {
  id: number
  board_id: number
  author_id: string
  head: string | null
  title: string
  body: string
  revenue: number | null
  spend: number | null
  verify_status: CommunityVerify
  is_hidden: boolean
  hidden_reason: string | null
  deleted_at: string | null
  comment_count: number
  reaction_count: number
  view_count: number
  image_count: number
  instructor_answered_at: string | null
  created_at: string
  updated_at: string
}

/** 목록·상세에서 쓰는 글 + 작성자 닉네임·배지·등급 + 첫 사진 */
export interface CommunityPostView extends CommunityPost {
  author: Pick<CommunityMember, 'nickname' | 'badge' | 'grade'> | null
  thumb_path?: string | null
}

export interface CommunityPostImage {
  id: number
  post_id: number
  user_id: string
  path: string
  width: number | null
  height: number | null
  sort_order: number
}

export interface CommunityComment {
  id: number
  post_id: number
  parent_id: number | null
  author_id: string
  body: string
  is_instructor: boolean
  is_pinned: boolean
  is_hidden: boolean
  deleted_at: string | null
  created_at: string
  author?: Pick<CommunityMember, 'nickname' | 'badge' | 'grade'> | null
}

export interface CommunityReport {
  id: number
  target_type: 'post' | 'comment'
  target_id: number
  post_id: number
  reporter_id: string
  reason: CommunityReportReason
  detail: string | null
  status: CommunityReportStatus
  handled_by: string | null
  handled_at: string | null
  created_at: string
}

export interface CommunityPin {
  id: number
  post_id: number
  scope: CommunityPinScope
  label: CommunityPinLabel
  sort_order: number
}

export interface CommunityBanner {
  id: number
  eyebrow: string | null
  title: string
  subtitle: string | null
  button_text: string | null
  link_board_id: number | null
  link_url: string | null
  icon: string | null
  color: CommunityBannerColor
  sort_order: number
  enabled: boolean
}

export interface CommunityTile {
  id: number
  title: string
  subtitle: string | null
  icon: string | null
  link_board_id: number | null
  link_url: string | null
  highlight: boolean
  sort_order: number
  enabled: boolean
}

export interface CommunityBlockItem {
  id: number
  kind: 'word' | 'domain'
  value: string
}

export interface CommunitySanction {
  user_id: string
  suspended_until: string
  reason: string | null
}

export interface CommunityNotification {
  id: number
  user_id: string
  kind: CommunityNotificationKind
  post_id: number | null
  comment_id: number | null
  message: string | null
  read_at: string | null
  created_at: string
}

export interface CommunityAccess {
  logged_in: boolean
  buyer: boolean
  paid: boolean
  staff: boolean
  admin: boolean
  has_nickname: boolean
  suspended_until: string | null
}

export interface CommunityMyStats {
  posts: number
  commented: number
  liked: number
  saved: number
  cohorts: { board_id: number; name: string }[]
}

// ───── 화면 표시용 이름 ─────
export const HEAD_LABEL: Record<string, string> = { win: '됐다', fail: '안 됐다', stop: '멈춤', q: '질문' }
export const GRADE_INFO: Record<CommunityGrade | 'staff' | 'instructor', { icon: string; label: string }> = {
  s: { icon: 'ti-seedling', label: '새싹' },
  r: { icon: 'ti-run', label: '실행러' },
  m: { icon: 'ti-coin', label: '수익러' },
  t: { icon: 'ti-crown', label: '멘토' },
  staff: { icon: 'ti-shield-check', label: '스탭' },
  instructor: { icon: 'ti-school', label: '강사' },
}
export const LEVEL_LABEL: Record<CommunityLevel, string> = {
  member: '전체 회원',
  buyer: '무료 신청자 이상',
  paid: '유료 수강생',
  cohort: '이 기수만',
  staff: '스탭만',
}
export const REPORT_REASON_LABEL: Record<CommunityReportReason, string> = {
  ad: '광고·홍보',
  abuse: '욕설·비방',
  privacy: '개인정보 노출',
  fake: '허위 인증',
  etc: '기타',
}
export const PIN_LABEL: Record<CommunityPinLabel, string> = { notice: '공지', must: '필독', pin: '고정' }
