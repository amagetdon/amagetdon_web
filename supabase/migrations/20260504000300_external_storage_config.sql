-- 외부 스토리지 (R2 등) 설정. credentials 는 DB 에 저장하고 admin UI 에서 관리.
-- secret 노출을 막기 위해 클라이언트는 RPC 로 공개 영역 (enabled, public_base_url) 만 조회한다.

create table if not exists public.external_storage_config (
  id text primary key default 'r2',
  provider text not null default 'r2',
  enabled boolean not null default false,
  -- 공개 영역
  public_base_url text,
  -- 비밀 영역 — RLS / 컬럼 grant 로 admin/service_role 외 접근 차단
  account_id text,
  bucket text,
  endpoint text,
  access_key_id text,
  secret_access_key text,
  updated_at timestamptz not null default now()
);

alter table public.external_storage_config enable row level security;

drop policy if exists "admin all on external_storage_config" on public.external_storage_config;
create policy "admin all on external_storage_config" on public.external_storage_config
  for all
  using (
    coalesce((select role from public.profiles where id = auth.uid()), '') = 'admin'
  )
  with check (
    coalesce((select role from public.profiles where id = auth.uid()), '') = 'admin'
  );

-- 클라이언트(브라우저)는 secret 컬럼 보면 안 되니, 공개 영역만 노출하는 RPC.
-- security definer 라 RLS 우회. anon/authenticated 둘 다 호출 가능.
create or replace function public.get_storage_config_public()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select coalesce(
    (select jsonb_build_object(
       'provider', provider,
       'enabled', enabled,
       'public_base_url', public_base_url
     ) from public.external_storage_config where id = 'r2'),
    jsonb_build_object('provider', 'r2', 'enabled', false, 'public_base_url', null)
  );
$$;

revoke all on function public.get_storage_config_public() from public;
grant execute on function public.get_storage_config_public() to anon, authenticated;

-- 초기 비활성 행
insert into public.external_storage_config (id, provider, enabled)
  values ('r2', 'r2', false)
  on conflict (id) do nothing;
