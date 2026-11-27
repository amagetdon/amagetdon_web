-- 되돌리기: migrations/20261127000000_ad_spend_sync.sql
-- 새 출처(naver_sa·google·gfa)로 들어간 광고비 기록은 지운다(원래 출처 제약에 안 맞음). 직접 입력·메타 기록은 그대로.
delete from public.product_ad_spend where source in ('naver_sa', 'google', 'gfa');
drop function if exists public.rebuild_product_ad_spend(text, integer);
drop table if exists public.ad_campaign_daily;
alter table public.product_funnel_settings
  drop column if exists naver_campaign_ids,
  drop column if exists google_campaign_ids,
  drop column if exists gfa_campaign_ids;
drop index if exists public.product_ad_spend_auto_uniq;
alter table public.product_ad_spend drop constraint if exists product_ad_spend_source_check;
alter table public.product_ad_spend add constraint product_ad_spend_source_check check (source in ('manual', 'meta'));
