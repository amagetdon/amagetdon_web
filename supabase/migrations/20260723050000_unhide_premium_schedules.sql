-- 유료 강의 일정 전부 공개 전환 (운영 결정)
-- 20260619000000 의 백필 UPDATE 가 마이그레이션 히스토리 밀림으로 재실행되면서
-- 유료(premium) 강의 일정이 일괄 숨김 처리됐다. 어떤 일정이 수동 공개 상태였는지
-- 기록이 없어, 운영 결정에 따라 유료 강의 일정을 전부 공개로 되돌린다.
-- 신규 유료 강의 등록 시 일정 자동 숨김 동작은 앱 코드에 그대로 유지된다 —
-- 이 마이그레이션은 현재 데이터만 복구한다.

UPDATE schedules s
SET is_hidden = false
FROM courses c
WHERE s.course_id = c.id AND c.course_type = 'premium' AND s.is_hidden = true;
