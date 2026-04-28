-- purchases.payment_key 에 partial unique 제약 추가
-- (NULL 허용 — 옛 비-토스 구매 레코드는 payment_key 가 없을 수 있음)
-- 동일 토스 paymentKey 로 두 번 구매가 만들어지는 race 를 DB 단에서 차단.

CREATE UNIQUE INDEX IF NOT EXISTS uniq_purchases_payment_key
  ON purchases (payment_key)
  WHERE payment_key IS NOT NULL;
