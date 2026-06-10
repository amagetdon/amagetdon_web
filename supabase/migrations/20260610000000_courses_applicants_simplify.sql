-- "지금 N명 신청 중" 신청자 수 표시 단순화
-- 기존: 최소~최대 범위 + 새로고침 변동(min/max) → 변경: 최초 신청자 수 + 새로고침 변동 단계(1~3)
-- 동작: 최초 신청자 수에서 시작해 새로고침마다 +1~변동단계 만큼 위로만 증가. 매일 증가량은 유지.

ALTER TABLE courses ADD COLUMN IF NOT EXISTS applicants_initial INTEGER;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS applicants_refresh_step INTEGER;

-- 기존 데이터 백필 — 최소값을 최초 신청자 수로, 변동 최대값을 1~3 범위로 보정해 단계로 이관
UPDATE courses
SET applicants_initial = applicants_min
WHERE applicants_initial IS NULL AND applicants_min IS NOT NULL;

UPDATE courses
SET applicants_refresh_step = LEAST(3, GREATEST(1, COALESCE(applicants_refresh_max, 2)))
WHERE applicants_refresh_step IS NULL AND applicants_min IS NOT NULL;

-- 1~3 단계만 허용
ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_applicants_refresh_step_check;
ALTER TABLE courses ADD CONSTRAINT courses_applicants_refresh_step_check
  CHECK (applicants_refresh_step IS NULL OR applicants_refresh_step BETWEEN 1 AND 3);

-- 사용하지 않는 기존 컬럼 제거
ALTER TABLE courses DROP COLUMN IF EXISTS applicants_min;
ALTER TABLE courses DROP COLUMN IF EXISTS applicants_max;
ALTER TABLE courses DROP COLUMN IF EXISTS applicants_refresh_min;
ALTER TABLE courses DROP COLUMN IF EXISTS applicants_refresh_max;
