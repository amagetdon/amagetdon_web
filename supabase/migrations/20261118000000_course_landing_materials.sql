-- 랜딩 초안 만들기용 자료 보관 (2026-11-18)
-- 관리자가 '자료로 초안 만들기'에 넣은 메모와 '랜딩에 쓸 그림' 목록을 강의별로 보관한다(다음에 섹션만 다시 만들 때 재사용).
--  · 관리자만 읽고 쓸 수 있다. 공개 조회되는 courses.landing_doc 에는 넣지 않는다(교안 내용이 그대로 노출되지 않게).
--  · 참고 자료(가리지 않은 서류·PDF)는 여기에도 저장하지 않는다 — 초안을 만들 때만 AI 로 전달된다.
-- 되돌리기: supabase/diagnostics/20261118_course_landing_materials_rollback.sql

create table if not exists public.course_landing_materials (
  course_id integer primary key references public.courses(id) on delete cascade,
  notes text not null default '',
  images jsonb not null default '[]',   -- [{ "label": "강사 사진", "url": "https://…" }]
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);
alter table public.course_landing_materials enable row level security;
drop policy if exists "admin all course_landing_materials" on public.course_landing_materials;
create policy "admin all course_landing_materials" on public.course_landing_materials for all
  using ((select is_admin())) with check ((select is_admin()));
