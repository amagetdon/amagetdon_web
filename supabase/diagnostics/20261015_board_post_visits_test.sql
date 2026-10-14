-- [테스트 — 적용 SQL 실행 후 따로 실행] 끝에 rollback 이 있어 아무것도 남지 않는다. 적용 SQL 과 한 번에 붙여 넣지 말 것.
-- 비로그인 방문자처럼 데이블 B 글(id 17)·강의 129 방문을 기록해 보고, 없는 글은 무시되는지 확인
begin;
set local role anon;
select public.log_product_visit('00000000-0000-4000-8000-000000000001'::uuid, 'board_post', 17, '{"source":"TEST"}'::jsonb);
select public.log_product_visit('00000000-0000-4000-8000-000000000001'::uuid, 'course', 129, null::jsonb);
select public.log_product_visit('00000000-0000-4000-8000-000000000001'::uuid, 'board_post', -1, null::jsonb);
reset role;
-- 정상: board_post 1 · course 1 (없는 글 -1 은 기록 안 됨)
select string_agg(kind || ':' || product_id || '=' || n, ', ' order by kind) as result
  from (select kind, product_id, count(*) as n from product_visits
         where visitor_id = '00000000-0000-4000-8000-000000000001'::uuid group by 1, 2) t;
rollback;
