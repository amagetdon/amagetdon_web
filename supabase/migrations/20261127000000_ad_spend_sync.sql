-- 광고비 자동 가져오기 확장 (메타 여러 계정·매일 자동 + 네이버 검색광고 + 구글 Ads + 네이버 GFA 파일)
-- 흐름: 매체별 캠페인 일별 비용을 ad_campaign_daily 에 모은다 → 상품마다 고른 캠페인만 product_ad_spend 로 다시 만든다(rebuild_product_ad_spend).
-- 기존 product_ad_spend 직접 입력(manual)·메타 기록은 그대로 둔다. 되돌리기: diagnostics/20261127_ad_spend_sync_rollback.sql

-- 1) 광고비 출처 확장
alter table public.product_ad_spend drop constraint if exists product_ad_spend_source_check;
alter table public.product_ad_spend add constraint product_ad_spend_source_check
  check (source in ('manual', 'meta', 'naver_sa', 'google', 'gfa'));
create unique index if not exists product_ad_spend_auto_uniq
  on public.product_ad_spend (kind, product_id, source, external_id, spend_date) where source <> 'manual';

-- 2) 상품별 연결 캠페인 (메타는 기존 meta_campaign_ids)
alter table public.product_funnel_settings
  add column if not exists naver_campaign_ids text[] not null default '{}',
  add column if not exists google_campaign_ids text[] not null default '{}',
  add column if not exists gfa_campaign_ids text[] not null default '{}';

-- 3) 매체 캠페인 일별 비용 (상품과 무관한 원본)
create table if not exists public.ad_campaign_daily (
  channel text not null check (channel in ('meta', 'naver_sa', 'google', 'gfa')),
  campaign_id text not null,
  campaign_name text,
  account_id text,
  spend_date date not null,
  amount numeric not null default 0 check (amount >= 0),
  updated_at timestamptz not null default now(),
  primary key (channel, campaign_id, spend_date)
);
alter table public.ad_campaign_daily enable row level security;
drop policy if exists "admin all ad_campaign_daily" on public.ad_campaign_daily;
create policy "admin all ad_campaign_daily" on public.ad_campaign_daily for all
  using ((select is_admin())) with check ((select is_admin()));

-- 4) 상품 광고비 다시 만들기 — 고른 캠페인의 일별 비용을 product_ad_spend 로.
--    원본(ad_campaign_daily)에 아직 없는 캠페인의 예전 기록(이 기능 전 메타 기록)은 건드리지 않는다. 연결을 뺀 캠페인 기록은 지운다.
create or replace function public.rebuild_product_ad_spend(p_kind text, p_id integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.product_funnel_settings%rowtype;
  n integer;
begin
  if not (coalesce((select is_admin()), false) or auth.role() = 'service_role') then
    raise exception '관리자만 사용할 수 있습니다.';
  end if;

  select * into s from public.product_funnel_settings where kind = p_kind and product_id = p_id;

  with sel(channel, cid) as (
    select 'meta', unnest(coalesce(s.meta_campaign_ids, '{}'))
    union all select 'naver_sa', unnest(coalesce(s.naver_campaign_ids, '{}'))
    union all select 'google', unnest(coalesce(s.google_campaign_ids, '{}'))
    union all select 'gfa', unnest(coalesce(s.gfa_campaign_ids, '{}'))
  )
  delete from public.product_ad_spend a
   where a.kind = p_kind and a.product_id = p_id
     and a.source in ('meta', 'naver_sa', 'google', 'gfa')
     and (
       not exists (select 1 from sel where sel.channel = a.source and sel.cid = a.external_id)
       or exists (select 1 from public.ad_campaign_daily d where d.channel = a.source and d.campaign_id = a.external_id)
     );

  with sel(channel, cid) as (
    select 'meta', unnest(coalesce(s.meta_campaign_ids, '{}'))
    union all select 'naver_sa', unnest(coalesce(s.naver_campaign_ids, '{}'))
    union all select 'google', unnest(coalesce(s.google_campaign_ids, '{}'))
    union all select 'gfa', unnest(coalesce(s.gfa_campaign_ids, '{}'))
  )
  insert into public.product_ad_spend (kind, product_id, channel, spend_date, amount, source, external_id, note)
  select p_kind, p_id,
         case d.channel when 'meta' then 'meta' when 'google' then 'google' else 'naver' end,
         d.spend_date, d.amount, d.channel, d.campaign_id, d.campaign_name
    from sel join public.ad_campaign_daily d on d.channel = sel.channel and d.campaign_id = sel.cid
   where d.amount > 0
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.rebuild_product_ad_spend(text, integer) from public, anon;
grant execute on function public.rebuild_product_ad_spend(text, integer) to authenticated, service_role;
