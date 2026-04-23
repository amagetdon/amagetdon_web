-- 기존 webhook_logs.event_type CHECK에 'custom' 추가
ALTER TABLE webhook_logs DROP CONSTRAINT IF EXISTS webhook_logs_event_type_check;
ALTER TABLE webhook_logs ADD CONSTRAINT webhook_logs_event_type_check
  CHECK (event_type IN ('signup', 'purchase', 'refund', 'cancel', 'custom'));

-- 커스텀 이벤트 정의 (쿠폰 발급/만료, 포인트 충전, 등급 변경 등)
CREATE TABLE IF NOT EXISTS webhook_custom_events (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,                  -- 'coupon_issued', 'coupon_expiring_d3' 등
  label TEXT NOT NULL,                         -- '쿠폰 발급 완료'
  description TEXT,                            -- 어드민 안내문
  trigger_hint TEXT,                           -- 발사 위치 힌트 (어디서 호출되는지)
  template TEXT NOT NULL DEFAULT '',           -- shoong 형식 (key=value 또는 JSON)
  enabled BOOLEAN DEFAULT TRUE,
  built_in BOOLEAN DEFAULT FALSE,              -- 시스템 정의 이벤트 (코드 변경 불가)
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS webhook_custom_events_code_idx ON webhook_custom_events (code);
CREATE INDEX IF NOT EXISTS webhook_custom_events_enabled_idx ON webhook_custom_events (enabled);

ALTER TABLE webhook_custom_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage webhook_custom_events" ON webhook_custom_events
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE TRIGGER set_updated_at BEFORE UPDATE ON webhook_custom_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 쿠폰 만료 알림 중복 방지 (claim별 알림 종류당 1회만 발사)
CREATE TABLE IF NOT EXISTS coupon_notification_log (
  id BIGSERIAL PRIMARY KEY,
  coupon_claim_id INTEGER NOT NULL REFERENCES coupon_claims(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_code TEXT NOT NULL,            -- 'coupon_expiring_d3', 'coupon_expiring_d1', 'coupon_expired'
  webhook_log_id BIGINT REFERENCES webhook_logs(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (coupon_claim_id, notification_code)
);
CREATE INDEX IF NOT EXISTS coupon_notification_log_user_idx ON coupon_notification_log (user_id);

ALTER TABLE coupon_notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin read coupon_notification_log" ON coupon_notification_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "Anyone insert coupon_notification_log" ON coupon_notification_log
  FOR INSERT WITH CHECK (true);

-- 시스템 정의 빌트인 이벤트 시드
INSERT INTO webhook_custom_events (code, label, description, trigger_hint, built_in, sort_order)
VALUES
  ('purchase_free', '무료 구매 완료', '무료 강의(course_type=free) 또는 무료 전자책(is_free=true) 구매 직후 발송', '강의/전자책 구매 시', TRUE, 5),
  ('purchase_premium', '유료 구매 완료', '유료 강의(course_type=premium) 또는 유료 전자책(is_free=false) 구매 직후. 쿠폰으로 0원 결제도 포함', '강의/전자책 구매 시', TRUE, 6),
  ('coupon_issued', '쿠폰 발급 완료', '관리자가 사용자에게 쿠폰을 발급한 직후 발송', '어드민 → 쿠폰 → 사용자 발급', TRUE, 10),
  ('coupon_expiring_d3', '쿠폰 만료 3일 전', '쿠폰 사용 가능 만료 3일 전 알림 (매일 cron)', '쿠폰 만료 스캐너', TRUE, 20),
  ('coupon_expiring_d1', '쿠폰 만료 1일 전', '쿠폰 사용 가능 만료 1일 전 알림 (매일 cron)', '쿠폰 만료 스캐너', TRUE, 21),
  ('coupon_expired', '쿠폰 만료', '쿠폰이 만료된 당일 알림 (매일 cron)', '쿠폰 만료 스캐너', TRUE, 22),
  ('point_charge', '포인트 충전 완료', '사용자가 포인트를 충전한 직후 발송', '결제 성공 콜백', TRUE, 30)
ON CONFLICT (code) DO NOTHING;
