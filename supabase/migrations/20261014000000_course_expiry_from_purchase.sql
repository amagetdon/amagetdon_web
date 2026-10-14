-- 강의 수강 기간 자동 부여 규칙 변경 (2026-10-14)
-- 기존: 모집 마감일이 있을 때만 '마감일 + 다시보기(duration_days)', 마감일이 비어 있으면 무제한(NULL)
--       → 마감일을 비워 둔 강의(웨비나 등)는 신청자 전원이 무제한으로 저장되던 문제.
-- 변경: 마감일이 있으면 지금처럼 '마감일 + 다시보기', 없으면 '신청 시점 + 다시보기'. 다시보기 0 이면 무제한.
-- 함수 본문은 20261012050000_enroll_free_rpc.sql / 20261012060000_purchase_with_points_rpc.sql 그대로이고
-- 강의(course) 수강 기간 식 한 곳씩만 바뀐다. 전자책·뉴스레터 규칙은 변경 없음.
-- 이미 저장된 구매(purchases.expires_at)는 건드리지 않는다 — 앞으로의 신청·구매에만 적용.

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
    -- 수강 기간: 모집 마감일이 있으면 마감일부터, 없으면 신청 시점부터 duration_days (0 이면 무제한)
    v_expires := CASE WHEN COALESCE(c.duration_days, 0) <= 0 THEN NULL
                      WHEN c.enrollment_deadline IS NOT NULL THEN c.enrollment_deadline + make_interval(days => c.duration_days)
                      ELSE now() + make_interval(days => c.duration_days) END;
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

