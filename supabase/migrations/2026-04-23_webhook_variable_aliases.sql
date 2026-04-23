-- 템플릿별 커스텀 변수 에일리어스 (한글/임의 변수명 → canonical 변수명 매핑)
-- 예: {"모임명": "TITLE", "강사님": "instructor_name"}
-- runner에서 payload에 오버레이: payload["모임명"] = payload["TITLE"]

ALTER TABLE webhook_schedules
  ADD COLUMN IF NOT EXISTS variable_aliases JSONB DEFAULT '{}'::jsonb;

ALTER TABLE webhook_custom_event_overrides
  ADD COLUMN IF NOT EXISTS variable_aliases JSONB DEFAULT '{}'::jsonb;

ALTER TABLE webhook_custom_events
  ADD COLUMN IF NOT EXISTS variable_aliases JSONB DEFAULT '{}'::jsonb;

ALTER TABLE webhook_configs
  ADD COLUMN IF NOT EXISTS signup_variable_aliases JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS purchase_variable_aliases JSONB DEFAULT '{}'::jsonb;
