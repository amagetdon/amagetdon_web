-- 강의 상세 가격을 "월 N원 (M개월 할부 시)" 로 표시하기 위한 할부 개월수.
-- 0 이면 할부 미적용 — 원래 가격을 그대로 표시한다. 기본값 12개월.
ALTER TABLE courses ADD COLUMN IF NOT EXISTS installment_months INTEGER NOT NULL DEFAULT 12;
