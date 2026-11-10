-- 되돌리기: 20261110000000_course_bundle_ebooks.sql
-- 묶음 지급을 멈춘다. 이미 묶음으로 받은 전자책은 남겨 두고(고객 열람 보호) 강의 구매와의 연결만 끊는다.
DROP TRIGGER IF EXISTS trg_grant_bundle_ebooks ON purchases;
DROP FUNCTION IF EXISTS grant_bundle_ebooks();
ALTER TABLE purchases DROP COLUMN IF EXISTS bundle_parent_id;
ALTER TABLE courses DROP COLUMN IF EXISTS bundle_ebook_ids;
