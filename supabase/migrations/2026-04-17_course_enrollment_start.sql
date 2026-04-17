-- 강의 오픈일시 컬럼 추가
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS enrollment_start TIMESTAMPTZ;
