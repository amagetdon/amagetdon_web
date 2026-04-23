-- OpenAI API 키 풀 (라운드로빈/폴백용)
-- 어드민만 접근 가능, edge function은 service_role로 조회

CREATE TABLE IF NOT EXISTS openai_api_keys (
  id SERIAL PRIMARY KEY,
  label TEXT NOT NULL DEFAULT '',        -- 관리용 라벨 (예: "A계정", "2호기")
  api_key TEXT NOT NULL,                 -- sk-proj-... 키 원문
  enabled BOOLEAN DEFAULT TRUE,
  last_used_at TIMESTAMPTZ,
  last_error_at TIMESTAMPTZ,
  last_error_message TEXT,
  error_count INTEGER DEFAULT 0,
  use_count INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS openai_api_keys_enabled_idx ON openai_api_keys (enabled);

ALTER TABLE openai_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage openai_api_keys" ON openai_api_keys
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE TRIGGER set_updated_at BEFORE UPDATE ON openai_api_keys
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 사용/오류 카운터 증분 (edge function에서 호출, service_role 전용)
CREATE OR REPLACE FUNCTION increment_openai_key_use(p_id INT)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE openai_api_keys
  SET use_count = use_count + 1, last_used_at = now()
  WHERE id = p_id;
$$;

CREATE OR REPLACE FUNCTION increment_openai_key_error(p_id INT)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE openai_api_keys
  SET error_count = error_count + 1
  WHERE id = p_id;
$$;

-- service_role만 실행 가능 (RPC 호출 경로는 edge function에서 SSK 사용)
REVOKE EXECUTE ON FUNCTION increment_openai_key_use(INT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION increment_openai_key_error(INT) FROM PUBLIC, anon, authenticated;
