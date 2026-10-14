-- 관리자 회원 관리 목록을 한 번에 (2026-10-14)
-- 배경: 회원 관리가 profiles 5천여 행·purchases 6천여 행을 1,000행씩 13번 나눠 차례로 받아 브라우저에서 합산해 열 때 수 초 걸렸다.
-- 회원 행 + 회원별 구매 수·결제 합계를 DB 에서 계산해 JSON 배열 하나로 돌려준다(배열 하나라 1,000행 제한에 걸리지 않음).
-- 관리자만 호출 가능. 읽기 전용, 데이터·정책 변경 없음.

CREATE OR REPLACE FUNCTION admin_members_overview()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v JSONB;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION '관리자만 조회할 수 있습니다.';
  END IF;
  SELECT COALESCE(jsonb_agg(
           to_jsonb(p) || jsonb_build_object('purchaseCount', COALESCE(s.cnt, 0), 'totalSpent', COALESCE(s.total, 0))
           ORDER BY p.created_at DESC, p.id), '[]'::jsonb)
    INTO v
    FROM profiles p
    LEFT JOIN (SELECT user_id, count(*) AS cnt, sum(price) AS total FROM purchases GROUP BY user_id) s ON s.user_id = p.id;
  RETURN v;
END;
$$;

REVOKE ALL ON FUNCTION admin_members_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_members_overview() TO authenticated;
