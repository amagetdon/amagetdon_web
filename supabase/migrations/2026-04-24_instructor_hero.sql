-- instructors 테이블에 홈 히어로 카드 필드 추가
-- (왼쪽 제목/이름/직함/불릿 + 오른쪽 누끼 이미지 + 그라데이션 배경)
-- ON/OFF 는 hero_enabled 로 제어. 기존 thumbnail_url 캐러셀 대체.

ALTER TABLE instructors
  ADD COLUMN IF NOT EXISTS hero_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hero_title TEXT,
  ADD COLUMN IF NOT EXISTS hero_title_color TEXT NOT NULL DEFAULT '#FFFFFF',
  ADD COLUMN IF NOT EXISTS hero_bg_from TEXT NOT NULL DEFAULT '#1a1a1a',
  ADD COLUMN IF NOT EXISTS hero_bg_to TEXT NOT NULL DEFAULT '#2a2a2a',
  ADD COLUMN IF NOT EXISTS hero_bullets JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS hero_portrait_url TEXT,
  ADD COLUMN IF NOT EXISTS hero_sort_order INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_instructors_hero_enabled ON instructors (hero_enabled, hero_sort_order) WHERE hero_enabled = true;
