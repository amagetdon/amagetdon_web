-- 토스 링크페이 상품 캐시 — "갱신하기" 시 신규 상품만 추가 조회하기 위함.
CREATE TABLE IF NOT EXISTS linkpay_products (
  product_key TEXT PRIMARY KEY,
  name TEXT,
  amount INTEGER,
  thumbnail TEXT,
  status TEXT,
  toss_created_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE linkpay_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manage linkpay_products" ON linkpay_products FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
