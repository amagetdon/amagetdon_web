-- 강의/전자책 일정 기준 기본 알림톡 (당일/D-1/D-3/D-7) — global default 템플릿.
-- 어드민이 한 번 설정하면 모든 강의가 inheritance 받아 사용. 강의별로 토글 OFF 가능.
INSERT INTO webhook_custom_events (code, label, description, trigger_hint, built_in, sort_order)
VALUES
  ('course_d7', '강의 7일 전', '강의 시작 7일 전 알림 (모든 강의 공통 기본 템플릿)', '예약 알림톡 큐 (cron)', TRUE, 40),
  ('course_d3', '강의 3일 전', '강의 시작 3일 전 알림 (모든 강의 공통 기본 템플릿)', '예약 알림톡 큐 (cron)', TRUE, 41),
  ('course_d1', '강의 1일 전', '강의 시작 1일 전 알림 (모든 강의 공통 기본 템플릿)', '예약 알림톡 큐 (cron)', TRUE, 42),
  ('course_d0', '강의 당일', '강의 시작 당일 알림 (모든 강의 공통 기본 템플릿)', '예약 알림톡 큐 (cron)', TRUE, 43)
ON CONFLICT (code) DO NOTHING;

-- 각 강의/전자책이 한 번 default schedule 시드를 받았는지 표시 (이후 페이지 열 때 자동 재추가 안 하기 위함).
ALTER TABLE courses ADD COLUMN IF NOT EXISTS default_webhooks_seeded BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE ebooks ADD COLUMN IF NOT EXISTS default_webhooks_seeded BOOLEAN NOT NULL DEFAULT FALSE;
