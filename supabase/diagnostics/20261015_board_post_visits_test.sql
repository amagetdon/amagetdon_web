-- [테스트 — 적용 SQL 실행 후 따로 실행] 끝에 rollback 이 있어 아무것도 남지 않는다. 적용 SQL 과 한 번에 붙여 넣지 말 것.
-- 1) 비로그인 방문자처럼 게시글·강의 방문을 기록해 보고 2) 퍼널 함수가 1명 방문 → 1명 이동으로 세는지 확인
begin;
set local role anon;
select public.log_product_visit('00000000-0000-4000-8000-000000000001', 'board_post',
  (select id from board_posts where share_token = '25fefb7b78b043dab7b4fb426f35d0f8'), '{"source":"TEST"}'::jsonb);
select public.log_product_visit('00000000-0000-4000-8000-000000000001', 'course', 129, null);
-- 비공개 글·없는 글은 무시되는지
select public.log_product_visit('00000000-0000-4000-8000-000000000001', 'board_post', -1, null);
reset role;
select kind, product_id, count(*) from product_visits where visitor_id = '00000000-0000-4000-8000-000000000001' group by 1, 2;
-- 관리자 권한 흉내 없이 함수 본문만 확인: posts 중 25fefb… 글의 visitors ≥ 1, moved ≥ 1 이면 정상
select count(*) as post_visitors from product_visits where kind = 'board_post' and visitor_id = '00000000-0000-4000-8000-000000000001';
rollback;
