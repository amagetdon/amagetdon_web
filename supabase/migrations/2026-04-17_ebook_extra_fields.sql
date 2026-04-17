-- 전자책 확장 필드: 판매 토글, 키워드, 강점·특징, SEO, 적립 포인트, 정원, 할인 기간, 관련 전자책
ALTER TABLE ebooks
  ADD COLUMN IF NOT EXISTS is_on_sale BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS search_keywords TEXT,
  ADD COLUMN IF NOT EXISTS strengths JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS seo JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS reward_points INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_purchases INTEGER,
  ADD COLUMN IF NOT EXISTS discount_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS discount_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS related_ebook_ids INTEGER[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_ebooks_related_ids ON ebooks USING GIN (related_ebook_ids);
