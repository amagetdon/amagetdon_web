-- 기수별 커리큘럼 (2026-11-19) — 같은 강의 페이지를 여러 기수로 계속 쓸 때 수강 자료를 기수별로 나눈다.
--  · curriculum_items.cohort_no: null = 공통(모든 기수에게 보임), 숫자 = 그 기수 결제자에게만 보임
--  · 기수는 결제 시각으로 정한다 (product_cohorts 의 시작 이상 ~ 마감 미만)
--  · close_product_cohort(강의): 닫는 기수의 커리큘럼은 그 기수 전용으로 남기고, 새 기수에는 주차·제목 구성만 복사한다(영상은 비움)
--    - 처음 마감하는 강의는 지금 커리큘럼 전체가 1기 것이 된다
--  · reopen_product_cohort(강의): 마감 취소 — 새 기수에 영상 없이 복사해 둔 항목은 지우고, 영상을 넣은 항목은 앞 기수로 옮긴다
--  · get_curriculum_videos: 자기 기수(또는 공통) 항목의 영상 주소만 내려준다. 관리자는 전부
--  · get_my_purchase_cohorts: 내 강의실에서 자기 기수 커리큘럼만 보여 주기 위한 조회
-- 기수를 만들지 않은 강의, 이미 기수가 있지만 커리큘럼을 나누지 않은 강의(cohort_no 가 전부 null)는 동작이 바뀌지 않는다.
-- 순서: 이 SQL 먼저 → 화면(PR) 머지. 화면이 먼저 나가면 내 강의실이 열리지 않는다.
-- 되돌리기: supabase/diagnostics/20261121_cohort_curriculum_rollback.sql

alter table public.curriculum_items add column if not exists cohort_no integer;
create index if not exists curriculum_items_course_cohort_idx on public.curriculum_items (course_id, cohort_no);
grant select (cohort_no) on public.curriculum_items to anon, authenticated;

-- 결제 시각이 속한 기수 번호. 기수가 없는 강의는 null
create or replace function public.purchase_cohort_no(p_course_id integer, p_at timestamptz)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select k.no from product_cohorts k
   where k.kind = 'course' and k.product_id = p_course_id
     and (k.starts_at is null or p_at >= k.starts_at)
     and (k.ends_at is null or p_at < k.ends_at)
   order by k.no limit 1;
$$;
revoke all on function public.purchase_cohort_no(integer, timestamptz) from public, anon, authenticated;

-- 내 구매 줄마다 어느 기수인지 (내 강의실 표시용)
create or replace function public.get_my_purchase_cohorts(p_course_ids bigint[])
returns table (purchase_id bigint, cohort_no integer)
language sql
stable
security definer
set search_path = public
as $$
  select p.id::bigint, purchase_cohort_no(p.course_id, p.purchased_at)
    from purchases p
   where p.user_id = auth.uid() and p.course_id = any(p_course_ids);
$$;
revoke all on function public.get_my_purchase_cohorts(bigint[]) from public, anon;
grant execute on function public.get_my_purchase_cohorts(bigint[]) to authenticated;

-- 강의 영상 주소: 관리자 또는 (만료 전) 구매 회원 — 자기 기수 항목과 공통 항목만
create or replace function public.get_curriculum_videos(p_course_ids bigint[])
returns table (id bigint, course_id bigint, video_url text, video_urls jsonb)
language sql
stable
security definer
set search_path = public
as $$
  select ci.id::bigint, ci.course_id::bigint, ci.video_url::text, to_jsonb(ci.video_urls)
  from curriculum_items ci
  where ci.course_id = any(p_course_ids)
    and (
      (select is_admin())
      or exists (
        select 1 from purchases p
        where p.user_id = auth.uid()
          and p.course_id = ci.course_id
          and (p.expires_at is null or p.expires_at > now())
          and (ci.cohort_no is null or ci.cohort_no = purchase_cohort_no(ci.course_id, p.purchased_at))
      )
    )
$$;
revoke all on function public.get_curriculum_videos(bigint[]) from public, anon;
grant execute on function public.get_curriculum_videos(bigint[]) to authenticated;

