-- 통합 대시보드: 무료 강의 ↔ 본 강의 숫자 맞추기
--  A. 매체 분류: '(direct)'·'direct'·'(none)'·'(not set)' 가 '기타'로 떨어지던 것을 '직접·미확인'으로.
--  B. 유료 상품 대시보드에 '무료 강의 신청 경로' 기준 결제를 나란히 보여 준다(무료 대시보드와 같은 기준).
--  C. 무료 상품 대시보드: 같은 전화번호의 다른 계정으로 결제한 사람도 결제로 센다.
--     무료 신청 기록 없이 연결 상품을 결제한 사람 수·매출을 따로 알려 준다(합계가 본 강의 쪽과 맞도록).
--  D. 유료 상품: 결제 직전 경로 기록이 없는 결제(링크페이·무통장·부여)는 무료 강의 신청 경로 → 없으면 가입 경로.
-- 되돌리기: supabase/diagnostics/20261119_dashboard_free_paid_match_rollback.sql

create or replace function public.norm_channel(src text)
returns text
language sql
immutable
as $$
  select case
    when src is null or btrim(src) = '' then 'direct'
    when lower(btrim(src)) in ('(direct)', 'direct', '(none)', 'none', '(not set)') then 'direct'
    when lower(src) ~ '(^|[^a-z])(fb|facebook|ig|instagram|meta|threads)([^a-z]|$)' then 'meta'
    when lower(src) like '%youtube%' or lower(src) in ('yt', 'youtu.be') then 'youtube'
    when lower(src) like '%kakao%' or lower(src) like '%daum%' then 'kakao'
    when lower(src) like '%naver%' then 'naver'
    when lower(src) like '%google%' or lower(src) in ('gdn', 'gads', 'adwords') then 'google'
    when lower(src) like '%dable%' then 'dable'
    when lower(src) like '%taboola%' then 'taboola'
    when lower(src) like '%tiktok%' then 'tiktok'
    when lower(src) like '%karrot%' or lower(src) like '%daangn%' then 'karrot'
    else 'other'
  end
$$;

-- 전화번호를 숫자만 남긴다. 10자리 미만(빈 값·잘못 적은 값)은 null → 계정 묶기에 쓰지 않는다.
create or replace function public.norm_phone(p text)
returns text
language sql
immutable
as $$
  select case when length(regexp_replace(coalesce(p, ''), '\D', '', 'g')) >= 10
              then regexp_replace(p, '\D', '', 'g') end
