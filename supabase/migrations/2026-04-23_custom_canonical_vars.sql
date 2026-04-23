-- 사용자 정의 canonical 변수 — 관리자가 사이트 전역 고정값을 자유롭게 등록
-- 런타임에 payload에 자동 주입 ({#open_chat_url#} 등으로 템플릿에서 참조 가능)
-- GPT-5.4-mini canonical 후보에도 자동 포함

CREATE TABLE IF NOT EXISTS custom_canonical_vars (
  id SERIAL PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,                 -- 예: 'open_chat_url', 'homepage_url'
  value TEXT NOT NULL DEFAULT '',           -- 실제 값 (URL, 문자열 등)
  description TEXT DEFAULT '',              -- 관리자 안내 (GPT 프롬프트에도 포함)
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS custom_canonical_vars_key_idx ON custom_canonical_vars (key);

ALTER TABLE custom_canonical_vars ENABLE ROW LEVEL SECURITY;

-- 어드민만 CRUD
CREATE POLICY "Admin manage custom_canonical_vars" ON custom_canonical_vars
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- edge function이 anon/authenticated로도 SELECT 가능해야 모달 드롭다운에서 사용 가능
CREATE POLICY "Anyone read custom_canonical_vars" ON custom_canonical_vars
  FOR SELECT USING (true);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON custom_canonical_vars
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
