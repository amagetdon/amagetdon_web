-- 관리자 대시보드 성능 모니터 — DB/Storage 통계를 한 번의 RPC 로 묶어서 노출.
-- SECURITY DEFINER 로 시스템 카탈로그 / storage.objects 접근, profiles.role='admin' 만 호출 허용.

create or replace function public.admin_performance_metrics()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_caller_role text;
  v_result jsonb;
  v_db_oid oid := (select oid from pg_database where datname = current_database());
  v_max_connections int := current_setting('max_connections')::int;
begin
  -- admin 만 허용. service_role 은 auth.uid() 가 null 이라 그대로 통과.
  if auth.uid() is not null then
    select role into v_caller_role from public.profiles where id = auth.uid();
    if v_caller_role is null or v_caller_role <> 'admin' then
      raise exception 'admin only' using errcode = '42501';
    end if;
  end if;

  with
    db_stats as (
      select numbackends, xact_commit, xact_rollback, blks_read, blks_hit, deadlocks, temp_files, temp_bytes
        from pg_stat_database where datid = v_db_oid
    ),
    activity as (
      select
        count(*) filter (where state = 'active' and pid <> pg_backend_pid()) as active_queries,
        count(*) filter (where state = 'idle in transaction')                as idle_in_xact,
        max(extract(epoch from (now() - query_start)))
          filter (where state = 'active' and pid <> pg_backend_pid())        as longest_active_seconds
        from pg_stat_activity where datid = v_db_oid
    ),
    db_size as (select pg_database_size(v_db_oid) as bytes),
    -- 사용자 테이블 (public 스키마) 크기 / row 수 top 15
    table_sizes as (
      select
        c.relname as table_name,
        coalesce(s.n_live_tup, 0) as live_rows,
        pg_total_relation_size(c.oid) as total_bytes,
        pg_relation_size(c.oid) as table_bytes
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      left join pg_stat_user_tables s on s.relid = c.oid
      where n.nspname = 'public'
        and c.relkind = 'r'
      order by pg_total_relation_size(c.oid) desc
      limit 15
    ),
    -- storage 객체 (버킷별 합계)
    bucket_stats as (
      select
        bucket_id,
        count(*) as files,
        coalesce(sum((metadata->>'size')::bigint), 0) as bytes
      from storage.objects
      group by bucket_id
    ),
    auth_stats as (
      select
        (select count(*) from auth.users) as total_users,
        (select count(*) from auth.users where created_at >= now() - interval '7 days') as new_users_7d,
        (select count(*) from auth.users where last_sign_in_at >= now() - interval '7 days') as active_users_7d
    )
  select jsonb_build_object(
    'fetched_at', now(),
    'database', jsonb_build_object(
      'name', current_database(),
      'version', current_setting('server_version'),
      'size_bytes', (select bytes from db_size),
      'max_connections', v_max_connections
    ),
    'connections', jsonb_build_object(
      'current', (select numbackends from db_stats),
      'max', v_max_connections,
      'active_queries', (select active_queries from activity),
      'idle_in_transaction', (select idle_in_xact from activity),
      'longest_active_seconds', (select longest_active_seconds from activity)
    ),
    'traffic', jsonb_build_object(
      'xact_commit', (select xact_commit from db_stats),
      'xact_rollback', (select xact_rollback from db_stats),
      'blks_read', (select blks_read from db_stats),
      'blks_hit', (select blks_hit from db_stats),
      'cache_hit_ratio',
        case when ((select blks_hit from db_stats) + (select blks_read from db_stats)) = 0 then null
             else (select blks_hit from db_stats)::float / nullif((select blks_hit from db_stats) + (select blks_read from db_stats), 0)
        end,
      'deadlocks', (select deadlocks from db_stats),
      'temp_files', (select temp_files from db_stats),
      'temp_bytes', (select temp_bytes from db_stats)
    ),
    'tables', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'name', table_name,
        'live_rows', live_rows,
        'total_bytes', total_bytes,
        'table_bytes', table_bytes
      ) order by total_bytes desc), '[]'::jsonb)
      from table_sizes
    ),
    'storage', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'bucket', bucket_id,
        'files', files,
        'bytes', bytes
      ) order by bytes desc), '[]'::jsonb)
      from bucket_stats
    ),
    'auth', (
      select to_jsonb(auth_stats.*) from auth_stats
    )
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.admin_performance_metrics() from public;
grant execute on function public.admin_performance_metrics() to authenticated;
