-- 무료 신청을 서버 함수로 이전 (구매·포인트 보안 1단계)
-- 기존: 브라우저가 purchases 에 직접 insert(정책 purchases_insert: auth.uid() = user_id) + add_points RPC 로 적립.
--       → 로그인 회원이 유료 강의 구매 행을 결제 없이 만들 수 있었음.
-- 이 함수는 DB 값으로 무료 여부·판매 중·모집 기간·정원·보유 여부를 검사한 뒤 등록하고 수강 적립금을 지급한다.
-- 검사 규칙은 CourseDetailPage / EbookDetailPage 화면 규칙과 동일. 관리자는 조건 없이 등록(기존 '관리자 권한 구매').
-- purchases_insert 정책 회수는 포인트 구매까지 서버로 옮긴 뒤 별도 단계에서.

CREATE OR REPLACE FUNCTION enroll_free(p_kind TEXT, p_id INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_admin BOOLEAN := is_admin();
  v_title TEXT;
  v_reward INTEGER := 0;
  v_expires TIMESTAMPTZ;
  v_balance INTEGER;
  c RECORD;
  e RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  IF p_kind = 'course' THEN
    SELECT * INTO c FROM courses WHERE id = p_id;
    IF NOT FOUND THEN RAISE EXCEPTION '강의를 찾을 수 없습니다.'; END IF;
    IF EXISTS (SELECT 1 FROM purchases WHERE user_id = v_uid AND course_id = p_id) THEN
      RAISE EXCEPTION '이미 등록한 상품입니다.';
    END IF;
    IF NOT v_admin THEN
      IF c.course_type NOT IN ('free', 'pre_alert') THEN RAISE EXCEPTION '무료 강의가 아닙니다.'; END IF;
      IF c.is_on_sale IS FALSE THEN RAISE EXCEPTION '판매 준비 중인 강의입니다.'; END IF;
      IF c.course_type <> 'pre_alert' AND c.enrollment_start IS NOT NULL AND c.enrollment_start > now() THEN
        RAISE EXCEPTION '아직 오픈되지 않은 강의입니다.';
      END IF;
      IF c.enrollment_deadline IS NOT NULL AND c.enrollment_deadline <= now() THEN
        RAISE EXCEPTION '모집이 마감된 강의입니다.';
      END IF;
      IF COALESCE(c.max_enrollments, 0) > 0
         AND (SELECT count(*) FROM purchases WHERE course_id = p_id) >= c.max_enrollments THEN
        RAISE EXCEPTION '정원이 마감된 강의입니다.';
      END IF;
    END IF;
    v_title := c.title;
    v_reward := COALESCE(c.reward_points, 0);
    -- 화면 규칙: 모집 마감일이 있으면 마감일부터 duration_days, 없으면 무제한
    v_expires := CASE WHEN c.enrollment_deadline IS NOT NULL AND COALESCE(c.duration_days, 0) > 0
                      THEN c.enrollment_deadline + make_interval(days => c.duration_days) END;
    INSERT INTO purchases (user_id, course_id, title, price, expires_at)
    VALUES (v_uid, p_id, v_title, 0, v_expires);

  ELSIF p_kind = 'ebook' THEN
    SELECT * INTO e FROM ebooks WHERE id = p_id;
    IF NOT FOUND THEN RAISE EXCEPTION '전자책을 찾을 수 없습니다.'; END IF;
    IF EXISTS (SELECT 1 FROM purchases WHERE user_id = v_uid AND ebook_id = p_id) THEN
      RAISE EXCEPTION '이미 등록한 상품입니다.';
    END IF;
    IF NOT v_admin THEN
      IF e.is_free IS NOT TRUE THEN RAISE EXCEPTION '무료 전자책이 아닙니다.'; END IF;
      IF e.is_on_sale IS FALSE THEN RAISE EXCEPTION '판매 준비 중인 전자책입니다.'; END IF;
      IF e.close_date IS NOT NULL AND e.close_date <= now() THEN RAISE EXCEPTION '판매가 마감된 전자책입니다.'; END IF;
    END IF;
    v_title := e.title;
    v_reward := COALESCE(e.reward_points, 0);
    -- 화면 규칙: 지금부터 duration_days, 없으면 무제한
    v_expires := CASE WHEN COALESCE(e.duration_days, 0) > 0 THEN now() + make_interval(days => e.duration_days) END;
    INSERT INTO purchases (user_id, ebook_id, title, price, expires_at)
    VALUES (v_uid, p_id, v_title, 0, v_expires);

  ELSE
    RAISE EXCEPTION '잘못된 상품입니다.';
  END IF;

  -- 수강 적립 (기존 grantPurchaseRewardPoints 와 동일한 기록 형식)
  IF v_reward > 0 THEN
    UPDATE profiles SET points = COALESCE(points, 0) + v_reward WHERE id = v_uid RETURNING points INTO v_balance;
    INSERT INTO point_logs (user_id, amount, balance, type, memo)
    VALUES (v_uid, v_reward, v_balance, 'charge', v_title || ' 수강 적립');
  END IF;

  RETURN jsonb_build_object('title', v_title, 'expires_at', v_expires, 'reward', v_reward);
END;
$$;

REVOKE ALL ON FUNCTION enroll_free(TEXT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION enroll_free(TEXT, INTEGER) TO authenticated;
