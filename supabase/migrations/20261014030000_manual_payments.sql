-- 무통장(계좌이체·현금) 입금 수동 등록 (2026-10-14)
-- 배경: 카드 반 + 입금 반처럼 토스 밖에서 받은 돈은 사이트에 기록할 방법이 없어, 0원 수강권으로 주고 매출에서 빠졌다.
-- manual_payments 에 입금 1건씩 남기고, 구매에는 링크페이 수동 부여와 같은 규칙으로 반영한다(같은 회원·상품 기준):
--   0원 수강권이 있으면 금액 채움(attached) / 유료 구매가 있으면 합산(top_up) / 없으면 새 구매(inserted)
-- 모든 처리는 purchase_audit_logs 에 'manual_payment' 로 남는다. 기존 데이터·정책은 바꾸지 않는다.

CREATE TABLE IF NOT EXISTS manual_payments (
  id BIGSERIAL PRIMARY KEY,
  method TEXT NOT NULL DEFAULT 'bank',          -- bank(계좌이체) | cash(현금)
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_id INTEGER REFERENCES courses(id) ON DELETE SET NULL,
  ebook_id INTEGER REFERENCES ebooks(id) ON DELETE SET NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  paid_at TIMESTAMPTZ NOT NULL,
  payer_name TEXT,                              -- 입금자명 (수강생과 다를 수 있음)
  memo TEXT,
  purchase_id INTEGER REFERENCES purchases(id) ON DELETE SET NULL,
  mode TEXT,                                    -- attached | top_up | inserted
  created_by UUID DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_manual_payments_paid_at ON manual_payments(paid_at DESC);

ALTER TABLE manual_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS manual_payments_admin_select ON manual_payments;
CREATE POLICY manual_payments_admin_select ON manual_payments FOR SELECT USING (is_admin());
-- 쓰기 정책 없음 → 아래 함수로만 등록

CREATE OR REPLACE FUNCTION admin_record_manual_payment(
  p_user_id UUID,
  p_course_id INTEGER,
  p_ebook_id INTEGER,
  p_amount INTEGER,
  p_paid_at TIMESTAMPTZ,
  p_method TEXT,
  p_payer_name TEXT,
  p_memo TEXT,
  p_title TEXT,
  p_expires_at TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pid INTEGER;
  v_mode TEXT;
  v_method TEXT := CASE WHEN p_method = 'cash' THEN 'cash' ELSE 'bank' END;
  v_mp BIGINT;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION '관리자만 등록할 수 있습니다.'; END IF;
  IF p_user_id IS NULL THEN RAISE EXCEPTION '수강생을 선택하세요.'; END IF;
  IF (p_course_id IS NULL) = (p_ebook_id IS NULL) THEN RAISE EXCEPTION '강의 또는 전자책 하나를 선택하세요.'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION '입금 금액을 입력하세요.'; END IF;
  IF p_paid_at IS NULL THEN RAISE EXCEPTION '입금일을 입력하세요.'; END IF;

  SELECT id INTO v_pid FROM purchases
   WHERE user_id = p_user_id AND price = 0 AND payment_key IS NULL
     AND ((p_course_id IS NOT NULL AND course_id = p_course_id) OR (p_ebook_id IS NOT NULL AND ebook_id = p_ebook_id))
   ORDER BY purchased_at LIMIT 1 FOR UPDATE;
  IF v_pid IS NOT NULL THEN
    UPDATE purchases SET price = p_amount, original_price = p_amount, payment_method = v_method, purchased_at = p_paid_at
     WHERE id = v_pid;
    v_mode := 'attached';
  ELSE
    SELECT id INTO v_pid FROM purchases
     WHERE user_id = p_user_id AND price > 0
       AND ((p_course_id IS NOT NULL AND course_id = p_course_id) OR (p_ebook_id IS NOT NULL AND ebook_id = p_ebook_id))
     ORDER BY purchased_at LIMIT 1 FOR UPDATE;
    IF v_pid IS NOT NULL THEN
      UPDATE purchases SET price = price + p_amount, original_price = COALESCE(original_price, price) + p_amount
       WHERE id = v_pid;
      v_mode := 'top_up';
    ELSE
      INSERT INTO purchases (user_id, course_id, ebook_id, title, price, original_price, payment_method, expires_at, purchased_at)
      VALUES (p_user_id, p_course_id, p_ebook_id, COALESCE(NULLIF(p_title, ''), '무통장 입금'), p_amount, p_amount, v_method, p_expires_at, p_paid_at)
      RETURNING id INTO v_pid;
      v_mode := 'inserted';
    END IF;
  END IF;

  INSERT INTO manual_payments (method, user_id, course_id, ebook_id, amount, paid_at, payer_name, memo, purchase_id, mode)
  VALUES (v_method, p_user_id, p_course_id, p_ebook_id, p_amount, p_paid_at, NULLIF(p_payer_name, ''), NULLIF(p_memo, ''), v_pid, v_mode)
  RETURNING id INTO v_mp;

  INSERT INTO purchase_audit_logs (action, purchase_id, actor_id, after)
  VALUES ('manual_payment', v_pid, auth.uid(),
          jsonb_build_object('manual_payment_id', v_mp, 'mode', v_mode, 'amount', p_amount, 'method', v_method));

  RETURN jsonb_build_object('purchase_id', v_pid, 'mode', v_mode, 'manual_payment_id', v_mp);
END;
$$;

REVOKE ALL ON FUNCTION admin_record_manual_payment(UUID, INTEGER, INTEGER, INTEGER, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_record_manual_payment(UUID, INTEGER, INTEGER, INTEGER, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) TO authenticated;
