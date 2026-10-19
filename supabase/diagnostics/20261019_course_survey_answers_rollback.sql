-- 되돌리기: 강의 신청 선택 질문 답 (20261019010000_course_survey_answers.sql 취소)
-- ⚠️ 표를 지우면 저장된 답도 함께 지워진다. 필요하면 먼저 내려받아 둘 것.
DROP FUNCTION IF EXISTS public.save_course_survey(integer, text, text, text);
DROP TABLE IF EXISTS public.course_survey_answers;
