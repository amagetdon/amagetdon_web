-- 상품(강의·전자책)별 통합 대시보드 (2026-10-13)
-- 1) product_visits           : 상품 페이지 방문 기록(방문자 1명·상품·하루 1행) — 오늘부터 쌓임
-- 2) product_ad_spend         : 매체별 광고비(수동 입력 + 메타 자동)
-- 3) product_funnel_settings  : 무료 라이브의 '결제 상품' 연결, 메타 캠페인 연결
-- 4) get_product_dashboard(kind, id) : 관리자 전용 집계(JSON)

-- ── 매체 이름 정리 (utm_source·referrer → meta/naver/kakao/google/...) ─────────────────
create or replace function public.norm_channel(src text)
returns text
language sql
immutable
as $$
  select case
    when src is null or btrim(src) = '' then 'direct'
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

-- ── 1) 방문 기록 ───────────────────────────────────────────────────────────────
create table if not exists public.product_visits (
  id bigserial primary key,
  visitor_id uuid not null,
  user_id uuid references auth.users(id) on delete set null,
  kind text not null check (kind in ('course', 'ebook')),
  product_id integer not null,
  day date not null default (now() at time zone 'Asia/Seoul')::date,
  first_at timestamptz not null default now(),
  source text, medium text, campaign text, content text, term text, referrer text,
  unique (visitor_id, kind, product_id, day)
);
create index if not exists product_visits_product_idx on public.product_visits (kind, product_id);
create index if not exists product_visits_visitor_idx on public.product_visits (visitor_id);
alter table public.product_visits enable row level security;
drop policy if exists "admin read product_visits" on public.product_visits;
create policy "admin read product_visits" on public.product_visits for select using ((select is_admin()));

