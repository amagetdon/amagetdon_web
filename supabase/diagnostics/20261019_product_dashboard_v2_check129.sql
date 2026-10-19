-- [2-2단계] 새 이름 함수로 129번 계산이 끝나는지 확인 (읽기 전용 SELECT) — 2026-10-19, PR #75
select set_config('request.jwt.claims',
  json_build_object('sub', (select id from profiles where role = 'admin' order by created_at limit 1)::text, 'role', 'authenticated')::text, true);
select clock_timestamp() as started,
       (public.get_product_dashboard_v2('course', 129))->'totals' as totals_129,
       (public.get_product_dashboard_v2('course', 129))->'visits'->>'visitors' as visitors_129,
       clock_timestamp() as finished;
