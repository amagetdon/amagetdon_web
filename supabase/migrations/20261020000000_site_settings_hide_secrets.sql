-- 결제 비밀키 공개 차단 (2026-10-20, 대표님이 SQL Editor 에서 직접 Run — 웹 코드 배포 뒤에)
-- 배경: site_settings 에 "Public read site_settings"(조건 없음) 정책이 있어 로그인하지 않은 방문자도 모든 줄을 읽을 수 있었고,
--       'toss_payments' 줄에 토스 secretKey·billingSecretKey 가 clientKey 와 함께 들어 있었다.
-- 1) 브라우저 결제창이 쓰는 공개 키만 'toss_payments_public' 줄로 복사한다(값은 DB 안에서만 옮기고 화면에 내지 않는다).
-- 2) 공개 읽기 정책을 비밀값이 든 줄을 뺀 것으로 바꾼다: 'toss_payments'(결제 비밀키), 'webhook_config'(예전 웹훅 설정·요청 헤더, 지금 코드는 안 씀).
--    관리자 정책("Admin manage site_settings")과 서버 함수(service role)는 그대로 모든 줄을 읽는다.
-- 이 SQL 은 키를 바꾸지 않는다. 실행 뒤 토스 상점관리자에서 시크릿 키를 재발급하고 어드민 > 사이트 설정에 새 키를 넣어 저장한다.
-- 되돌리기: supabase/diagnostics/20261020_site_settings_hide_secrets_rollback.sql

insert into public.site_settings (key, value)
select 'toss_payments_public',
       jsonb_build_object('clientKey', coalesce(value->>'clientKey', ''), 'billingClientKey', coalesce(value->>'billingClientKey', ''))
  from public.site_settings
 where key = 'toss_payments'
on conflict (key) do update set value = excluded.value;

drop policy if exists "Public read site_settings" on public.site_settings;
drop policy if exists "Public read site_settings (no secrets)" on public.site_settings;
create policy "Public read site_settings (no secrets)" on public.site_settings
  for select using (key not in ('toss_payments', 'webhook_config'));

-- 확인(값은 보지 않고 칸 이름·정책만)
select 'row' as kind, key as name,
       (select string_agg(k, ', ' order by k) from jsonb_object_keys(value) k) as detail
  from public.site_settings where key in ('toss_payments', 'toss_payments_public')
union all
select 'policy', polname, coalesce(pg_get_expr(polqual, polrelid), '-')
  from pg_policy where polrelid = 'public.site_settings'::regclass;