$$;
revoke all on function public.norm_phone(text) from public, anon;
grant execute on function public.norm_phone(text) to authenticated;

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
  -- 유료 상품일 때: 이 상품을 '결제'로 보는 무료 상품(무료 강의·무료 전자책)
  v_fc integer[] := '{}'; v_fe integer[] := '{}';
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

    -- 이 유료 상품으로 이어지는 무료 상품: ① 연결 상품으로 직접 지정한 것(상품 공통·기수별)
    -- ② 지정이 없는 같은 강사의 무료 상품(무료 쪽 자동 적용과 같은 규칙 — 유료 '강의'에만 해당)
    select coalesce(array_agg(c.id), '{}') into v_fc from courses c
     where (coalesce(c.course_type, '') like '%free%' or coalesce(c.sale_price, c.original_price, 0) = 0)
       and not (p_kind = 'course' and c.id = p_id)
       and (exists (select 1 from product_funnel_settings s where s.kind = 'course' and s.product_id = c.id
                     and ((p_kind = 'course' and p_id = any(s.linked_course_ids)) or (p_kind = 'ebook' and p_id = any(s.linked_ebook_ids))))
         or exists (select 1 from product_cohorts k where k.kind = 'course' and k.product_id = c.id
                     and ((p_kind = 'course' and p_id = any(k.linked_course_ids)) or (p_kind = 'ebook' and p_id = any(k.linked_ebook_ids))))
         or (p_kind = 'course' and v_instructor is not null and c.instructor_id = v_instructor
             and not exists (select 1 from product_funnel_settings s where s.kind = 'course' and s.product_id = c.id
                              and (cardinality(coalesce(s.linked_course_ids, '{}')) > 0 or cardinality(coalesce(s.linked_ebook_ids, '{}')) > 0))));
    select coalesce(array_agg(e.id), '{}') into v_fe from ebooks e
     where (coalesce(e.is_free, false) or coalesce(e.sale_price, e.original_price, 0) = 0)
       and not (p_kind = 'ebook' and e.id = p_id)
       and (exists (select 1 from product_funnel_settings s where s.kind = 'ebook' and s.product_id = e.id
                     and ((p_kind = 'course' and p_id = any(s.linked_course_ids)) or (p_kind = 'ebook' and p_id = any(s.linked_ebook_ids))))
         or exists (select 1 from product_cohorts k where k.kind = 'ebook' and k.product_id = e.id
                     and ((p_kind = 'course' and p_id = any(k.linked_course_ids)) or (p_kind = 'ebook' and p_id = any(k.linked_ebook_ids))))
         or (p_kind = 'course' and v_instructor is not null and e.instructor_id = v_instructor
             and not exists (select 1 from product_funnel_settings s where s.kind = 'ebook' and s.product_id = e.id
                              and (cardinality(coalesce(s.linked_course_ids, '{}')) > 0 or cardinality(coalesce(s.linked_ebook_ids, '{}')) > 0))));
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
    -- (유료 상품만) 무료 상품 신청 기록 — 신청 직전 경로가 있으면 그것, 없으면 가입 경로 (무료 대시보드와 같은 기준)
    -- 무료 상품 하나에 회원당 1줄(첫 신청) — 무료 대시보드가 신청자를 세는 방식과 같다
    fapp as (
      select distinct on (f.course_id, f.ebook_id, f.user_id)
             case when f.course_id is not null then 'course' else 'ebook' end as f_kind, coalesce(f.course_id, f.ebook_id) as f_id,
             f.user_id as f_user, f.purchased_at as f_at,
             norm_phone(fp.phone) as f_tel,
             case when nullif(f.purchase_touch->>'source', '') is not null
                  then norm_channel(f.purchase_touch->>'source')
                  else norm_channel(coalesce(nullif(fp.utm_source, ''), nullif(fp.signup_referrer, ''))) end as f_channel,
             coalesce(case when nullif(f.purchase_touch->>'source', '') is not null then f.purchase_touch->>'campaign' else fp.utm_campaign end, '') as f_campaign,
             coalesce(case when nullif(f.purchase_touch->>'source', '') is not null then f.purchase_touch->>'content' else fp.utm_content end, '') as f_content,
             coalesce(case when nullif(f.purchase_touch->>'source', '') is not null then f.purchase_touch->>'term' else fp.utm_term end, '') as f_term
        from purchases f join profiles fp on fp.id = f.user_id
       where not v_free and (f.course_id = any(v_fc) or f.ebook_id = any(v_fe))
       order by f.course_id, f.ebook_id, f.user_id, f.purchased_at
    ),
    -- 결제자 × 무료 상품마다 신청 1건: 같은 계정 우선, 없으면 같은 전화번호의 다른 계정(가장 먼저 신청한 쪽) — 무료 대시보드와 같은 규칙
    fmx as (
      select distinct on (x.purchase_id, x.f_kind, x.f_id) x.*
        from (
          select a.purchase_id, f.*, true as f_same
            from app0 a join fapp f on f.f_user = a.user_id and f.f_at <= a.applied_at + interval '1 minute'
          union all
          select a.purchase_id, f.*, false
            from app0 a join profiles ap on ap.id = a.user_id
            join fapp f on f.f_tel = norm_phone(ap.phone) and f.f_user <> a.user_id and f.f_at <= a.applied_at + interval '1 minute'
        ) x
       order by x.purchase_id, x.f_kind, x.f_id, x.f_same desc, x.f_at
    ),
    -- 결제자마다 대표 무료 신청 1건(여러 무료 상품을 거쳤으면 결제에 가장 가까운 것) — 결제 경로 기록이 없을 때 매체 분류에 쓴다
    fm as (
      select distinct on (purchase_id) * from fmx order by purchase_id, f_at desc
    ),
    app as (
      select a.purchase_id, a.user_id, a.applied_at, a.price, norm_phone(pr.phone) as tel,
             -- 매체·파라미터: 이번 구매 경로 → (유료 상품) 무료 신청 경로 → 가입 경로
             case when nullif(a.purchase_touch->>'source', '') is not null then norm_channel(a.purchase_touch->>'source')
                  when fm.purchase_id is not null then fm.f_channel
                  else norm_channel(coalesce(nullif(pr.utm_source, ''), nullif(pr.signup_referrer, ''))) end as channel,
             coalesce(case when nullif(a.purchase_touch->>'source', '') is not null then a.purchase_touch->>'campaign'
                           when fm.purchase_id is not null then fm.f_campaign else pr.utm_campaign end, '') as campaign,
             coalesce(case when nullif(a.purchase_touch->>'source', '') is not null then a.purchase_touch->>'content'
                           when fm.purchase_id is not null then fm.f_content else pr.utm_content end, '') as content,
             coalesce(case when nullif(a.purchase_touch->>'source', '') is not null then a.purchase_touch->>'term'
                           when fm.purchase_id is not null then fm.f_term else pr.utm_term end, '') as term,
             case when nullif(a.purchase_touch->>'source', '') is not null then 'purchase'
                  when fm.purchase_id is not null then 'free' else 'signup' end as basis,
             (pr.created_at is not null and pr.created_at >= a.applied_at - interval '24 hours') as new_signup,
             pr.gender::text as gender,
             case
               when pr.birth_date is null or pr.birth_date::text !~ '^\d{4}-\d{2}-\d{2}' then '미상'
               when date_part('year', age(left(pr.birth_date::text, 10)::date)) < 20 then '10대'
               when date_part('year', age(left(pr.birth_date::text, 10)::date)) >= 60 then '60대+'
               else (floor(date_part('year', age(left(pr.birth_date::text, 10)::date)) / 10) * 10)::int || '대'
             end as age_band,
             (fm.purchase_id is not null) as has_free, coalesce(fm.f_same, true) as free_same,
             fm.f_channel, fm.f_campaign, fm.f_content, fm.f_term
        from app0 a left join profiles pr on pr.id = a.user_id
        left join fm on fm.purchase_id = a.purchase_id
    ),
    -- (무료 상품만) 연결 상품 결제 기록
    buys as (
      select q.id, q.user_id, q.purchased_at, coalesce(q.price, 0)::numeric as price, norm_phone(bp.phone) as tel
        from purchases q left join profiles bp on bp.id = q.user_id
       where v_free and (q.course_id = any(v_lc) or q.ebook_id = any(v_le))
         and (v_to is null or q.purchased_at < v_to)
    ),
    -- 결제 1건을 신청자 1명에게: 같은 계정 우선, 없으면 같은 전화번호의 다른 계정(가장 먼저 신청한 쪽). 한 결제가 두 번 세이지 않게.
    bm as (
      select distinct on (x.id) x.id, x.price, x.app_user, x.same_account
        from (
          select b.id, b.price, a.user_id as app_user, true as same_account, a.applied_at
            from buys b join app a on a.user_id = b.user_id and b.purchased_at >= a.applied_at - interval '1 minute'
          union all
          select b.id, b.price, a.user_id, false, a.applied_at
            from buys b join app a on a.tel = b.tel and a.user_id <> b.user_id and b.purchased_at >= a.applied_at - interval '1 minute'
        ) x
       order by x.id, x.same_account desc, x.applied_at
    ),
    pay as (
      select bm.app_user as user_id, sum(bm.price)::numeric as revenue, bool_and(not bm.same_account) as phone_only
        from bm group by bm.app_user
      union all
      -- 유료 상품: 이 상품 구매가 곧 결제 (같은 사람의 재구매 금액을 합친다)
      select a.user_id, sum(coalesce(q.price, 0))::numeric, false
        from app a
        join purchases q on q.user_id = a.user_id
         and (q.course_id = any(v_lc) or q.ebook_id = any(v_le))
         and q.purchased_at >= a.applied_at - interval '1 minute'
         and (v_to is null or q.purchased_at < v_to)
       where not v_free and a.user_id is not null
       group by a.user_id
    ),
    appx as (
      select app.*,
             (not v_free or pay.user_id is not null) as paid,
             case when not v_free then coalesce(pay.revenue, app.price) else coalesce(pay.revenue, 0) end as revenue,
             coalesce(pay.phone_only, false) as phone_only
        from app left join pay on pay.user_id = app.user_id
    ),
    -- (무료 상품만) 신청 기록과 이어지지 않은 연결 상품 결제 — 이 기간의 첫 신청 이후 결제만
    unm as (
      select b.id, b.user_id, b.price from buys b
       where not exists (select 1 from bm where bm.id = b.id)
         and b.purchased_at >= coalesce(v_from, (select min(applied_at) from app))
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
      -- 무료 ↔ 본 강의 맞춰 보기
      'match', case when v_free then (select jsonb_build_object(
          'mode', 'free',
          -- 같은 전화번호의 다른 계정으로만 결제한 사람 (결제 수에 포함돼 있음)
          'phone_payers', (select count(*) from appx where paid and phone_only),
          -- 무료 신청 기록과 이어지지 않은 연결 상품 결제 (결제 수에 없음)
          'unmatched_payers', count(distinct coalesce(unm.user_id::text, 'guest-' || unm.id)),
          'unmatched_revenue', coalesce(sum(unm.price), 0)) from unm)
        else (select jsonb_build_object(
          'mode', 'paid',
          'feeders', (select coalesce(jsonb_agg(t.f order by t.f->>'kind', (t.f->>'id')::int desc), '[]') from (
              select jsonb_build_object('kind', 'course', 'id', c.id, 'title', c.title) as f from courses c where c.id = any(v_fc)
              union all
              select jsonb_build_object('kind', 'ebook', 'id', e.id, 'title', e.title) from ebooks e where e.id = any(v_fe)) t
             where exists (select 1 from fmx where fmx.f_kind = t.f->>'kind' and fmx.f_id = (t.f->>'id')::int)),
          'via_free_payers', count(*) filter (where has_free), 'via_free_revenue', coalesce(sum(revenue) filter (where has_free), 0),
          'phone_payers', count(*) filter (where has_free and not free_same),
          'no_free_payers', count(*) filter (where not has_free), 'no_free_revenue', coalesce(sum(revenue) filter (where not has_free), 0)) from appx) end,
      -- (유료 상품) 무료 신청 경로로 다시 묶은 결제 — 무료 대시보드의 매체별 결제와 같은 기준
      'free_rows', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from (
        select m.f_kind as kind, m.f_id as id, m.f_channel as channel, m.f_campaign as campaign, m.f_content as content, m.f_term as term,
               count(*)::int as payers, count(*) filter (where not m.f_same)::int as phone_payers, coalesce(sum(ax.revenue), 0) as revenue
          from fmx m join appx ax on ax.purchase_id = m.purchase_id
         group by m.f_kind, m.f_id, m.f_channel, m.f_campaign, m.f_content, m.f_term) x),
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
