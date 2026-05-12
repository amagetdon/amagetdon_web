-- 강의별 알림톡 템플릿 변수 — 임의 키-값 쌍을 jsonb 로 저장.
-- 예: { "강사명": "홍길동", "강의핵심내용1": "...", "강사의 한 줄 메시지": "..." }
-- webhook-send 가 strong scope='course' 호출 시 payload 에 머지한다.
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS webhook_variables jsonb NOT NULL DEFAULT '{}'::jsonb;
