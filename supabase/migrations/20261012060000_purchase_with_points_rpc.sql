-- 포인트 구매를 서버 함수로 이전 (구매·포인트 보안 2단계)
-- 기존: 브라우저가 가격·쿠폰 할인을 계산 → profiles.points 직접 차감 → purchases 직접 insert → 실패 시 add_points 로 복구.
--       → 가격/쿠폰/포인트를 브라우저가 정하므로 조작 가능.
-- 이 함수는 가격(정가·할인 기간·무료 여부)과 쿠폰(보유·미사용·게시·만료·use_days·적용 범위·최소 금액)을 DB 값으로 다시 계산하고,
-- 포인트 차감·구매 행 생성·쿠폰 사용 처리·포인트 로그·수강 적립을 한 트랜잭션으로 처리한다(중간 실패 시 전체 취소).
-- 계산 규칙은 CourseDetailPage / EbookDetailPage / CouponSelector / BoardCheckoutModal 화면 규칙과 동일.
-- p_kind: course | ebook | board_post (뉴스레터 글 단건 — 화면상 포인트는 글 단건만 허용, 구독은 카드 전용)

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
    v_expires := CASE WHEN c.enrollment_deadline IS NOT NULL AND COALESCE(c.duration_days, 0) > 0
                      THEN c.enrollment_deadline + make_interval(days => c.duration_days) END;

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
