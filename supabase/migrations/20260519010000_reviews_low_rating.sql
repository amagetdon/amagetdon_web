-- 후기 목록 정렬용 보조 컬럼: 1~2점 저평점 후기를 후순위로 배치하기 위함.
-- rating 으로부터 자동 계산되는 generated column 이라 별도 갱신 로직이 필요 없다.

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS is_low_rating BOOLEAN
  GENERATED ALWAYS AS (rating <= 2) STORED;
