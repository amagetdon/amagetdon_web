-- 강의 자체에 단일 진행 일시를 둔다. 기존 schedules 테이블의 가장 최근 row 값을 백필.
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;

UPDATE courses c
SET scheduled_at = sub.scheduled_at
FROM (
  SELECT DISTINCT ON (course_id) course_id, scheduled_at
  FROM schedules
  WHERE course_id IS NOT NULL
  ORDER BY course_id, scheduled_at DESC
) sub
WHERE c.id = sub.course_id
  AND c.scheduled_at IS NULL;
