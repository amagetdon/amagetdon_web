-- 첫 발사 시점의 원본 scope/scope_id 를 별도 컬럼으로 저장.
-- 기존 config_scope/config_scope_id 는 발사된 webhook_configs row 의 scope 이라 보통 'global' 로만 남아,
-- 재전송 시 강의별 자동 채우기(scheduled_at, instructor 등)가 동작하지 못한다.
ALTER TABLE webhook_logs
  ADD COLUMN IF NOT EXISTS request_scope text,
  ADD COLUMN IF NOT EXISTS request_scope_id bigint;
