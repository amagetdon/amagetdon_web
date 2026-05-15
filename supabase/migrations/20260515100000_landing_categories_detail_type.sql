-- 랜딩 페이지 — 강의 그리드(course_list) 외에 자유 콘텐츠(detail) 타입 추가
-- detail 타입은 강의 매핑 대신 content_html(리치텍스트)을 풀폭으로 노출한다.

ALTER TABLE landing_categories
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'course_list',
  ADD COLUMN IF NOT EXISTS content_html TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'landing_categories' AND constraint_name = 'landing_categories_type_check'
  ) THEN
    ALTER TABLE landing_categories
      ADD CONSTRAINT landing_categories_type_check CHECK (type IN ('course_list', 'detail'));
  END IF;
END $$;
