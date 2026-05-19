-- 강의/전자책 상세페이지 분할 이미지에 이미지별 클릭 링크(페이지 이동 URL) 지원
-- landing_image_urls 와 인덱스 정렬된 병렬 배열. 빈 문자열 = 링크 없음.

ALTER TABLE courses ADD COLUMN IF NOT EXISTS landing_image_links TEXT[];
ALTER TABLE ebooks  ADD COLUMN IF NOT EXISTS landing_image_links TEXT[];
