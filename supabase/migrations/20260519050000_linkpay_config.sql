-- 링크페이 연동 설정 — 토스 대시보드 세션 쿠키 보관 (상품 목록 조회용).
-- 단일 행(id=1)만 사용. 관리자만 접근.
CREATE TABLE IF NOT EXISTS linkpay_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  dashboard_cookie TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT linkpay_config_single_row CHECK (id = 1)
);
ALTER TABLE linkpay_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manage linkpay_config" ON linkpay_config FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
