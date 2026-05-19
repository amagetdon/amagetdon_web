-- 링크페이 웹훅 원본 페이로드 보관 테이블 (감사 로그 + payload 구조 분석용)
CREATE TABLE IF NOT EXISTS linkpay_webhook_events (
  id BIGSERIAL PRIMARY KEY,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  event_type TEXT,
  raw JSONB NOT NULL,
  processed BOOLEAN NOT NULL DEFAULT false
);

-- 엣지 함수(service role)만 기록·조회한다. anon/authenticated 직접 접근 차단.
ALTER TABLE linkpay_webhook_events ENABLE ROW LEVEL SECURITY;
