-- courses 에 비회원 구매 허용 플래그 추가
-- 이 필드가 true 인 강의는 랜딩 설정(landing_categories.allow_guest_purchase)과 무관하게
-- 로그인 없이도 신청(구매) 가능하다.
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS allow_guest_purchase BOOLEAN NOT NULL DEFAULT false;
