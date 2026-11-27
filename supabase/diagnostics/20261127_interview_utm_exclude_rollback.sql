-- 되돌리기: migrations/20261127100000_interview_utm_exclude.sql
alter table public.product_funnel_settings drop column if exists interview_utm_excluded;
