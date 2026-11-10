-- 되돌리기: 20261105000000_eunwoo_replay_products.sql
-- 먼저 웹 코드(목록 필터)를 되돌린 뒤 실행한다. 칼럼을 먼저 지우면 강의·전자책 목록이 오류가 난다.
-- 구매가 생긴 상품은 지우지 않고 멈춘다(이미 결제한 고객 기록 보호).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM purchases p
     WHERE p.course_id IN (SELECT id FROM courses WHERE is_unlisted AND instructor_id = 3)
        OR p.ebook_id IN (SELECT id FROM ebooks WHERE is_unlisted AND instructor_id = 3)
  ) THEN
    RAISE EXCEPTION '구매가 있는 상품이 있어 되돌리지 않습니다.';
  END IF;
  DELETE FROM courses WHERE is_unlisted AND instructor_id = 3;
  DELETE FROM ebooks WHERE is_unlisted AND instructor_id = 3;
END $$;
ALTER TABLE courses DROP COLUMN IF EXISTS is_unlisted;
ALTER TABLE ebooks DROP COLUMN IF EXISTS is_unlisted;
