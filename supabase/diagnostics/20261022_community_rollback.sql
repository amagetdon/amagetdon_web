-- 되돌리기: 20261022000000_community.sql (커뮤니티 MVP)
-- 주의: 커뮤니티 글·댓글·사진 기록이 모두 지워진다. 출시 전(데이터 없을 때)에만 그대로 Run.
--       출시 뒤라면 먼저 백업을 받고 대표님 확인 후 실행.
-- 사진 파일: 'community' 버킷에 파일이 남아 있으면 버킷은 지워지지 않는다(마지막 줄 오류).
--            그때는 Supabase Storage 화면에서 community 버킷을 비우고 지운다(직접 삭제가 막혀 있으면 마지막 줄 대신 화면에서 버킷 삭제).

drop policy if exists community_obj_insert on storage.objects;
drop policy if exists community_obj_read on storage.objects;
drop policy if exists community_obj_delete on storage.objects;

drop function if exists public.community_view_post(bigint);
drop function if exists public.community_delete_post(bigint);
drop function if exists public.community_delete_comment(bigint);
drop function if exists public.community_get_hot(text);
drop function if exists public.community_my_stats();
drop function if exists public.community_board_new_counts();
drop function if exists public.community_remind_instructor(bigint);
drop function if exists public.community_my_access();

drop table if exists public.community_notifications cascade;
drop table if exists public.community_hot cascade;
drop table if exists public.community_board_reads cascade;
drop table if exists public.community_favorites cascade;
drop table if exists public.community_blocklist cascade;
drop table if exists public.community_tiles cascade;
drop table if exists public.community_banners cascade;
drop table if exists public.community_pins cascade;
drop table if exists public.community_post_views cascade;
drop table if exists public.community_reports cascade;
drop table if exists public.community_saves cascade;
drop table if exists public.community_reactions cascade;
drop table if exists public.community_comments cascade;
drop table if exists public.community_post_images cascade;
drop table if exists public.community_posts cascade;
drop table if exists public.community_sanctions cascade;
drop table if exists public.community_members cascade;
drop table if exists public.community_boards cascade;
drop table if exists public.community_board_groups cascade;

drop function if exists public.community_can_read_post(bigint);
drop function if exists public.community_can_write_board(int);
drop function if exists public.community_can_read_board(int);
drop function if exists public.community_level_ok(text, int[]);
drop function if exists public.community_is_course_instructor(int[]);
drop function if exists public.community_is_staff();
drop function if exists public.community_check_blocklist(text);
drop function if exists public.community_members_guard();
drop function if exists public.community_posts_guard();
drop function if exists public.community_comments_guard();
drop function if exists public.community_comments_after();
drop function if exists public.community_reactions_after();
drop function if exists public.community_images_after();
drop function if exists public.community_reports_after();
drop function if exists public.community_notifications_guard();

-- pg_trgm 확장은 다른 곳에서 쓸 수 있어 남겨 둔다.
delete from storage.buckets where id = 'community';
