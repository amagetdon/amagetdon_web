-- 강의 구매 직후 새창으로 띄울 외부 링크 (오픈채팅방 등). 비어 있으면 미사용.
ALTER TABLE courses ADD COLUMN IF NOT EXISTS after_purchase_url TEXT;
