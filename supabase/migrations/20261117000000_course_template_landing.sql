-- 강의 상세 페이지 템플릿 방식 (2026-11-17)
-- 상세 페이지를 이미지 여러 장 대신, 섹션 자료(문구·이미지 주소)로 자동 구성하는 방식을 고를 수 있게 한다.
--  · landing_mode: 'images'(기본, 지금 방식) | 'template'
--  · landing_doc : 템플릿 랜딩 자료(JSON). 형식은 src/lib/landingTemplate/README.md
-- 기존 강의는 모두 'images' 로 남아 동작이 바뀌지 않는다.
-- 되돌리기: supabase/diagnostics/20261117_course_template_landing_rollback.sql

alter table public.courses
  add column if not exists landing_mode text not null default 'images'
    check (landing_mode in ('images', 'template')),
  add column if not exists landing_doc jsonb;
