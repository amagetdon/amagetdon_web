-- 구매·포인트 보안 3단계-1: 관리자 전용 포인트 함수
-- 기존 add_points / insert_point_log 는 SECURITY DEFINER + 일반 회원 실행 가능 → 로그인 회원이 임의 계정·금액으로 포인트 지급 가능.
-- 관리자 화면(회원 관리)은 아래 관리자 전용 함수로 바꾸고, 기존 두 함수는 3단계-2 에서 일반 회원 실행 권한을 회수한다
-- (결제 승인 Edge Function 은 service_role 로 호출하므로 영향 없음).

CREATE OR REPLACE FUNCTION admin_add_points(user_id_input UUID, amount_input INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_balance INTEGER;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION '관리자만 포인트를 조정할 수 있습니다.'; END IF;
  UPDATE profiles SET points = COALESCE(points, 0) + amount_input WHERE id = user_id_input RETURNING points INTO v_balance;
  RETURN v_balance;
END;
$$;

CREATE OR REPLACE FUNCTION admin_insert_point_log(p_user_id UUID, p_amount INTEGER, p_balance INTEGER, p_type TEXT, p_memo TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION '관리자만 포인트 기록을 남길 수 있습니다.'; END IF;
  INSERT INTO point_logs (user_id, amount, balance, type, memo, admin_id)
  VALUES (p_user_id, p_amount, p_balance, p_type, p_memo, auth.uid());
END;
$$;

REVOKE ALL ON FUNCTION admin_add_points(UUID, INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION admin_insert_point_log(UUID, INTEGER, INTEGER, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_add_points(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_insert_point_log(UUID, INTEGER, INTEGER, TEXT, TEXT) TO authenticated;
