-- [2단계] 기존 함수 vs 새 이름 함수 숫자 비교 (읽기 전용 SELECT) — 2026-10-19, PR #75
-- 관리자 계정으로 부른 것처럼 설정(이 실행 안에서만)한 뒤, 129번을 뺀 최근 강의 15개를 두 함수로 계산해 비교한다.
-- 줄 순서는 비교에서 빼고(정렬 후 비교) 내용만 본다. 모든 *_same 칸이 true 면 3단계(교체)로 간다.
select set_config('request.jwt.claims',
  json_build_object('sub', (select id from profiles where role = 'admin' order by created_at limit 1)::text, 'role', 'authenticated')::text, true);

with c as (
  select id from courses
   where id <> 129 and id in (select product_id from product_visits where kind = 'course')
   order by id desc limit 15
), d as (
  select c.id, public.get_product_dashboard('course', c.id) as a, public.get_product_dashboard_v2('course', c.id) as b from c
)
select id,
       a->'totals' = b->'totals' as totals_same,
       a->'visits' = b->'visits' as visits_same,
       (a->'dday') is not distinct from (b->'dday') as dday_same,
       (select jsonb_agg(x order by x::text) from jsonb_array_elements(a->'rows') x)
         is not distinct from (select jsonb_agg(x order by x::text) from jsonb_array_elements(b->'rows') x) as rows_same,
       (select jsonb_agg(x order by x::text) from jsonb_array_elements(a->'visit_rows') x)
         is not distinct from (select jsonb_agg(x order by x::text) from jsonb_array_elements(b->'visit_rows') x) as visit_rows_same,
       a->'totals'->>'applicants' as applicants, a->'visits'->>'visitors' as visitors
  from d
 order by id desc;
