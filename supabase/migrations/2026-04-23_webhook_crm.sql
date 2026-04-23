-- 웹훅 CRM: scope 별 config + 모든 호출 로그
-- scope: 'global' | 'course' | 'ebook'
-- scope_id: global은 null, course/ebook은 각각의 PK

CREATE TABLE IF NOT EXISTS webhook_configs (
  id SERIAL PRIMARY KEY,
  scope TEXT NOT NULL CHECK (scope IN ('global', 'course', 'ebook')),
  scope_id BIGINT,
  enabled BOOLEAN DEFAULT TRUE,
  url TEXT NOT NULL DEFAULT '',
  method TEXT DEFAULT 'POST' CHECK (method IN ('POST', 'GET')),
  use_json_header BOOLEAN DEFAULT TRUE,
  header_data TEXT DEFAULT '',
  headers JSONB DEFAULT '{}'::jsonb,
  events JSONB DEFAULT '{"signup": true, "purchase": true}'::jsonb,
  use_template BOOLEAN DEFAULT FALSE,
  signup_template TEXT DEFAULT '',
  purchase_template TEXT DEFAULT '',
  label TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS webhook_configs_scope_global_idx
  ON webhook_configs (scope)
  WHERE scope = 'global';

CREATE UNIQUE INDEX IF NOT EXISTS webhook_configs_scope_id_idx
  ON webhook_configs (scope, scope_id)
  WHERE scope_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS webhook_configs_scope_idx ON webhook_configs (scope, scope_id);

ALTER TABLE webhook_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage webhook configs" ON webhook_configs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE TRIGGER set_updated_at BEFORE UPDATE ON webhook_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 모든 호출(성공/실패) 기록
CREATE TABLE IF NOT EXISTS webhook_logs (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL CHECK (event_type IN ('signup', 'purchase', 'refund', 'cancel', 'custom')),
  config_id INTEGER REFERENCES webhook_configs(id) ON DELETE SET NULL,
  config_scope TEXT,
  config_scope_id BIGINT,

  -- 관련 레코드 (편의상 UUID/BIGINT 둘 다 보관)
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  related_type TEXT,
  related_id BIGINT,

  -- 표시용 정보 (제출 시점 스냅샷)
  display_name TEXT,
  display_phone TEXT,
  display_email TEXT,
  display_title TEXT,

  -- 접속 컨텍스트
  ip TEXT,
  user_agent TEXT,
  referrer TEXT,
  device_type TEXT,
  submission_duration_ms INTEGER,

  -- UTM
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,

  -- 요청/응답
  request_url TEXT,
  request_method TEXT,
  request_headers JSONB,
  request_body TEXT,
  response_status INTEGER,
  response_body TEXT,
  send_status TEXT DEFAULT 'pending' CHECK (send_status IN ('pending', 'success', 'failed', 'skipped')),
  error_message TEXT,

  -- 관리
  memo TEXT DEFAULT '',

  -- 재전송
  resend_count INTEGER DEFAULT 0,
  last_resent_at TIMESTAMPTZ,
  resend_history JSONB DEFAULT '[]'::jsonb,

  -- 제출 페이로드 전체 (재전송용)
  payload JSONB,

  sent_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS webhook_logs_sent_at_idx ON webhook_logs (sent_at DESC);
CREATE INDEX IF NOT EXISTS webhook_logs_event_type_idx ON webhook_logs (event_type);
CREATE INDEX IF NOT EXISTS webhook_logs_user_id_idx ON webhook_logs (user_id);
CREATE INDEX IF NOT EXISTS webhook_logs_display_name_idx ON webhook_logs (display_name);
CREATE INDEX IF NOT EXISTS webhook_logs_display_phone_idx ON webhook_logs (display_phone);
CREATE INDEX IF NOT EXISTS webhook_logs_related_idx ON webhook_logs (related_type, related_id);

ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin read webhook logs" ON webhook_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admin update webhook logs" ON webhook_logs
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admin delete webhook logs" ON webhook_logs
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Anyone insert webhook logs" ON webhook_logs
  FOR INSERT WITH CHECK (true);

-- 기존 site_settings.webhook_config JSON을 webhook_configs(scope=global)로 이관
DO $$
DECLARE
  legacy JSONB;
BEGIN
  SELECT value INTO legacy FROM site_settings WHERE key = 'webhook_config';
  IF legacy IS NOT NULL THEN
    INSERT INTO webhook_configs (
      scope, scope_id, enabled, url, method, use_template,
      signup_template, purchase_template, headers, events, label
    ) VALUES (
      'global', NULL,
      COALESCE((legacy->>'enabled')::boolean, false),
      COALESCE(legacy->>'url', ''),
      COALESCE(legacy->>'method', 'POST'),
      COALESCE((legacy->>'useTemplate')::boolean, false),
      COALESCE(legacy->>'signupTemplate', ''),
      COALESCE(legacy->>'purchaseTemplate', ''),
      COALESCE(legacy->'headers', '{}'::jsonb),
      COALESCE(legacy->'events', '{"signup": true, "purchase": true}'::jsonb),
      '기본'
    )
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
