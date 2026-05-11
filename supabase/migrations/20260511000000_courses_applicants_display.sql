-- 강의 상세에서 "지금 N명 신청 중" 표시용 신청자 수 범위 + 새로고침 변동폭 + 매일 증가량
ALTER TABLE courses ADD COLUMN IF NOT EXISTS applicants_min INTEGER;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS applicants_max INTEGER;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS applicants_refresh_min INTEGER;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS applicants_refresh_max INTEGER;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS applicants_daily_growth INTEGER;
