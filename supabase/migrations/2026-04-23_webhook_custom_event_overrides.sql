-- 커스텀 이벤트(쿠폰/강의/전자책 등)의 scope별 템플릿 override
-- 전역 기본값은 webhook_custom_events에, scope별(쿠폰 등) 개별 템플릿은 여기에 저장
-- webhook-send edge function에서 override 먼저 조회 후 없으면 전역 기본값으로 폴백

CREATE TABLE IF NOT EXISTS webhook_custom_event_overrides (
  id SERIAL PRIMARY KEY,
  event_code TEXT NOT NULL,                                       -- 'coupon_issued' 등 webhook_custom_events.code와 매칭
  scope TEXT NOT NULL CHECK (scope IN ('coupon', 'course', 'ebook')),
  scope_id BIGINT NOT NULL,
  template TEXT NOT NULL DEFAULT '',
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (event_code, scope, scope_id)
);

CREATE INDEX IF NOT EXISTS webhook_custom_event_overrides_lookup_idx
  ON webhook_custom_event_overrides (event_code, scope, scope_id);

ALTER TABLE webhook_custom_event_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage webhook_custom_event_overrides" ON webhook_custom_event_overrides
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE TRIGGER set_updated_at BEFORE UPDATE ON webhook_custom_event_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
