-- 되돌리기: 20261021000000_admin_set_purchase_price.sql
-- 금액 수정 함수를 지우고, 링크페이 부여 함수를 10/14 원래 모습(결제 완료 건만)으로 되돌린다. 이미 남은 감사 로그(price_change)는 지우지 않는다.
drop function if exists public.admin_set_purchase_price(integer, integer, text);

-- 아래는 supabase/migrations/20261014020000_linkpay_attach_rpc.sql 그대로
CREATE OR REPLACE FUNCTION admin_attach_linkpay_payment(
  p_linkpay_id BIGINT,
  p_user_id UUID,
  p_course_id INTEGER,
  p_ebook_id INTEGER,
  p_title TEXT,
  p_expires_at TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  l RECORD;
  v_pid INTEGER;
  v_mode TEXT;
  v_amount INTEGER;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION '관리자만 처리할 수 있습니다.';
  END IF;
  SELECT * INTO l FROM linkpay_payments WHERE id = p_linkpay_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION '링크페이 결제를 찾을 수 없습니다.'; END IF;
  IF l.granted AND l.purchase_id IS NOT NULL THEN RAISE EXCEPTION '이미 부여된 결제입니다.'; END IF;
  IF l.status IS DISTINCT FROM 'DONE' THEN RAISE EXCEPTION '결제 완료 건만 부여할 수 있습니다.'; END IF;
  IF p_user_id IS NULL THEN RAISE EXCEPTION '회원을 선택하세요.'; END IF;
  IF (p_course_id IS NULL) = (p_ebook_id IS NULL) THEN RAISE EXCEPTION '강의 또는 전자책 하나를 선택하세요.'; END IF;
  IF l.payment_key IS NOT NULL AND EXISTS (SELECT 1 FROM purchases WHERE payment_key = l.payment_key) THEN
    RAISE EXCEPTION '이 결제는 이미 다른 구매에 연결돼 있습니다.';
  END IF;
  v_amount := COALESCE(l.amount, 0);

  -- 1) 같은 회원·상품의 0원 수강권(수동 부여분)
  SELECT id INTO v_pid FROM purchases
   WHERE user_id = p_user_id AND price = 0 AND payment_key IS NULL
     AND ((p_course_id IS NOT NULL AND course_id = p_course_id) OR (p_ebook_id IS NOT NULL AND ebook_id = p_ebook_id))
   ORDER BY purchased_at
   LIMIT 1
   FOR UPDATE;
  IF v_pid IS NOT NULL THEN
    UPDATE purchases
       SET price = v_amount, original_price = v_amount, payment_method = 'linkpay', payment_key = l.payment_key,
           purchased_at = COALESCE(l.approved_at, purchased_at)
     WHERE id = v_pid;
    v_mode := 'attached';
  ELSE
    -- 2) 이미 유료 구매가 있으면 금액만 더한다 (차액·분할 결제)
    SELECT id INTO v_pid FROM purchases
     WHERE user_id = p_user_id AND price > 0
       AND ((p_course_id IS NOT NULL AND course_id = p_course_id) OR (p_ebook_id IS NOT NULL AND ebook_id = p_ebook_id))
     ORDER BY purchased_at
     LIMIT 1
     FOR UPDATE;
    IF v_pid IS NOT NULL THEN
      UPDATE purchases
         SET price = price + v_amount, original_price = COALESCE(original_price, price) + v_amount
       WHERE id = v_pid;
      v_mode := 'top_up';
    ELSE
      -- 3) 새 구매
      INSERT INTO purchases (user_id, course_id, ebook_id, title, price, original_price, payment_key, payment_method, expires_at, purchased_at)
      VALUES (p_user_id, p_course_id, p_ebook_id, COALESCE(NULLIF(p_title, ''), l.order_name, '링크페이 결제'),
              v_amount, v_amount, l.payment_key, 'linkpay', p_expires_at, COALESCE(l.approved_at, now()))
      RETURNING id INTO v_pid;
      v_mode := 'inserted';
    END IF;
  END IF;

  UPDATE linkpay_payments
     SET granted = true, purchase_id = v_pid, matched_user_id = p_user_id,
         course_id = p_course_id, ebook_id = p_ebook_id, updated_at = now()
   WHERE id = p_linkpay_id;

  INSERT INTO purchase_audit_logs (action, purchase_id, actor_id, after)
  VALUES ('linkpay_attach', v_pid, auth.uid(),
          jsonb_build_object('linkpay_id', p_linkpay_id, 'mode', v_mode, 'amount', v_amount));

  RETURN jsonb_build_object('purchase_id', v_pid, 'mode', v_mode, 'amount', v_amount);
END;
$$;

REVOKE ALL ON FUNCTION admin_attach_linkpay_payment(BIGINT, UUID, INTEGER, INTEGER, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_attach_linkpay_payment(BIGINT, UUID, INTEGER, INTEGER, TEXT, TIMESTAMPTZ) TO authenticated;
