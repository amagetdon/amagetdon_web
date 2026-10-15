-- 신청 카드·상단 배너 설정 칸 되돌리기 (20261016020000_apply_card_top_banner.sql 취소)
-- ⚠️ 관리자가 넣어 둔 신청 카드·배너 설정이 함께 지워짐(복구 불가). 강의·전자책의 다른 정보는 그대로.
ALTER TABLE courses DROP COLUMN IF EXISTS apply_card;
ALTER TABLE courses DROP COLUMN IF EXISTS top_banner;
ALTER TABLE ebooks  DROP COLUMN IF EXISTS apply_card;
ALTER TABLE ebooks  DROP COLUMN IF EXISTS top_banner;
