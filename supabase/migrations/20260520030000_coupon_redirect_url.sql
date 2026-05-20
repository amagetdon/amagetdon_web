-- 쿠폰 받기 후 이동할 채널 링크. 비어 있으면 이동 없음.
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS redirect_url TEXT;
