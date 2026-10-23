-- 커뮤니티 홈 배너에 이미지 걸기 (2026-10-23, 대표님 Run 한 번)
-- 이미지 배너: PC 이미지(필수) + 모바일 이미지(선택, 없으면 PC 이미지). 이미지가 있으면 글자형 대신 이미지로 보인다.
-- 기존 글자형 배너는 그대로(두 칸 모두 비어 있음). 이미지 파일은 기존 'banners' 저장소에 올라간다(관리자 업로드).
-- 되돌리기: supabase/diagnostics/20261023_community_banner_image_rollback.sql

alter table public.community_banners add column if not exists image_url text;
alter table public.community_banners add column if not exists image_url_mobile text;

-- 결과 확인(한 줄): image_url·image_url_mobile 칸이 생겼으면 cols = 2
select count(*) as cols from information_schema.columns
 where table_schema = 'public' and table_name = 'community_banners' and column_name in ('image_url', 'image_url_mobile');
