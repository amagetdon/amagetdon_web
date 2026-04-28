-- 비회원 가입 (guest-signup) 호출 빈도 추적용 테이블.
-- IP 단위 / 전화번호 단위 rate limit 검사에 사용.

CREATE TABLE IF NOT EXISTS signup_attempts (
  id BIGSERIAL PRIMARY KEY,
  ip TEXT,
  email TEXT,
  phone TEXT,
  success BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_signup_attempts_ip_time
  ON signup_attempts (ip, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_signup_attempts_phone_time
  ON signup_attempts (phone, created_at DESC) WHERE phone IS NOT NULL;

-- RLS — 일반 사용자는 못 보고 못 만지게. service_role 만 사용.
ALTER TABLE signup_attempts ENABLE ROW LEVEL SECURITY;

-- 24시간 이상 지난 레코드 자동 정리 (매일 1회)
SELECT cron.schedule(
  'signup-attempts-cleanup',
  '17 3 * * *',
  $$DELETE FROM signup_attempts WHERE created_at < now() - INTERVAL '24 hours'$$
);
