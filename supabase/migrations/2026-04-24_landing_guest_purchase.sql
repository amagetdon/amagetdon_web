-- landing_categories 에 비회원 구매 허용 플래그 추가
-- 이 필드가 true 인 랜딩페이지를 통해 접근한 강의는 로그인 없이도 구매 가능
ALTER TABLE landing_categories
  ADD COLUMN IF NOT EXISTS allow_guest_purchase BOOLEAN NOT NULL DEFAULT false;
