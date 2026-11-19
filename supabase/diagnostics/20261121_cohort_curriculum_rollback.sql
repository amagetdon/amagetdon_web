-- 되돌리기: 20261121000000_cohort_curriculum.sql
-- 마감·마감 취소·영상 권한 함수를 기수별 커리큘럼 넣기 전으로 돌리고, 새 함수와 cohort_no 열을 지운다.
-- 주의 1: 화면(PR)을 먼저 되돌린 뒤 실행. 화면이 남아 있으면 내 강의실·강의 수정이 열리지 않는다.
-- 주의 2: 열을 지우면 기수별로 나뉜 커리큘럼이 한 강의에 모두 합쳐져 보인다(항목·영상은 지워지지 않는다).
--         새 기수에 복사된 영상 없는 항목이 중복으로 보이면 강의 수정 화면에서 지운다.

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
end;
$$;
revoke all on function public.reopen_product_cohort(text, integer) from public, anon;
grant execute on function public.reopen_product_cohort(text, integer) to authenticated;

drop function if exists public.get_my_purchase_cohorts(bigint[]);
drop function if exists public.purchase_cohort_no(integer, timestamptz);
drop index if exists public.curriculum_items_course_cohort_idx;
alter table public.curriculum_items drop column if exists cohort_no;
