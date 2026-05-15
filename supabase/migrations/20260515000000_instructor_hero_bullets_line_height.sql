-- 강사 히어로 카드 — 불릿(설명) 줄높이 강사별 조절 필드
-- Tailwind leading-snug(1.375)을 기본값으로 사용. 어드민에서 슬라이더로 조정.

ALTER TABLE instructors
  ADD COLUMN IF NOT EXISTS hero_bullets_line_height NUMERIC(4,3) NOT NULL DEFAULT 1.375;
