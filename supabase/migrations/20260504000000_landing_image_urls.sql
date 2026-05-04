-- 강의/전자책 상세페이지 분할 이미지(여러 장) 지원
-- 기존 단일 컬럼 landing_image_url 은 보존하고, 신규 컬럼 landing_image_urls (TEXT[]) 추가.
-- 기존 데이터는 단일 URL 을 1개짜리 배열로 백필.

ALTER TABLE courses ADD COLUMN IF NOT EXISTS landing_image_urls TEXT[];
ALTER TABLE ebooks ADD COLUMN IF NOT EXISTS landing_image_urls TEXT[];

UPDATE courses
   SET landing_image_urls = ARRAY[landing_image_url]
 WHERE landing_image_urls IS NULL
   AND landing_image_url IS NOT NULL
   AND landing_image_url <> '';

UPDATE ebooks
   SET landing_image_urls = ARRAY[landing_image_url]
 WHERE landing_image_urls IS NULL
   AND landing_image_url IS NOT NULL
   AND landing_image_url <> '';
