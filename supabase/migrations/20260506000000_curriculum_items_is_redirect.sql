-- 커리큘럼 항목 — 영상이 아닌 외부 리다이렉트 링크 여부
-- true 인 경우 video_url 은 외부 페이지 URL 로 해석되어 새 탭으로 열린다.

ALTER TABLE curriculum_items
  ADD COLUMN IF NOT EXISTS is_redirect BOOLEAN NOT NULL DEFAULT false;
