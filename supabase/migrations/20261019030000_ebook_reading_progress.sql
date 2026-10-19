-- 전자책 읽음 기록 (2026-10-19, 미적용 — 대표님이 SQL Editor 에서 직접 Run)
-- 배경: 대표님 "전자책 뷰어 누가 어디까지 읽었는지 볼 수 있나?" → 지금은 읽은 페이지를 저장하지 않아 다시 열면 1쪽부터.
-- 1) ebook_reading_progress: 회원·전자책별 마지막 페이지 / 가장 멀리 간 페이지 / 전체 페이지 / 처음 연 시각 / 마지막 읽은 시각 / 연 횟수
-- 2) save_ebook_progress(): 뷰어가 몇 초 모아서 부르는 저장 함수 — 로그인한 본인 + 그 전자책을 산 사람만, 본인 행만 쓴다
-- RLS: 읽기는 본인 행 또는 관리자 전체. 표에 직접 쓰기(insert/update/delete)는 막고 저장 함수로만 쓴다.
-- 기록은 이 SQL 을 실행한 뒤부터 쌓인다(이전 기록 없음). 외부 분석 도구로는 보내지 않는다.
-- 되돌리기: supabase/diagnostics/20261019_ebook_reading_progress_rollback.sql

create table if not exists public.ebook_reading_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  ebook_id integer not null references public.ebooks(id) on delete cascade,
  last_page integer not null default 1 check (last_page >= 1),
  max_page integer not null default 1 check (max_page >= 1),
  total_pages integer not null default 1 check (total_pages >= 1),
  open_count integer not null default 1 check (open_count >= 0),
  first_opened_at timestamptz not null default now(),
  last_read_at timestamptz not null default now(),
  primary key (user_id, ebook_id)
);
create index if not exists ebook_reading_progress_ebook_idx on public.ebook_reading_progress (ebook_id, last_read_at desc);

alter table public.ebook_reading_progress enable row level security;
drop policy if exists "own or admin read ebook_reading_progress" on public.ebook_reading_progress;
create policy "own or admin read ebook_reading_progress" on public.ebook_reading_progress
  for select using (user_id = auth.uid() or (select is_admin()));
revoke all on public.ebook_reading_progress from anon, authenticated;
grant select on public.ebook_reading_progress to authenticated;

-- 저장 함수 — p_opened=true 는 뷰어를 새로 연 때(연 횟수 +1)
create or replace function public.save_ebook_progress(p_ebook_id integer, p_page integer, p_total integer, p_opened boolean default false)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_total integer;
  v_page integer;
begin
  if v_uid is null or p_ebook_id is null or p_page is null or p_total is null then return; end if;
  -- 그 전자책을 산 사람만 기록(관리자 미리보기·남의 전자책 번호는 무시)
  if not exists (select 1 from purchases where user_id = v_uid and ebook_id = p_ebook_id) then return; end if;
  v_total := least(greatest(p_total, 1), 10000);
  v_page := least(greatest(p_page, 1), v_total);
  insert into ebook_reading_progress as t (user_id, ebook_id, last_page, max_page, total_pages, open_count)
  values (v_uid, p_ebook_id, v_page, v_page, v_total, 1)
  on conflict (user_id, ebook_id) do update set
    last_page = excluded.last_page,
    max_page = least(greatest(t.max_page, excluded.max_page), excluded.total_pages),
    total_pages = excluded.total_pages,
    open_count = t.open_count + case when p_opened then 1 else 0 end,
    last_read_at = now();
end;
$$;
revoke all on function public.save_ebook_progress(integer, integer, integer, boolean) from public;
grant execute on function public.save_ebook_progress(integer, integer, integer, boolean) to authenticated;
