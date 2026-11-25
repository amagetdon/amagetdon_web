-- 되돌리기: 20261125100000_interview_videos.sql
-- 인터뷰 영상 등록 기록이 같이 지워진다.
drop table if exists public.product_interview_videos;
notify pgrst, 'reload schema';
