-- 강의에 전자책 묶어 주기 (2026-11-10) — 은우 다시보기 패키지(강의 139·142) 결제 시 전자책 21 자동 지급
-- courses.bundle_ebook_ids 에 넣은 전자책을, 그 강의 구매 행이 생길 때(카드·포인트·링크페이·무통장·관리자 부여 모두) 0원으로 함께 지급한다.
-- 묶음으로 받은 전자책 행은 bundle_parent_id 로 강의 구매에 매달려, 강의 구매를 지우면(전액 환불) 같이 지워진다.
-- 이미 그 전자책을 가진(만료 전) 사람에게는 다시 넣지 않는다.
-- 되돌리기: supabase/diagnostics/20261110_course_bundle_ebooks_rollback.sql

ALTER TABLE courses ADD COLUMN IF NOT EXISTS bundle_ebook_ids INTEGER[] NOT NULL DEFAULT '{}';
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS bundle_parent_id INTEGER REFERENCES purchases(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS purchases_bundle_parent_id_idx ON purchases (bundle_parent_id) WHERE bundle_parent_id IS NOT NULL;

CREATE OR REPLACE FUNCTION grant_bundle_ebooks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO purchases (user_id, ebook_id, title, price, original_price, expires_at, payment_method, bundle_parent_id)
  SELECT NEW.user_id, e.id, e.title, 0, 0,
         CASE WHEN coalesce(e.duration_days, 0) > 0 THEN now() + make_interval(days => e.duration_days) END,
         'bundle', NEW.id
    FROM courses c
    JOIN ebooks e ON e.id = ANY (c.bundle_ebook_ids)
   WHERE c.id = NEW.course_id
     AND NOT EXISTS (
       SELECT 1 FROM purchases p
        WHERE p.user_id = NEW.user_id AND p.ebook_id = e.id
          AND (p.expires_at IS NULL OR p.expires_at > now())
     );
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION grant_bundle_ebooks() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_grant_bundle_ebooks ON purchases;
CREATE TRIGGER trg_grant_bundle_ebooks
  AFTER INSERT ON purchases
  FOR EACH ROW
  WHEN (NEW.course_id IS NOT NULL AND NEW.user_id IS NOT NULL)
  EXECUTE FUNCTION grant_bundle_ebooks();

-- 은우 다시보기 패키지(할인 139·정가 142) → 전자책 3권 세트(21)
UPDATE courses SET bundle_ebook_ids = ARRAY[21] WHERE id IN (139, 142) AND instructor_id = 3;
