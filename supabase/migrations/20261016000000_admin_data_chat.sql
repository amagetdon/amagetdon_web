-- 어드민 '데이터 질문 챗봇' (2026-10-16)
-- 챗봇이 쓰는 읽기 전용 집계 함수 + 사용량 기록 표.
--  · 모든 함수: 관리자만(is_admin) · 숫자 집계만 반환 — 이름·이메일·전화·주소·회원 ID 는 절대 돌려주지 않는다.
--  · 묶음 기준(p_group)은 정해진 이름만 받는다(아래 허용 목록 밖이면 오류) — 임의 SQL 없음.
--  · 날짜는 한국 시간 기준.
-- 되돌리기: supabase/diagnostics/20261016_admin_data_chat_rollback.sql

-- 연령대 (통합 대시보드와 같은 규칙)
create or replace function public.chat_age_band(p_birth text)
returns text
language sql
immutable
as $$
  select case
    when p_birth is null or p_birth !~ '^\d{4}-\d{2}-\d{2}' then '미상'
    when date_part('year', age(left(p_birth, 10)::date)) < 20 then '10대'
    when date_part('year', age(left(p_birth, 10)::date)) >= 60 then '60대+'
    else (floor(date_part('year', age(left(p_birth, 10)::date)) / 10) * 10)::int || '대'
  end
$$;

create or replace function public.chat_check_group(p_group text[], p_allowed text[])
returns text[]
language plpgsql
immutable
as $$
declare g text;
begin
  foreach g in array coalesce(p_group, '{}') loop
    if not (g = any(p_allowed)) then
      raise exception 'bad group: %', g using errcode = '22023';
    end if;
  end loop;
  return coalesce(p_group, '{}');
end;
$$;

