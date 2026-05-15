-- 랜딩 카테고리별 히어로 배너 노출 여부
-- false 면 /landing/:slug 상단의 히어로 배너 섹션을 숨긴다.
ALTER TABLE landing_categories
  ADD COLUMN IF NOT EXISTS show_hero BOOLEAN DEFAULT true;