create or replace function public.close_product_cohort(p_kind text, p_id integer, p_at timestamptz default null, p_next_live timestamptz default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_at timestamptz := coalesce(p_at, now());
  v_no integer; v_start timestamptz; v_live timestamptz; v_lc integer[]; v_le integer[];
  v_first boolean := false;
begin
  if not coalesce((select is_admin()), false) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_kind not in ('course', 'ebook') then raise exception 'bad kind'; end if;
  if v_at > now() + interval '1 minute' then raise exception '마감 시각은 지금보다 뒤일 수 없습니다'; end if;

  -- 닫는 기수에 그때의 연결 상품을 남겨 둔다 (다음 기수에서 연결을 바꿔도 지난 기수 숫자가 안 변하게)
  select nullif(s.linked_course_ids, '{}'), nullif(s.linked_ebook_ids, '{}') into v_lc, v_le
    from product_funnel_settings s where s.kind = p_kind and s.product_id = p_id;

  select k.no, k.starts_at into v_no, v_start
    from product_cohorts k
   where k.kind = p_kind and k.product_id = p_id and k.ends_at is null
   order by k.no desc limit 1 for update;

  if v_no is null then
    if exists (select 1 from product_cohorts k where k.kind = p_kind and k.product_id = p_id) then
      raise exception '진행 중인 기수가 없습니다';
    end if;
    if p_kind = 'course' then
      select c.scheduled_at into v_live from courses c where c.id = p_id;
      if not found then raise exception 'not found'; end if;
    elsif not exists (select 1 from ebooks e where e.id = p_id) then
      raise exception 'not found';
    end if;
    insert into product_cohorts (kind, product_id, no, name, starts_at, ends_at, live_at, linked_course_ids, linked_ebook_ids)
    values (p_kind, p_id, 1, '1기', null, v_at, v_live, v_lc, v_le);
    v_no := 1;
    v_first := true;
  else
    if v_start is not null and v_at <= v_start then raise exception '마감 시각이 이 기수 시작보다 빠릅니다'; end if;
    update product_cohorts k
       set ends_at = v_at,
           linked_course_ids = case when k.linked_course_ids is null and k.linked_ebook_ids is null then v_lc else k.linked_course_ids end,
           linked_ebook_ids = case when k.linked_course_ids is null and k.linked_ebook_ids is null then v_le else k.linked_ebook_ids end
     where k.kind = p_kind and k.product_id = p_id and k.no = v_no;
  end if;

  insert into product_cohorts (kind, product_id, no, name, starts_at, ends_at, live_at)
  values (p_kind, p_id, v_no + 1, (v_no + 1) || '기', v_at, null, p_next_live);

  -- 커리큘럼: 닫는 기수 것은 그 기수 전용으로 남기고, 새 기수에는 구성(주차·제목·설명·순서)만 복사한다. 영상은 비운다.
  if p_kind = 'course' then
    if v_first then
      update curriculum_items ci set cohort_no = 1 where ci.course_id = p_id and ci.cohort_no is null;
    end if;
    insert into curriculum_items (course_id, week, label, description, sort_order, cohort_no)
    select ci.course_id, ci.week, ci.label, ci.description, ci.sort_order, v_no + 1
      from curriculum_items ci
     where ci.course_id = p_id and ci.cohort_no = v_no
     order by ci.sort_order, ci.id;
  end if;
end;
$$;
revoke all on function public.close_product_cohort(text, integer, timestamptz, timestamptz) from public, anon;
grant execute on function public.close_product_cohort(text, integer, timestamptz, timestamptz) to authenticated;

create or replace function public.reopen_product_cohort(p_kind text, p_id integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_no integer; v_cnt integer;
begin
  if not coalesce((select is_admin()), false) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select max(k.no), count(*) into v_no, v_cnt from product_cohorts k where k.kind = p_kind and k.product_id = p_id;
  if v_no is null or v_cnt < 2 then raise exception '취소할 마감 처리가 없습니다'; end if;
  delete from product_cohorts k where k.kind = p_kind and k.product_id = p_id and k.no = v_no;
  if v_cnt = 2 then
    -- 1기만 남으면 기수 구분이 없던 처음 상태로
    delete from product_cohorts k where k.kind = p_kind and k.product_id = p_id;
  else
    update product_cohorts k set ends_at = null where k.kind = p_kind and k.product_id = p_id and k.no = v_no - 1;
  end if;

  -- 커리큘럼: 취소되는 기수에 영상 없이 복사해 둔 항목은 지우고, 영상을 넣은 항목은 앞 기수로 옮긴다
  if p_kind = 'course' then
    delete from curriculum_items ci
     where ci.course_id = p_id and ci.cohort_no = v_no
       and coalesce(ci.video_url, '') = '' and ci.video_urls = '[]'::jsonb;
    if v_cnt = 2 then
      update curriculum_items ci set cohort_no = null where ci.course_id = p_id and ci.cohort_no is not null;
    else
      update curriculum_items ci set cohort_no = v_no - 1 where ci.course_id = p_id and ci.cohort_no = v_no;
    end if;
  end if;
end;
$$;
revoke all on function public.reopen_product_cohort(text, integer) from public, anon;
grant execute on function public.reopen_product_cohort(text, integer) to authenticated;
