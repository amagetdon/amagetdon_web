-- 이미지 업로드 한도를 150MB 로 상향. 강의/전자책 분할 상세 이미지 등 원본 그대로
-- 올리는 케이스 대응. (video 는 별도 흐름이라 여기서는 그대로 두고, 이미지 위주 버킷만)
-- 150MB = 150 * 1024 * 1024 = 157,286,400 bytes

update storage.buckets
   set file_size_limit = 157286400
 where id in ('courses', 'ebooks', 'instructors', 'banners', 'coupons', 'achievements', 'results');
