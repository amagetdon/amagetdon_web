-- 인터뷰 채널 영상 '등록 안 된 유튜브 UTM' 에서 제외한 UTM (상품별, campaign|content|term 소문자 키)
-- 되돌리기: diagnostics/20261127_interview_utm_exclude_rollback.sql
alter table public.product_funnel_settings
  add column if not exists interview_utm_excluded text[] not null default '{}';
