-- webhook_logs 에 custom_event_code 를 보관해서 재전송 시 같은 템플릿이 다시 적용되도록 한다.
-- 기존 행에는 NULL — 일반 signup/purchase 발송은 이 컬럼이 비어있어도 정상 동작.
ALTER TABLE webhook_logs
  ADD COLUMN IF NOT EXISTS custom_event_code text;
