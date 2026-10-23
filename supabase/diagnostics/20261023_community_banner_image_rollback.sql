-- 되돌리기: 20261023000000_community_banner_image.sql (배너 이미지 칸 지우기 — 걸어 둔 이미지 주소도 함께 사라짐)
alter table public.community_banners drop column if exists image_url_mobile;
alter table public.community_banners drop column if exists image_url;
