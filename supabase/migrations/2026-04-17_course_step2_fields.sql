-- 강의 2단계 필드: 정원/할인 기간/다중 카테고리/관련 강의
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS max_enrollments INTEGER,
  ADD COLUMN IF NOT EXISTS discount_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS discount_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS landing_category_ids INTEGER[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS related_course_ids INTEGER[] DEFAULT '{}';

-- 기존 landing_category_id 데이터를 landing_category_ids 배열로 복사 (1회성)
UPDATE courses
  SET landing_category_ids = ARRAY[landing_category_id]
  WHERE landing_category_id IS NOT NULL
    AND (landing_category_ids IS NULL OR landing_category_ids = '{}');

-- 배열 조회용 인덱스 (GIN)
CREATE INDEX IF NOT EXISTS idx_courses_landing_category_ids ON courses USING GIN (landing_category_ids);
CREATE INDEX IF NOT EXISTS idx_courses_related_course_ids ON courses USING GIN (related_course_ids);
