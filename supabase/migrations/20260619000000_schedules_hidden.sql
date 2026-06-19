-- schedules 에 숨김(is_hidden) 컬럼 추가.
-- 유료(premium) 강의 등록 시 강의 일정은 공개 캘린더(홈/아카데미)에 자동 노출되지 않도록 숨김으로 등록.
-- 단, schedules row 자체는 유지되어 예약 알림톡(webhook)이 기존처럼 scheduled_at 기준으로 동작.
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;

-- 기존 데이터 백필: 유료 강의에 연결된 일정은 숨김 처리.
UPDATE schedules s
SET is_hidden = true
FROM courses c
WHERE s.course_id = c.id AND c.course_type = 'premium';
