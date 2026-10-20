-- 되돌리기: 20261020000000_site_settings_hide_secrets.sql
-- 공개 읽기 정책을 예전(모든 줄 공개)으로 돌리고 공개 키 줄을 지운다. 비밀키가 다시 누구나 읽히는 상태가 되므로 결제가 멈췄을 때만 쓴다.
-- 웹 코드는 공개 키 줄이 없으면 예전 줄에서 공개 키를 읽으므로 이 SQL 뒤에도 결제창은 열린다.
drop policy if exists "Public read site_settings (no secrets)" on public.site_settings;
drop policy if exists "Public read site_settings" on public.site_settings;
create policy "Public read site_settings" on public.site_settings for select using (true);
delete from public.site_settings where key = 'toss_payments_public';
