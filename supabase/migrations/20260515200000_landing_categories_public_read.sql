-- 랜딩 카테고리: is_published 의미를 "상단 메뉴 노출 여부"로 한정
-- 비공개(is_published = false)여도 /landing/:slug 직접 접근은 허용해야 하므로
-- public SELECT 정책을 전체 행 허용으로 변경한다.
DROP POLICY IF EXISTS "Public read published landing categories" ON landing_categories;

CREATE POLICY "Public read landing categories" ON landing_categories
  FOR SELECT USING (true);
