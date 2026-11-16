-- 통합 대시보드 기수 분리 (2026-11-16)
-- 같은 강의·전자책을 여러 기수로 운영할 때, [마감 처리] 시각을 경계로 방문·신청·결제·광고비를 기수별로 나눠 본다.
-- 기존 데이터(purchases·product_visits·product_ad_spend)는 건드리지 않는다. 기수 표에는 기간만 들어간다.
--  · product_cohorts: 기수 번호·이름·시작(이상)·마감(미만)·라이브 일시·기수별 연결 상품
--  · close_product_cohort: 지금 기수를 닫고 다음 기수를 연다 (기수가 없던 상품은 1기를 만들고 닫는다)
--  · reopen_product_cohort: 마지막 마감 처리를 취소한다
--  · get_product_dashboard(kind, id, cohort): cohort 를 주면 그 기수 기간만, 안 주면 지금처럼 전체
--    (인자 2개로 부르는 기존 화면·AI 채팅은 그대로 동작)
-- 되돌리기: supabase/diagnostics/20261116_product_cohorts_rollback.sql

create table if not exists public.product_cohorts (
  id bigserial primary key,
  kind text not null check (kind in ('course', 'ebook')),
  product_id integer not null,
  no integer not null check (no >= 1),
  name text not null,
  starts_at timestamptz,          -- null = 처음부터
  ends_at timestamptz,            -- null = 진행 중
  live_at timestamptz,            -- 이 기수 라이브 일시 (없으면 강의의 진행일)
  linked_course_ids integer[],    -- 이 기수에서 결제로 볼 상품 (null = 상품 공통 설정)
  linked_ebook_ids integer[],
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  unique (kind, product_id, no),
  check (starts_at is null or ends_at is null or ends_at > starts_at)
);
alter table public.product_cohorts enable row level security;
drop policy if exists "admin all product_cohorts" on public.product_cohorts;
create policy "admin all product_cohorts" on public.product_cohorts for all
  using ((select is_admin())) with check ((select is_admin()));

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

-- 대시보드 함수: 인자 2개짜리를 3개짜리(기수 선택, 기본 null)로 바꾼다
drop function if exists public.get_product_dashboard(text, integer);