-- 1) 신청·결제 집계 — 상품(선택) · 기간 · 묶음 기준별
--    묶음: channel, campaign, content, term, day, month, product, gender, age_band, method, openchat, paid
create or replace function public.admin_chat_applicants(
  p_from date, p_to date, p_kind text default null, p_id integer default null, p_group text[] default '{}'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare g text[];
begin
  if not coalesce((select is_admin()), false) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 400 then raise exception 'bad range' using errcode = '22023'; end if;
  g := chat_check_group(p_group, array['channel','campaign','content','term','day','month','product','gender','age_band','method','openchat','paid']);

  return (
    with base as (
      select p.id, p.user_id, coalesce(p.price, 0)::numeric as price,
             (p.purchased_at at time zone 'Asia/Seoul')::date as d,
             case when p.course_id is not null then 'course:' || p.course_id
                  when p.ebook_id is not null then 'ebook:' || p.ebook_id
                  when p.board_post_id is not null then 'board_post:' || p.board_post_id
                  else 'other' end as product,
             case when nullif(p.purchase_touch->>'source', '') is not null then norm_channel(p.purchase_touch->>'source')
                  else norm_channel(coalesce(nullif(pr.utm_source, ''), nullif(pr.signup_referrer, ''))) end as channel,
             coalesce(case when nullif(p.purchase_touch->>'source', '') is not null then p.purchase_touch->>'campaign' else pr.utm_campaign end, '') as campaign,
             coalesce(case when nullif(p.purchase_touch->>'source', '') is not null then p.purchase_touch->>'content' else pr.utm_content end, '') as content,
             coalesce(case when nullif(p.purchase_touch->>'source', '') is not null then p.purchase_touch->>'term' else pr.utm_term end, '') as term,
             coalesce(pr.gender::text, '미상') as gender,
             chat_age_band(pr.birth_date::text) as age_band,
             coalesce(nullif(p.payment_method, ''), case when coalesce(p.price, 0) = 0 then '무료' else '미상' end) as method,
             (p.openchat_opened_at is not null) as openchat
        from purchases p left join profiles pr on pr.id = p.user_id
       where (p.purchased_at at time zone 'Asia/Seoul')::date between p_from and p_to
         and (p_kind is null
              or (p_kind = 'course' and p.course_id = p_id)
              or (p_kind = 'ebook' and p.ebook_id = p_id)
              or (p_kind = 'board_post' and p.board_post_id = p_id))
    ),
    grouped as (
      select
        case when 'channel' = any(g) then channel end as channel,
        case when 'campaign' = any(g) then campaign end as campaign,
        case when 'content' = any(g) then content end as content,
        case when 'term' = any(g) then term end as term,
        case when 'day' = any(g) then d::text end as day,
        case when 'month' = any(g) then to_char(d, 'YYYY-MM') end as month,
        case when 'product' = any(g) then product end as product,
        case when 'gender' = any(g) then gender end as gender,
        case when 'age_band' = any(g) then age_band end as age_band,
        case when 'method' = any(g) then method end as method,
        case when 'openchat' = any(g) then openchat::text end as openchat,
        case when 'paid' = any(g) then (price > 0)::text end as paid,
        count(*) as purchases,
        count(distinct coalesce(user_id::text, 'guest-' || id)) as people,
        count(*) filter (where price > 0) as paid_purchases,
        sum(price) as revenue,
        count(*) filter (where openchat) as openchat_entered
      from base
      group by 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12
    )
    select jsonb_build_object(
      'from', p_from, 'to', p_to, 'kind', p_kind, 'id', p_id, 'group', to_jsonb(g),
      'totals', (select jsonb_build_object('purchases', count(*), 'people', count(distinct coalesce(user_id::text, 'guest-' || id)),
                                           'paid_purchases', count(*) filter (where price > 0), 'revenue', coalesce(sum(price), 0),
                                           'openchat_entered', count(*) filter (where openchat)) from base),
      'row_count', (select count(*) from grouped),
      'rows', (select coalesce(jsonb_agg(jsonb_strip_nulls(to_jsonb(x))), '[]') from (
                 select * from grouped order by people desc limit 200) x)
    )
  );
end;
$$;

-- 2) 상품 페이지 방문 집계 (사이트 자체 방문 기록, 10/12~) — 강의·전자책·게시글
--    묶음: channel, campaign, content, term, day, product
create or replace function public.admin_chat_visits(
  p_from date, p_to date, p_kind text default null, p_id integer default null, p_group text[] default '{}'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare g text[];
begin
  if not coalesce((select is_admin()), false) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 400 then raise exception 'bad range' using errcode = '22023'; end if;
  g := chat_check_group(p_group, array['channel','campaign','content','term','day','product']);

  return (
    with base as (
      select v.visitor_id, v.day, v.kind || ':' || v.product_id as product,
             norm_channel(coalesce(nullif(v.source, ''), v.referrer)) as channel,
             coalesce(v.campaign, '') as campaign, coalesce(v.content, '') as content, coalesce(v.term, '') as term,
             (v.user_id is not null) as logged_in
        from product_visits v
       where v.day between p_from and p_to
         and (p_kind is null or (v.kind = p_kind and (p_id is null or v.product_id = p_id)))
    ),
    grouped as (
      select
        case when 'channel' = any(g) then channel end as channel,
        case when 'campaign' = any(g) then campaign end as campaign,
        case when 'content' = any(g) then content end as content,
        case when 'term' = any(g) then term end as term,
        case when 'day' = any(g) then day::text end as day,
        case when 'product' = any(g) then product end as product,
        count(distinct visitor_id) as visitors,
        count(*) as visitor_days,
        count(distinct visitor_id) filter (where logged_in) as logged_in_visitors
      from base
      group by 1, 2, 3, 4, 5, 6
    )
    select jsonb_build_object(
      'from', p_from, 'to', p_to, 'kind', p_kind, 'id', p_id, 'group', to_jsonb(g),
      'tracking_since', (select min(day) from product_visits),
      'totals', (select jsonb_build_object('visitors', count(distinct visitor_id), 'visitor_days', count(*)) from base),
      'row_count', (select count(*) from grouped),
      'rows', (select coalesce(jsonb_agg(jsonb_strip_nulls(to_jsonb(x))), '[]') from (
                 select * from grouped order by visitors desc limit 200) x)
    )
  );
end;
$$;

-- 3) 광고비 집계 (product_ad_spend: 수동 입력 + 메타 자동)
--    묶음: channel, day, month, product, source
create or replace function public.admin_chat_ad_spend(
  p_from date, p_to date, p_kind text default null, p_id integer default null, p_group text[] default '{}'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare g text[];
begin
  if not coalesce((select is_admin()), false) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 400 then raise exception 'bad range' using errcode = '22023'; end if;
  g := chat_check_group(p_group, array['channel','day','month','product','source']);

  return (
    with base as (
      select s.channel, s.spend_date, s.kind || ':' || s.product_id as product, s.source, s.amount
        from product_ad_spend s
       where s.spend_date between p_from and p_to
         and (p_kind is null or (s.kind = p_kind and (p_id is null or s.product_id = p_id)))
    ),
    grouped as (
      select
        case when 'channel' = any(g) then channel end as channel,
        case when 'day' = any(g) then spend_date::text end as day,
        case when 'month' = any(g) then to_char(spend_date, 'YYYY-MM') end as month,
        case when 'product' = any(g) then product end as product,
        case when 'source' = any(g) then source end as source,
        sum(amount) as spend
      from base
      group by 1, 2, 3, 4, 5
    )
    select jsonb_build_object(
      'from', p_from, 'to', p_to, 'kind', p_kind, 'id', p_id, 'group', to_jsonb(g),
      'total_spend', (select coalesce(sum(amount), 0) from base),
      'rows', (select coalesce(jsonb_agg(jsonb_strip_nulls(to_jsonb(x))), '[]') from (
                 select * from grouped order by spend desc limit 200) x)
    )
  );
end;
$$;

revoke all on function public.admin_chat_applicants(date, date, text, integer, text[]) from public, anon;
revoke all on function public.admin_chat_visits(date, date, text, integer, text[]) from public, anon;
revoke all on function public.admin_chat_ad_spend(date, date, text, integer, text[]) from public, anon;
grant execute on function public.admin_chat_applicants(date, date, text, integer, text[]) to authenticated;
grant execute on function public.admin_chat_visits(date, date, text, integer, text[]) to authenticated;
grant execute on function public.admin_chat_ad_spend(date, date, text, integer, text[]) to authenticated;

-- 4) 사용량 기록 — 질문 내용은 저장하지 않는다(시각·관리자·토큰·비용만)
create table if not exists public.admin_chat_usage (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  admin_id uuid default auth.uid(),
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cache_read_tokens integer not null default 0,
  cache_write_tokens integer not null default 0,
  cost_usd numeric not null default 0,
  tool_calls integer not null default 0,
  stop_reason text
);
alter table public.admin_chat_usage enable row level security;
drop policy if exists "admin all admin_chat_usage" on public.admin_chat_usage;
create policy "admin all admin_chat_usage" on public.admin_chat_usage for all
  using ((select is_admin())) with check ((select is_admin()));
