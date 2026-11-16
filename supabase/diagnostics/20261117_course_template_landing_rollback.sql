-- 되돌리기: 20261117000000_course_template_landing.sql
-- 주의: 템플릿 방식으로 게시한 강의가 있으면 먼저 이미지 방식으로 바꾼 뒤 실행 (landing_doc 내용이 사라진다).
alter table public.courses drop column if exists landing_doc;
alter table public.courses drop column if exists landing_mode;