create or replace function public.get_product_dashboard(p_kind text, p_id integer, p_cohort integer default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_title text; v_live timestamptz; v_free boolean; v_instructor integer;
  v_lc integer[]; v_le integer[]; v_default boolean := false;
  -- 기수: 기간(v_from 이상 ~ v_to 미만)·라이브 일시·연결 상품. p_cohort 가 없으면 전체 기간.
  v_from timestamptz; v_to timestamptz; v_clive timestamptz; v_clc integer[]; v_cle integer[]; v_first boolean := true;
begin
  if not coalesce((select is_admin()), false) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_kind = 'course' then
    select c.title, c.scheduled_at,
           (coalesce(c.course_type, '') like '%free%' or coalesce(c.sale_price, c.original_price, 0) = 0),
           c.instructor_id
      into v_title, v_live, v_free, v_instructor
      from courses c where c.id = p_id;
  elsif p_kind = 'ebook' then
    select e.title, null, (coalesce(e.is_free, false) or coalesce(e.sale_price, e.original_price, 0) = 0), e.instructor_id
      into v_title, v_live, v_free, v_instructor
      from ebooks e where e.id = p_id;
  else
    raise exception 'bad kind';
  end if;
  if v_title is null then raise exception 'not found'; end if;

  if p_cohort is not null then
    select k.starts_at, k.ends_at, k.live_at, k.linked_course_ids, k.linked_ebook_ids,
           not exists (select 1 from product_cohorts k2 where k2.kind = p_kind and k2.product_id = p_id and k2.no < k.no)
      into v_from, v_to, v_clive, v_clc, v_cle, v_first
      from product_cohorts k where k.kind = p_kind and k.product_id = p_id and k.no = p_cohort;
    if not found then raise exception 'cohort not found'; end if;
    v_live := coalesce(v_clive, v_live);
  end if;

  select s.linked_course_ids, s.linked_ebook_ids into v_lc, v_le
    from product_funnel_settings s where s.kind = p_kind and s.product_id = p_id;
  -- 기수에 연결 상품이 따로 지정돼 있으면 그것을 쓴다
  if v_clc is not null or v_cle is not null then v_lc := v_clc; v_le := v_cle; end if;
  v_lc := coalesce(v_lc, '{}'); v_le := coalesce(v_le, '{}');
  if not v_free then
    v_lc := case when p_kind = 'course' then array[p_id] else '{}'::integer[] end;
    v_le := case when p_kind = 'ebook' then array[p_id] else '{}'::integer[] end;
  elsif cardinality(v_lc) = 0 and cardinality(v_le) = 0 then
    v_default := true;
    if v_instructor is not null then
      select coalesce(array_agg(c.id), '{}') into v_lc from courses c
       where c.instructor_id = v_instructor and c.id <> p_id
         and not (coalesce(c.course_type, '') like '%free%' or coalesce(c.sale_price, c.original_price, 0) = 0);
    end if;
  end if;

  return (
    with app0 as (
      select distinct on (coalesce(p.user_id::text, 'guest-' || p.id))
             p.id as purchase_id, p.user_id, p.purchased_at as applied_at, coalesce(p.price, 0)::numeric as price, p.purchase_touch
        from purchases p
       where ((p_kind = 'course' and p.course_id = p_id) or (p_kind = 'ebook' and p.ebook_id = p_id))
         and (v_from is null or p.purchased_at >= v_from) and (v_to is null or p.purchased_at < v_to)
       order by coalesce(p.user_id::text, 'guest-' || p.id), p.purchased_at
    ),
    app as (
      select a.purchase_id, a.user_id, a.applied_at, a.price,
             -- 매체·파라미터: 이번 구매 경로가 있으면 그것, 없으면 가입 경로
             case when nullif(a.purchase_touch->>'source', '') is not null
                  then norm_channel(a.purchase_touch->>'source')
                  else norm_channel(coalesce(nullif(pr.utm_source, ''), nullif(pr.signup_referrer, ''))) end as channel,
             coalesce(case when nullif(a.purchase_touch->>'source', '') is not null then a.purchase_touch->>'campaign' else pr.utm_campaign end, '') as campaign,
             coalesce(case when nullif(a.purchase_touch->>'source', '') is not null then a.purchase_touch->>'content' else pr.utm_content end, '') as content,
             coalesce(case when nullif(a.purchase_touch->>'source', '') is not null then a.purchase_touch->>'term' else pr.utm_term end, '') as term,
             case when nullif(a.purchase_touch->>'source', '') is not null then 'purchase' else 'signup' end as basis,
             (pr.created_at is not null and pr.created_at >= a.applied_at - interval '24 hours') as new_signup,
             pr.gender::text as gender,
             case
               when pr.birth_date is null or pr.birth_date::text !~ '^\d{4}-\d{2}-\d{2}' then '미상'
               when date_part('year', age(left(pr.birth_date::text, 10)::date)) < 20 then '10대'
               when date_part('year', age(left(pr.birth_date::text, 10)::date)) >= 60 then '60대+'
               else (floor(date_part('year', age(left(pr.birth_date::text, 10)::date)) / 10) * 10)::int || '대'
             end as age_band
        from app0 a left join profiles pr on pr.id = a.user_id
    ),
    pay as (
      select a.user_id, sum(coalesce(q.price, 0))::numeric as revenue
        from app a
        join purchases q on q.user_id = a.user_id
         and (q.course_id = any(v_lc) or q.ebook_id = any(v_le))
         and q.purchased_at >= a.applied_at - interval '1 minute'
         and (v_to is null or q.purchased_at < v_to)
       where a.user_id is not null
       group by a.user_id
    ),
    appx as (
      select app.*,
             (not v_free or pay.user_id is not null) as paid,
             case when not v_free then coalesce(pay.revenue, app.price) else coalesce(pay.revenue, 0) end as revenue
        from app left join pay on pay.user_id = app.user_id
    ),
    sp as (
      select channel, sum(amount)::numeric as spend
        from product_ad_spend where kind = p_kind and product_id = p_id
         and (v_from is null or spend_date >= (v_from at time zone 'Asia/Seoul')::date)
         and (v_to is null or spend_date < (v_to at time zone 'Asia/Seoul')::date)
       group by channel
    ),
    vis as (
      select v.visitor_id, min(v.first_at) as first_at,
             (array_agg(norm_channel(coalesce(nullif(v.source, ''), v.referrer)) order by v.first_at))[1] as channel,
             (array_agg(coalesce(v.campaign, '') order by v.first_at))[1] as campaign,
             (array_agg(coalesce(v.content, '') order by v.first_at))[1] as content,
             (array_agg(coalesce(v.term, '') order by v.first_at))[1] as term,
             (array_agg(v.user_id) filter (where v.user_id is not null))[1] as user_id
        from product_visits v where v.kind = p_kind and v.product_id = p_id
         and (v_from is null or v.first_at >= v_from) and (v_to is null or v.first_at < v_to)
       group by v.visitor_id
    ),
    -- appx 는 회원당 1줄(첫 신청)이라 회원 ID 로 바로 붙인다. (예전: 방문자마다 신청자 전체를 훑는 exists → 방문자 많으면 시간 초과)
    visx as (
      select vis.*,
             coalesce(ax.applied_at >= vis.first_at - interval '1 minute', false) as applied,
             coalesce(ax.paid and ax.applied_at >= vis.first_at - interval '1 minute', false) as paid
        from vis left join appx ax on ax.user_id = vis.user_id
    ),
    hist as (
      select norm_channel(h.source) as channel, coalesce(h.campaign, '') as campaign, coalesce(h.content, '') as content,
             coalesce(h.term, '') as term, h.visitors, h.imported_at, h.cutoff
        from product_visit_history h where h.kind = p_kind and h.product_id = p_id
         and v_first  -- Umami 과거 방문은 날짜가 없어 전체 보기와 첫 기수에만 넣는다
    ),
    dd as (
      select case when d > 14 then 15 when d < 0 then -1 else d end as b, paid, revenue
        from (select ((v_live at time zone 'Asia/Seoul')::date - (applied_at at time zone 'Asia/Seoul')::date) as d, paid, revenue from appx) t
    )
    select jsonb_build_object(
      'cohorts', (select coalesce(jsonb_agg(jsonb_build_object('id', k.id, 'no', k.no, 'name', k.name, 'starts_at', k.starts_at,
        'ends_at', k.ends_at, 'live_at', k.live_at, 'has_links', (k.linked_course_ids is not null or k.linked_ebook_ids is not null)) order by k.no), '[]')
        from product_cohorts k where k.kind = p_kind and k.product_id = p_id),
      'product', jsonb_build_object(
        'kind', p_kind, 'id', p_id, 'title', v_title, 'is_free', v_free, 'live_at', v_live, 'linked_default', v_default,
        'cohort', p_cohort, 'cohort_from', v_from, 'cohort_to', v_to,
        'linked_courses', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'title', c.title) order by c.id desc), '[]') from courses c where c.id = any(v_lc)),
        'linked_ebooks', (select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'title', e.title) order by e.id desc), '[]') from ebooks e where e.id = any(v_le))
      ),
      'totals', (select jsonb_build_object(
        'applicants', count(*), 'new_signups', count(*) filter (where new_signup),
        'payers', count(*) filter (where paid), 'revenue', coalesce(sum(revenue), 0),
        'spend', (select coalesce(sum(spend), 0) from sp)) from appx),
      -- 방문 기록이 있는 사람만 (10/12~): 방문 → 신청 → 결제
      'visits', (select jsonb_build_object(
        'since', min(first_at), 'visitors', count(*),
        'applicants', count(*) filter (where applied), 'payers', count(*) filter (where paid),
        'history_visitors', (select coalesce(sum(visitors), 0) from hist),
        'history_imported_at', (select max(imported_at) from hist),
        'history_cutoff', (select max(cutoff) from hist)) from visx),
      'visit_rows', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from (
        select channel, campaign, content, term, sum(visitors)::int as visitors, sum(visit_applicants)::int as visit_applicants
          from (
            select channel, campaign, content, term, count(*) as visitors, count(*) filter (where applied) as visit_applicants
              from visx group by channel, campaign, content, term
            union all
            select channel, campaign, content, term, sum(visitors), 0 from hist group by channel, campaign, content, term
          ) u
         group by channel, campaign, content, term) x),
      -- 신청자 행: 매체 × 캠페인 × 소재 × 세트
      'rows', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from (
        select channel, campaign, content, term, basis,
               sum(n)::int as applicants, sum(new_n)::int as new_signups, sum(paid_n)::int as payers, sum(rev) as revenue,
               sum(male)::int as male, sum(female)::int as female, sum(gu)::int as gender_unknown,
               jsonb_object_agg(age_band, n) as ages
          from (
            select channel, campaign, content, term, basis, age_band,
                   count(*) as n, count(*) filter (where new_signup) as new_n, count(*) filter (where paid) as paid_n,
                   coalesce(sum(revenue), 0) as rev,
                   count(*) filter (where gender = 'male') as male, count(*) filter (where gender = 'female') as female,
                   count(*) filter (where gender is null or gender not in ('male', 'female')) as gu
              from appx group by channel, campaign, content, term, basis, age_band
          ) g
         group by channel, campaign, content, term, basis) x),
      'spend', (select coalesce(jsonb_object_agg(channel, spend), '{}') from sp),
      'dday', case when v_live is null then null else (select jsonb_agg(to_jsonb(s) order by s.ord) from (
        select case when b.b = 15 then 'D-15 이전' when b.b = -1 then '라이브 이후' when b.b = 0 then '당일' else 'D-' || b.b end as label,
               case when b.b = -1 then 100 else 15 - b.b end as ord,
               count(dd.b) as applicants, count(*) filter (where dd.paid) as payers, coalesce(sum(dd.revenue), 0) as revenue
          from generate_series(-1, 15) as b(b) left join dd on dd.b = b.b
         group by b.b) s) end
    )
  );
end;
$$;
revoke all on function public.get_product_dashboard(text, integer, integer) from public, anon;
grant execute on function public.get_product_dashboard(text, integer, integer) to authenticated;
