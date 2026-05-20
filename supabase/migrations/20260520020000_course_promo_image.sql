-- 강의 상세 상단의 홍보 영역을 영상(video_url) 또는 이미지(promo_image_url) 중 택1로.
-- 둘 다 비어 있으면 홍보 영역 없음. 영상이 우선, 그 다음 이미지.
ALTER TABLE courses ADD COLUMN IF NOT EXISTS promo_image_url TEXT;
