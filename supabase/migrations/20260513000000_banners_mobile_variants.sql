-- 배너 PC/모바일 분리 — 모바일 전용 필드 추가
-- 비워두면 PC 필드를 폴백으로 사용

ALTER TABLE banners
  ADD COLUMN IF NOT EXISTS title_mobile           TEXT,
  ADD COLUMN IF NOT EXISTS subtitle_mobile        TEXT,
  ADD COLUMN IF NOT EXISTS image_url_mobile       TEXT,
  ADD COLUMN IF NOT EXISTS video_url_mobile       TEXT,
  ADD COLUMN IF NOT EXISTS overlay_opacity_mobile INTEGER;
