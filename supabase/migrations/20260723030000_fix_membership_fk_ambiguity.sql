-- 긴급 수정: instructors.membership_course_id 의 FK 가 instructors↔courses 관계를 2개로
-- 만들면서 PostgREST 임베드 쿼리(courses?select=...,instructor:instructors(...))가 전부
-- PGRST201(모호한 관계) 로 실패 — 강의 목록/상세/내 강의실 등 사이트 전반이 고장났다.
-- FK 제약만 제거하고 컬럼은 유지한다. 뉴스레터 잠금 판정은 RPC 의 LEFT JOIN 이라
-- 삭제된 강의를 가리켜도 에러 없이 동작하며, 값 정합성은 관리자 화면 선에서 감수한다.

ALTER TABLE instructors DROP CONSTRAINT IF EXISTS instructors_membership_course_id_fkey;

-- PostgREST 스키마 캐시 즉시 갱신
NOTIFY pgrst, 'reload schema';
