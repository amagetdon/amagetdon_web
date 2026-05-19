-- 토스 링크페이 자동 연동: 링크↔강의 매핑 + 결제 기록

-- 1) 링크페이 상품(productKey) ↔ 강의/전자책 매핑
CREATE TABLE IF NOT EXISTS linkpay_links (
  id BIGSERIAL PRIMARY KEY,
  product_key TEXT NOT NULL UNIQUE,
  course_id INTEGER REFERENCES courses(id) ON DELETE SET NULL,
  ebook_id INTEGER REFERENCES ebooks(id) ON DELETE SET NULL,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE linkpay_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manage linkpay_links" ON linkpay_links FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- 2) 링크페이 결제 기록 (매칭/미매칭 큐)
CREATE TABLE IF NOT EXISTS linkpay_payments (
  id BIGSERIAL PRIMARY KEY,
  order_key TEXT NOT NULL UNIQUE,
  payment_key TEXT,
  product_key TEXT,
  order_name TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  amount INTEGER,
  status TEXT,
  course_id INTEGER REFERENCES courses(id) ON DELETE SET NULL,
  ebook_id INTEGER REFERENCES ebooks(id) ON DELETE SET NULL,
  matched_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  granted BOOLEAN NOT NULL DEFAULT false,
  purchase_id INTEGER REFERENCES purchases(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_linkpay_payments_created_at ON linkpay_payments(created_at DESC);
ALTER TABLE linkpay_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manage linkpay_payments" ON linkpay_payments FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- 3) 전화번호(숫자만 비교)로 회원 찾기 — 링크페이 웹훅에서 구매자 매칭에 사용
CREATE OR REPLACE FUNCTION find_profile_id_by_phone(p_phone TEXT)
RETURNS UUID LANGUAGE sql STABLE AS $$
  SELECT id FROM profiles
  WHERE regexp_replace(coalesce(phone, ''), '\D', '', 'g') = regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')
    AND regexp_replace(coalesce(p_phone, ''), '\D', '', 'g') <> ''
  ORDER BY last_active_at DESC NULLS LAST
  LIMIT 1
$$;
