-- 실시간 구매 현황(PurchaseFeed)용 RPC — 마스킹된 이름/이메일만 반환.
-- 기존에는 브라우저가 purchases → profiles(name, email, role) 를 직접 조인해 클라이언트에서 마스킹했고,
-- 이를 위해 profiles SELECT 가 전체 공개(true)였음(비로그인으로 전 회원 개인정보 조회 가능).
-- 이 RPC 로 바꾼 뒤 profiles SELECT 를 본인/관리자로 제한한다(20261012041000).
-- 마스킹 규칙은 PurchaseFeed.tsx 기존 규칙과 동일: 이름 첫 글자 + 나머지 *, 이메일 로컬 앞 3글자 + * (3~8), 내부 도메인 키워드 ***.

CREATE OR REPLACE FUNCTION get_purchase_feed(p_limit INTEGER DEFAULT 100)
RETURNS TABLE (
  id INTEGER,
  title TEXT,
  purchased_at TIMESTAMPTZ,
  course_id INTEGER,
  ebook_id INTEGER,
  masked_name TEXT,
  masked_email TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    pu.id,
    pu.title,
    pu.purchased_at,
    pu.course_id,
    pu.ebook_id,
    CASE
      WHEN COALESCE(btrim(pr.name), '') = '' THEN '익명'
      WHEN char_length(btrim(pr.name)) <= 1 THEN btrim(pr.name) || '**'
      ELSE left(btrim(pr.name), 1) || repeat('*', char_length(btrim(pr.name)) - 1)
    END,
    CASE
      WHEN COALESCE(pr.email, '') NOT LIKE '%_@_%' THEN ''
      ELSE left(split_part(btrim(pr.email), '@', 1), 3)
        || repeat('*', GREATEST(3, LEAST(8, char_length(split_part(btrim(pr.email), '@', 1)) - 3)))
        || '@' || regexp_replace(split_part(btrim(pr.email), '@', 2), 'min-company|amag-class', '***', 'gi')
    END
  FROM purchases pu
  LEFT JOIN profiles pr ON pr.id = pu.user_id
  WHERE COALESCE(pu.payment_method, '') <> 'admin'
    AND COALESCE(pr.role, 'user') <> 'admin'
  ORDER BY pu.purchased_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 100);
$$;

GRANT EXECUTE ON FUNCTION get_purchase_feed(INTEGER) TO anon, authenticated;
