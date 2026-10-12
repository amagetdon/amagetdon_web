-- 통합 대시보드 v2 (2026-10-13)
-- - 퍼널의 가입·신청·결제를 전체 기간으로 (신규 가입 = 신청 전 24시간 안에 가입한 회원). 방문(유입)은 기록 시작(10/12)부터.
-- - 매체 아래 캠페인 파라미터(utm_campaign / utm_content / utm_term)별로 펼쳐 볼 수 있게 행 단위로 반환.
--   파라미터 출처는 매체를 정한 곳과 같다: 이번 구매 경로(purchase_touch)가 있으면 그것, 없으면 가입 경로(profiles.utm_*).

create or replace function public.get_product_dashboard(p_kind text, p_id integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_title text; v_live timestamptz; v_free boolean; v_instructor integer;
  v_lc integer[]; v_le integer[]; v_default boolean := false;
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

  select s.linked_course_ids, s.linked_ebook_ids into v_lc, v_le
    from product_funnel_settings s where s.kind = p_kind and s.product_id = p_id;
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
       where (p_kind = 'course' and p.course_id = p_id) or (p_kind = 'ebook' and p.ebook_id = p_id)
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
        from product_ad_spend where kind = p_kind and product_id = p_id group by channel
    ),
    vis as (
      select v.visitor_id, min(v.first_at) as first_at,
             (array_agg(norm_channel(coalesce(nullif(v.source, ''), v.referrer)) order by v.first_at))[1] as channel,
             (array_agg(coalesce(v.campaign, '') order by v.first_at))[1] as campaign,
             (array_agg(coalesce(v.content, '') order by v.first_at))[1] as content,
             (array_agg(coalesce(v.term, '') order by v.first_at))[1] as term,
             (array_agg(v.user_id) filter (where v.user_id is not null))[1] as user_id
        from product_visits v where v.kind = p_kind and v.product_id = p_id
       group by v.visitor_id
    ),
    visx as (
      select vis.*,
             exists (select 1 from app where app.user_id = vis.user_id) as applied,
             exists (select 1 from appx where appx.user_id = vis.user_id and appx.paid) as paid
        from vis
    ),
    dd as (
      select case when d > 14 then 15 when d < 0 then -1 else d end as b, paid, revenue
        from (select ((v_live at time zone 'Asia/Seoul')::date - (applied_at at time zone 'Asia/Seoul')::date) as d, paid, revenue from appx) t
    )
    select jsonb_build_object(
      'product', jsonb_build_object(
        'kind', p_kind, 'id', p_id, 'title', v_title, 'is_free', v_free, 'live_at', v_live, 'linked_default', v_default,
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
        'applicants', count(*) filter (where applied), 'payers', count(*) filter (where paid)) from visx),
      'visit_rows', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from (
        select channel, campaign, content, term, count(*) as visitors,
               count(*) filter (where applied) as visit_applicants
          from visx group by channel, campaign, content, term) x),
      -- 신청자 행: 매체 × 캠페인 × 소재 × 세트
      'rows', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from (
        select channel, campaign, content, term,
               sum(n)::int as applicants, sum(new_n)::int as new_signups, sum(paid_n)::int as payers, sum(rev) as revenue,
               sum(male)::int as male, sum(female)::int as female, sum(gu)::int as gender_unknown,
               jsonb_object_agg(age_band, n) as ages
          from (
            select channel, campaign, content, term, age_band,
                   count(*) as n, count(*) filter (where new_signup) as new_n, count(*) filter (where paid) as paid_n,
                   coalesce(sum(revenue), 0) as rev,
                   count(*) filter (where gender = 'male') as male, count(*) filter (where gender = 'female') as female,
                   count(*) filter (where gender is null or gender not in ('male', 'female')) as gu
              from appx group by channel, campaign, content, term, age_band
          ) g
         group by channel, campaign, content, term) x),
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
revoke all on function public.get_product_dashboard(text, integer) from public, anon;
grant execute on function public.get_product_dashboard(text, integer) to authenticated;