-- 방문 1건 기록 (비로그인 포함). 같은 방문자·상품·날짜는 1행, 로그인 상태면 회원 연결
create or replace function public.log_product_visit(p_visitor uuid, p_kind text, p_id integer, p_touch jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_visitor is null or p_kind not in ('course', 'ebook') or p_id is null then return; end if;
  if p_touch is not null and (jsonb_typeof(p_touch) <> 'object' or length(p_touch::text) > 2000) then p_touch := null; end if;
  if p_kind = 'course' and not exists (select 1 from courses where id = p_id) then return; end if;
  if p_kind = 'ebook' and not exists (select 1 from ebooks where id = p_id) then return; end if;
  insert into product_visits (visitor_id, user_id, kind, product_id, source, medium, campaign, content, term, referrer)
  values (p_visitor, auth.uid(), p_kind, p_id,
    left(p_touch->>'source', 200), left(p_touch->>'medium', 200), left(p_touch->>'campaign', 200),
    left(p_touch->>'content', 200), left(p_touch->>'term', 200), left(p_touch->>'referrer', 200))
  on conflict (visitor_id, kind, product_id, day)
  do update set user_id = coalesce(product_visits.user_id, excluded.user_id);
end;
$$;
revoke all on function public.log_product_visit(uuid, text, integer, jsonb) from public;
grant execute on function public.log_product_visit(uuid, text, integer, jsonb) to anon, authenticated;

-- 로그인·가입 직후: 이 브라우저의 비로그인 방문 기록을 회원에 연결
create or replace function public.link_product_visitor(p_visitor uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update product_visits set user_id = auth.uid()
  where visitor_id = p_visitor and user_id is null and auth.uid() is not null;
$$;
revoke all on function public.link_product_visitor(uuid) from public, anon;
grant execute on function public.link_product_visitor(uuid) to authenticated;

-- ── 2) 광고비 ─────────────────────────────────────────────────────────────────
create table if not exists public.product_ad_spend (
  id bigserial primary key,
  kind text not null check (kind in ('course', 'ebook')),
  product_id integer not null,
  channel text not null,
  spend_date date not null,
  amount numeric not null check (amount >= 0),
  source text not null default 'manual' check (source in ('manual', 'meta')),
  external_id text,
  note text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create index if not exists product_ad_spend_product_idx on public.product_ad_spend (kind, product_id);
create unique index if not exists product_ad_spend_meta_uniq
  on public.product_ad_spend (kind, product_id, external_id, spend_date) where source = 'meta';
alter table public.product_ad_spend enable row level security;
drop policy if exists "admin all product_ad_spend" on public.product_ad_spend;
create policy "admin all product_ad_spend" on public.product_ad_spend for all
  using ((select is_admin())) with check ((select is_admin()));

-- ── 3) 결제 상품·메타 캠페인 연결 ─────────────────────────────────────────────
create table if not exists public.product_funnel_settings (
  kind text not null check (kind in ('course', 'ebook')),
  product_id integer not null,
  linked_course_ids integer[] not null default '{}',
  linked_ebook_ids integer[] not null default '{}',
  meta_campaign_ids text[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (kind, product_id)
);
alter table public.product_funnel_settings enable row level security;
drop policy if exists "admin all product_funnel_settings" on public.product_funnel_settings;
create policy "admin all product_funnel_settings" on public.product_funnel_settings for all
  using ((select is_admin())) with check ((select is_admin()));

-- ── 4) 대시보드 집계 ─────────────────────────────────────────────────────────
-- 신청 = 이 상품 구매 행(무료 신청 포함, 사람당 첫 1건)
-- 결제 = 무료 상품: 신청 이후 연결 상품(미지정 시 같은 강사의 유료 강의) 구매 / 유료 상품: 이 상품 구매 자체
-- 매체 = 이번 구매 경로(purchase_touch) → 가입 경로(profiles.utm_source) → 가입 referrer 순
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
      select a.*,
             norm_channel(coalesce(nullif(a.purchase_touch->>'source', ''), nullif(pr.utm_source, ''), nullif(pr.signup_referrer, ''))) as channel,
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
             (array_agg(v.user_id) filter (where v.user_id is not null))[1] as user_id
        from product_visits v where v.kind = p_kind and v.product_id = p_id
       group by v.visitor_id
    ),
    visx as (
      select vis.*,
             (pr.created_at is not null and pr.created_at >= vis.first_at - interval '1 minute') as new_signup,
             exists (select 1 from app where app.user_id = vis.user_id) as applied,
             exists (select 1 from appx where appx.user_id = vis.user_id and appx.paid) as paid
        from vis left join profiles pr on pr.id = vis.user_id
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
        'applicants', count(*), 'payers', count(*) filter (where paid), 'revenue', coalesce(sum(revenue), 0),
        'spend', (select coalesce(sum(spend), 0) from sp)) from appx),
      'funnel', (select jsonb_build_object(
        'since', min(first_at), 'visitors', count(*), 'members', count(user_id),
        'signups', count(*) filter (where new_signup), 'applicants', count(*) filter (where applied),
        'payers', count(*) filter (where paid)) from visx),
      'funnel_by_channel', (select coalesce(jsonb_agg(to_jsonb(x) order by x.visitors desc), '[]') from (
        select channel, count(*) as visitors, count(*) filter (where new_signup) as signups,
               count(*) filter (where applied) as applicants, count(*) filter (where paid) as payers
          from visx group by channel) x),
      'dday', case when v_live is null then null else (select jsonb_agg(to_jsonb(s) order by s.ord) from (
        select case when b.b = 15 then 'D-15 이전' when b.b = -1 then '라이브 이후' when b.b = 0 then '당일' else 'D-' || b.b end as label,
               case when b.b = -1 then 100 else 15 - b.b end as ord,
               count(dd.b) as applicants, count(*) filter (where dd.paid) as payers, coalesce(sum(dd.revenue), 0) as revenue
          from generate_series(-1, 15) as b(b) left join dd on dd.b = b.b
         group by b.b) s) end,
      'channels', (select coalesce(jsonb_agg(to_jsonb(x) order by x.applicants desc, x.spend desc), '[]') from (
        select ch.channel,
               coalesce(a.applicants, 0) as applicants, coalesce(a.payers, 0) as payers, coalesce(a.revenue, 0) as revenue,
               coalesce(s.spend, 0) as spend,
               coalesce(a.male, 0) as male, coalesce(a.female, 0) as female, coalesce(a.gender_unknown, 0) as gender_unknown,
               coalesce((select jsonb_object_agg(z.age_band, z.n) from (
                 select age_band, count(*) as n from appx a2 where a2.channel = ch.channel group by age_band) z), '{}') as ages
          from (select channel from appx union select channel from sp) ch
          left join (select channel, count(*) as applicants, count(*) filter (where paid) as payers, sum(revenue) as revenue,
                            count(*) filter (where gender = 'male') as male, count(*) filter (where gender = 'female') as female,
                            count(*) filter (where gender is null or gender not in ('male', 'female')) as gender_unknown
                       from appx group by channel) a on a.channel = ch.channel
          left join sp s on s.channel = ch.channel) x)
    )
  );
end;
$$;
revoke all on function public.get_product_dashboard(text, integer) from public, anon;
grant execute on function public.get_product_dashboard(text, integer) to authenticated;
