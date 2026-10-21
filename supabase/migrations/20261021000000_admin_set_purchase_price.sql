-- 구매 금액 수정 + 링크페이 부분취소 건 부여 허용 (2026-10-21, 미적용 — 대표님이 SQL Editor 에서 직접 Run)
-- 배경: 토스 상점관리자에서 한 카드 부분취소가 사이트에 반영되지 않아, 구매 1887 이 실제보다 100만 원 크게 잡혔다(10/20).
--       고치려면 운영 SQL 이 필요했다. 관리자 화면에서 사유를 남기고 금액을 고칠 수 있게 한다.
-- 1) admin_set_purchase_price(구매, 새 금액, 사유) — 관리자만. 구매 금액만 바꾸고(수강권·기간 그대로) purchase_audit_logs 에 'price_change' 로 남긴다.
--    정가(original_price)는 지금 금액과 같았을 때만 같이 바꾼다(쿠폰 할인 전 정가는 보존).
-- 2) admin_attach_linkpay_payment — 링크페이 결제가 부분취소(PARTIAL_CANCELED)된 뒤에도 남은 금액으로 부여할 수 있게 상태 조건만 넓힌다.
--    (웹훅이 부분취소를 받으면 linkpay_payments.amount 를 남은 금액으로 고친다 — 웹훅 코드 배포 뒤)
-- 되돌리기: supabase/diagnostics/20261021_admin_set_purchase_price_rollback.sql

create or replace function public.admin_set_purchase_price(p_purchase_id integer, p_price integer, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old integer;
  v_old_orig integer;
begin
  if not is_admin() then raise exception '관리자만 처리할 수 있습니다.'; end if;
  if p_price is null or p_price < 0 then raise exception '금액을 0원 이상으로 입력하세요.'; end if;
  if coalesce(btrim(p_reason), '') = '' then raise exception '사유를 입력하세요.'; end if;
  select price, original_price into v_old, v_old_orig from purchases where id = p_purchase_id for update;
  if not found then raise exception '구매를 찾을 수 없습니다.'; end if;
  if v_old = p_price then
    return jsonb_build_object('purchase_id', p_purchase_id, 'changed', false, 'price', p_price);
  end if;
  update purchases
     set price = p_price,
         original_price = case when original_price is null or original_price = v_old then p_price else original_price end
   where id = p_purchase_id;
  insert into purchase_audit_logs (action, purchase_id, actor_id, before, after)
  values ('price_change', p_purchase_id, auth.uid(),
          jsonb_build_object('price', v_old, 'original_price', v_old_orig),
          jsonb_build_object('price', p_price, 'reason', left(btrim(p_reason), 500)));
  return jsonb_build_object('purchase_id', p_purchase_id, 'changed', true, 'before', v_old, 'price', p_price);
end;
$$;
revoke all on function public.admin_set_purchase_price(integer, integer, text) from public, anon;
grant execute on function public.admin_set_purchase_price(integer, integer, text) to authenticated;

-- 2) 링크페이 부여 — 상태 조건만 'DONE' → 'DONE' 또는 'PARTIAL_CANCELED' (나머지는 20261014020000 과 같음)
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
  IF l.status IS DISTINCT FROM 'DONE' AND l.status IS DISTINCT FROM 'PARTIAL_CANCELED' THEN RAISE EXCEPTION '결제 완료(또는 부분취소) 건만 부여할 수 있습니다.'; END IF;
  IF p_user_id IS NULL THEN RAISE EXCEPTION '회원을 선택하세요.'; END IF;
  IF (p_course_id IS NULL) = (p_ebook_id IS NULL) THEN RAISE EXCEPTION '강의 또는 전자책 하나를 선택하세요.'; END IF;
  IF l.payment_key IS NOT NULL AND EXISTS (SELECT 1 FROM purchases WHERE payment_key = l.payment_key) THEN
    RAISE EXCEPTION '이 결제는 이미 다른 구매에 연결돼 있습니다.';
  END IF;
  v_amount := COALESCE(l.amount, 0);

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
