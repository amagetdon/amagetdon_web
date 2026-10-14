-- 이미 부여된 링크페이 결제를 다른 수강생 계정(또는 강의)으로 옮기는 관리자 함수 (2026-10-14)
-- 배경: 결제자 번호로 엉뚱한 계정에 붙었거나(가족·회사 결제), 결제 기록은 '부여됨'인데 구매 연결이 끊긴 건을 화면에서 바로잡을 수 없었다.
-- 1) 기존 구매에서 이 결제를 뺀다
--    - 구매 금액이 이 결제 금액보다 크면(분할·차액 합산된 구매) → 금액만 뺀다
--    - 아니면 → p_revoke_old = true: 그 구매(수강권) 삭제 / false: 0원 수강권으로 되돌림(접근은 유지)
--    - 연결이 끊긴 결제(purchase_id 없음)는 뺄 것이 없다
-- 2) 새 계정·강의에 붙인다 — admin_attach_linkpay_payment 와 같은 규칙(0원 채움 / 유료 합산 / 새 구매)
-- 처리 내역은 purchase_audit_logs 'linkpay_move' 로 남는다(삭제된 구매는 삭제 트리거가 원본을 남김).

CREATE OR REPLACE FUNCTION admin_move_linkpay_payment(
  p_linkpay_id BIGINT,
  p_user_id UUID,
  p_course_id INTEGER,
  p_ebook_id INTEGER,
  p_title TEXT,
  p_expires_at TIMESTAMPTZ,
  p_revoke_old BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  l RECORD;
  o RECORD;
  v_amount INTEGER;
  v_old_action TEXT := 'none';
  v_pid INTEGER;
  v_mode TEXT;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION '관리자만 처리할 수 있습니다.'; END IF;
  SELECT * INTO l FROM linkpay_payments WHERE id = p_linkpay_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION '링크페이 결제를 찾을 수 없습니다.'; END IF;
  IF NOT l.granted THEN RAISE EXCEPTION '아직 부여되지 않은 결제입니다. 부여하기를 사용하세요.'; END IF;
  IF l.status IS DISTINCT FROM 'DONE' THEN RAISE EXCEPTION '결제 완료 건만 옮길 수 있습니다.'; END IF;
  IF p_user_id IS NULL THEN RAISE EXCEPTION '옮길 수강생 계정을 선택하세요.'; END IF;
  IF (p_course_id IS NULL) = (p_ebook_id IS NULL) THEN RAISE EXCEPTION '강의 또는 전자책 하나를 선택하세요.'; END IF;
  v_amount := COALESCE(l.amount, 0);

  -- 1) 기존 구매에서 빼기
  IF l.purchase_id IS NOT NULL THEN
    SELECT * INTO o FROM purchases WHERE id = l.purchase_id FOR UPDATE;
    IF FOUND THEN
      IF o.user_id = p_user_id
         AND ((p_course_id IS NOT NULL AND o.course_id = p_course_id) OR (p_ebook_id IS NOT NULL AND o.ebook_id = p_ebook_id)) THEN
        RAISE EXCEPTION '이미 그 계정·강의에 연결돼 있습니다.';
      END IF;
      IF o.price > v_amount THEN
        UPDATE purchases
           SET price = price - v_amount,
               original_price = GREATEST(COALESCE(original_price, price) - v_amount, price - v_amount),
               payment_key = CASE WHEN payment_key = l.payment_key THEN NULL ELSE payment_key END
         WHERE id = o.id;
        v_old_action := 'subtracted';
      ELSIF p_revoke_old THEN
        DELETE FROM purchases WHERE id = o.id;
        v_old_action := 'revoked';
      ELSE
        UPDATE purchases SET price = 0, original_price = 0, payment_key = NULL, payment_method = NULL WHERE id = o.id;
        v_old_action := 'zeroed';
      END IF;
    END IF;
  END IF;

  IF l.payment_key IS NOT NULL AND EXISTS (SELECT 1 FROM purchases WHERE payment_key = l.payment_key) THEN
    RAISE EXCEPTION '이 결제키가 다른 구매에 남아 있어 옮길 수 없습니다. 운영 담당자에게 문의하세요.';
  END IF;

  -- 2) 새 계정·강의에 붙이기
  SELECT id INTO v_pid FROM purchases
   WHERE user_id = p_user_id AND price = 0 AND payment_key IS NULL
     AND ((p_course_id IS NOT NULL AND course_id = p_course_id) OR (p_ebook_id IS NOT NULL AND ebook_id = p_ebook_id))
   ORDER BY purchased_at LIMIT 1 FOR UPDATE;
  IF v_pid IS NOT NULL THEN
    UPDATE purchases SET price = v_amount, original_price = v_amount, payment_method = 'linkpay', payment_key = l.payment_key,
           purchased_at = COALESCE(l.approved_at, purchased_at)
     WHERE id = v_pid;
    v_mode := 'attached';
  ELSE
    SELECT id INTO v_pid FROM purchases
     WHERE user_id = p_user_id AND price > 0
       AND ((p_course_id IS NOT NULL AND course_id = p_course_id) OR (p_ebook_id IS NOT NULL AND ebook_id = p_ebook_id))
     ORDER BY purchased_at LIMIT 1 FOR UPDATE;
    IF v_pid IS NOT NULL THEN
      UPDATE purchases SET price = price + v_amount, original_price = COALESCE(original_price, price) + v_amount WHERE id = v_pid;
      v_mode := 'top_up';
    ELSE
      INSERT INTO purchases (user_id, course_id, ebook_id, title, price, original_price, payment_key, payment_method, expires_at, purchased_at)
      VALUES (p_user_id, p_course_id, p_ebook_id, COALESCE(NULLIF(p_title, ''), l.order_name, '링크페이 결제'),
              v_amount, v_amount, l.payment_key, 'linkpay', p_expires_at, COALESCE(l.approved_at, now()))
      RETURNING id INTO v_pid;
      v_mode := 'inserted';
    END IF;
  END IF;

  UPDATE linkpay_payments
     SET purchase_id = v_pid, matched_user_id = p_user_id, course_id = p_course_id, ebook_id = p_ebook_id, updated_at = now()
   WHERE id = p_linkpay_id;

  INSERT INTO purchase_audit_logs (action, purchase_id, actor_id, before, after)
  VALUES ('linkpay_move', v_pid, auth.uid(),
          jsonb_build_object('linkpay_id', p_linkpay_id, 'old_purchase_id', l.purchase_id, 'old_user_id', l.matched_user_id, 'old_action', v_old_action),
          jsonb_build_object('mode', v_mode, 'amount', v_amount, 'user_id', p_user_id, 'course_id', p_course_id));

  RETURN jsonb_build_object('purchase_id', v_pid, 'mode', v_mode, 'old_action', v_old_action);
END;
$$;

REVOKE ALL ON FUNCTION admin_move_linkpay_payment(BIGINT, UUID, INTEGER, INTEGER, TEXT, TIMESTAMPTZ, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_move_linkpay_payment(BIGINT, UUID, INTEGER, INTEGER, TEXT, TIMESTAMPTZ, BOOLEAN) TO authenticated;
