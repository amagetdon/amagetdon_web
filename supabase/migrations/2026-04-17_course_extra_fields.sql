-- 강의 추가 필드: 판매/리뷰 토글, 연관 키워드, 강점·특징, 강의별 SEO, 지급 포인트
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS is_on_sale BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS reviews_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS search_keywords TEXT,
  ADD COLUMN IF NOT EXISTS strengths JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS seo JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS reward_points INTEGER DEFAULT 0;