CREATE OR REPLACE FUNCTION purchase_with_points(p_kind TEXT, p_id INTEGER, p_coupon_id INTEGER DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_title TEXT;
  v_price INTEGER := 0;
  v_discount INTEGER := 0;
  v_final INTEGER;
  v_reward INTEGER := 0;
  v_expires TIMESTAMPTZ;
  v_points INTEGER;
  v_balance INTEGER;
  v_disc_active BOOLEAN;
  c RECORD; e RECORD; b RECORD; cp RECORD; cl RECORD;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION '로그인이 필요합니다.'; END IF;

  -- 1) 상품 검증 + 가격 산정
  IF p_kind = 'course' THEN
    SELECT * INTO c FROM courses WHERE id = p_id;
    IF NOT FOUND THEN RAISE EXCEPTION '강의를 찾을 수 없습니다.'; END IF;
    IF EXISTS (SELECT 1 FROM purchases WHERE user_id = v_uid AND course_id = p_id) THEN RAISE EXCEPTION '이미 구매한 상품입니다.'; END IF;
    IF c.is_on_sale IS FALSE THEN RAISE EXCEPTION '판매 준비 중인 강의입니다.'; END IF;
    IF c.course_type <> 'pre_alert' AND c.enrollment_start IS NOT NULL AND c.enrollment_start > now() THEN RAISE EXCEPTION '아직 오픈되지 않은 강의입니다.'; END IF;
    IF c.enrollment_deadline IS NOT NULL AND c.enrollment_deadline <= now() THEN RAISE EXCEPTION '모집이 마감된 강의입니다.'; END IF;
    IF COALESCE(c.max_enrollments, 0) > 0 AND (SELECT count(*) FROM purchases WHERE course_id = p_id) >= c.max_enrollments THEN RAISE EXCEPTION '정원이 마감된 강의입니다.'; END IF;
    v_disc_active := c.course_type <> 'free' AND (
      (c.discount_start IS NULL AND c.discount_end IS NULL) OR
      ((c.discount_start IS NULL OR c.discount_start <= now()) AND (c.discount_end IS NULL OR c.discount_end > now())));
    v_price := CASE
      WHEN c.course_type = 'free' OR c.sale_price = 0 THEN 0
      WHEN v_disc_active AND COALESCE(c.sale_price, 0) > 0 THEN c.sale_price
      ELSE COALESCE(c.original_price, 0) END;
    v_title := c.title;
    v_reward := COALESCE(c.reward_points, 0);
    v_expires := CASE WHEN COALESCE(c.duration_days, 0) <= 0 THEN NULL
                      WHEN c.enrollment_deadline IS NOT NULL THEN c.enrollment_deadline + make_interval(days => c.duration_days)
                      ELSE now() + make_interval(days => c.duration_days) END;

  ELSIF p_kind = 'ebook' THEN
    SELECT * INTO e FROM ebooks WHERE id = p_id;
    IF NOT FOUND THEN RAISE EXCEPTION '전자책을 찾을 수 없습니다.'; END IF;
    IF EXISTS (SELECT 1 FROM purchases WHERE user_id = v_uid AND ebook_id = p_id) THEN RAISE EXCEPTION '이미 구매한 상품입니다.'; END IF;
    IF e.is_on_sale IS FALSE THEN RAISE EXCEPTION '판매 준비 중인 전자책입니다.'; END IF;
    IF e.close_date IS NOT NULL AND e.close_date <= now() THEN RAISE EXCEPTION '판매가 마감된 전자책입니다.'; END IF;
    v_disc_active := e.is_free IS NOT TRUE AND (
      (e.discount_start IS NULL AND e.discount_end IS NULL) OR
      ((e.discount_start IS NULL OR e.discount_start <= now()) AND (e.discount_end IS NULL OR e.discount_end > now())));
    v_price := CASE
      WHEN e.is_free IS TRUE THEN 0
      WHEN v_disc_active AND e.sale_price IS NOT NULL THEN e.sale_price
      ELSE COALESCE(e.original_price, e.sale_price, 0) END;
    v_title := e.title;
    v_reward := COALESCE(e.reward_points, 0);
    v_expires := CASE WHEN COALESCE(e.duration_days, 0) > 0 THEN now() + make_interval(days => e.duration_days) END;

  ELSIF p_kind = 'board_post' THEN
    IF p_coupon_id IS NOT NULL THEN RAISE EXCEPTION '뉴스레터 글에는 쿠폰을 사용할 수 없습니다.'; END IF;
    SELECT * INTO b FROM board_posts WHERE id = p_id;
    IF NOT FOUND THEN RAISE EXCEPTION '글을 찾을 수 없습니다.'; END IF;
    IF b.is_paid IS NOT TRUE OR COALESCE(b.price, 0) <= 0 THEN RAISE EXCEPTION '단건 구매할 수 없는 글입니다.'; END IF;
    IF EXISTS (SELECT 1 FROM purchases WHERE user_id = v_uid AND board_post_id = p_id) THEN RAISE EXCEPTION '이미 구매한 글입니다.'; END IF;
    v_price := b.price;
    v_title := b.title;
    v_expires := NULL; -- 단건 구매는 영구 열람

  ELSE
    RAISE EXCEPTION '잘못된 상품입니다.';
  END IF;

  -- 2) 쿠폰 검증 + 할인 (CouponSelector / 상세 페이지 규칙)
  IF p_coupon_id IS NOT NULL THEN
    SELECT * INTO cl FROM coupon_claims WHERE coupon_id = p_coupon_id AND user_id = v_uid AND used_at IS NULL LIMIT 1 FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION '사용할 수 없는 쿠폰입니다.'; END IF;
    SELECT * INTO cp FROM coupons WHERE id = p_coupon_id;
    IF NOT FOUND OR cp.is_published IS NOT TRUE THEN RAISE EXCEPTION '사용할 수 없는 쿠폰입니다.'; END IF;
    IF cp.expires_at IS NOT NULL AND cp.expires_at < now() THEN RAISE EXCEPTION '만료된 쿠폰입니다.'; END IF;
    IF COALESCE(cp.use_days, 0) > 0 AND cl.claimed_at IS NOT NULL AND cl.claimed_at + make_interval(days => cp.use_days) < now() THEN
      RAISE EXCEPTION '만료된 쿠폰입니다.';
    END IF;
    IF NOT (cp.applies_to = 'all'
         OR (cp.applies_to = 'course' AND p_kind = 'course' AND (cp.course_id IS NULL OR cp.course_id = p_id))
         OR (cp.applies_to = 'ebook' AND p_kind = 'ebook' AND (cp.ebook_id IS NULL OR cp.ebook_id = p_id))) THEN
      RAISE EXCEPTION '이 상품에 사용할 수 없는 쿠폰입니다.';
    END IF;
    IF v_price < COALESCE(cp.min_purchase, 0) THEN RAISE EXCEPTION '쿠폰 최소 구매 금액을 충족하지 않습니다.'; END IF;
    v_discount := CASE WHEN cp.discount_type = 'percent'
      THEN LEAST(floor(v_price * cp.discount_value / 100.0)::INTEGER, COALESCE(NULLIF(cp.max_discount, 0), v_price), v_price)
      ELSE LEAST(cp.discount_value, v_price) END;
    UPDATE coupon_claims SET used_at = now() WHERE id = cl.id;
  END IF;
  v_final := GREATEST(0, v_price - v_discount);

  -- 3) 포인트 차감 (행 잠금으로 동시 구매 방지)
  SELECT COALESCE(points, 0) INTO v_points FROM profiles WHERE id = v_uid FOR UPDATE;
  IF v_points < v_final THEN RAISE EXCEPTION '포인트가 부족합니다.'; END IF;
  v_balance := v_points - v_final;
  UPDATE profiles SET points = v_balance WHERE id = v_uid;

  -- 4) 구매 행 (기존 클라이언트 insert 와 같은 컬럼)
  INSERT INTO purchases (user_id, course_id, ebook_id, board_post_id, coupon_id, title, original_price, price, expires_at)
  VALUES (v_uid,
          CASE WHEN p_kind = 'course' THEN p_id END,
          CASE WHEN p_kind = 'ebook' THEN p_id END,
          CASE WHEN p_kind = 'board_post' THEN p_id END,
          p_coupon_id, v_title, v_price, v_final, v_expires);

  INSERT INTO point_logs (user_id, amount, balance, type, memo)
  VALUES (v_uid, -v_final, v_balance, 'use', v_title || ' 구매');

  -- 5) 수강 적립 (강의·전자책)
  IF v_reward > 0 THEN
    UPDATE profiles SET points = points + v_reward WHERE id = v_uid RETURNING points INTO v_balance;
    INSERT INTO point_logs (user_id, amount, balance, type, memo)
    VALUES (v_uid, v_reward, v_balance, 'charge', v_title || ' 수강 적립');
  END IF;

  RETURN jsonb_build_object('title', v_title, 'price', v_price, 'discount', v_discount, 'final_price', v_final,
                            'expires_at', v_expires, 'reward', v_reward, 'balance', v_balance);
END;
$$;

REVOKE ALL ON FUNCTION purchase_with_points(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION purchase_with_points(TEXT, INTEGER, INTEGER) TO authenticated;
