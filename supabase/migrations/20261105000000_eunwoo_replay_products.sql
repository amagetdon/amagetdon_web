-- 은우 다시보기 랜딩(/lp/eunwoo-replay-p, -n) 판매 상품 6개 + '링크로만 판매' 표시 (2026-11-05)
-- is_unlisted = true 면 강의·전자책 목록·강사 페이지·검색·사이트맵에 안 나오고, 상세 주소로만 들어가 결제한다.
-- 상품은 비공개로 넣고, 목록 필터가 배포된 뒤에 공개한다(필터 배포 전에 목록에 잠깐 뜨는 것 방지).
-- 되돌리기: supabase/diagnostics/20261105_eunwoo_replay_products_rollback.sql

ALTER TABLE courses ADD COLUMN IF NOT EXISTS is_unlisted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE ebooks ADD COLUMN IF NOT EXISTS is_unlisted BOOLEAN NOT NULL DEFAULT false;
-- ebooks 는 칼럼별 읽기 권한이라 공개 목록 필터용 칼럼도 허용해야 한다
GRANT SELECT (is_unlisted) ON ebooks TO anon, authenticated;

WITH policy AS (
  SELECT $txt$- 결제일로부터 7일 이내, 다시보기와 전자책을 열람하지 않은 경우에만 환불됩니다.
- 디지털 콘텐츠 특성상 열람 후에는 환불이 불가합니다. 다시보기는 1강이라도 재생한 경우(재생 시간과 관계없이 10초라도), 전자책은 파일을 다운로드하거나 열람한 경우 열람으로 봅니다.
- 패키지는 다시보기와 전자책 중 일부만 열람한 경우에도 환불이 불가합니다.
- 다시보기 링크와 전자책은 결제 완료 후 개별 안내됩니다.$txt$ AS body
),
item(title, original_price, sale_price, folder) AS (
  VALUES
    ('[패키지] 인스타 알고리즘 마스터클래스 다시보기 + 전자책 (실천조사 혜택)', 2280000, 1490000, 'eunwoo-replay-p'),
    ('[다시보기] 인스타 알고리즘 마스터클래스 (실천조사 혜택)', 1890000, 1590000, 'eunwoo-replay-p'),
    ('[패키지] 인스타 알고리즘 마스터클래스 다시보기 + 전자책', 2280000, NULL, 'eunwoo-replay-n'),
    ('[다시보기] 인스타 알고리즘 마스터클래스', 1890000, NULL, 'eunwoo-replay-n')
)
INSERT INTO courses (title, instructor_id, course_type, original_price, sale_price, duration_days, installment_months,
                     thumbnail_url, landing_image_urls, refund_policy, is_on_sale, is_published, is_unlisted)
SELECT i.title, 3, 'premium', i.original_price, i.sale_price::integer, 90, 0,
       '/lp-assets/eunwoo-replay-thumb.jpg',
       ARRAY(SELECT '/lp-assets/' || i.folder || '/gif/' || lpad(n::text, 2, '0') || '.gif' FROM generate_series(1, 20) n ORDER BY n),
       p.body, true, false, true
  FROM item i CROSS JOIN policy p
 WHERE NOT EXISTS (SELECT 1 FROM courses c WHERE c.title = i.title);

WITH policy AS (
  SELECT $txt$- 결제일로부터 7일 이내, 전자책을 열람하지 않은 경우에만 환불됩니다.
- 디지털 콘텐츠 특성상 파일을 다운로드하거나 열람한 경우 환불이 불가합니다.
- 전자책은 결제 완료 후 개별 안내됩니다.$txt$ AS body
),
item(title, original_price, sale_price, folder) AS (
  VALUES
    ('[전자책] 월 1억 매출 만드는 마케팅의 정석 3권 세트 (실천조사 혜택)', 390000, 330000, 'eunwoo-replay-p'),
    ('[전자책] 월 1억 매출 만드는 마케팅의 정석 3권 세트', 390000, NULL, 'eunwoo-replay-n')
)
INSERT INTO ebooks (title, instructor_id, is_free, original_price, sale_price, duration_days,
                    thumbnail_url, landing_image_urls, refund_policy, is_on_sale, is_published, is_unlisted)
SELECT i.title, 3, false, i.original_price, i.sale_price::integer, 0,
       '/lp-assets/eunwoo-replay-thumb.jpg',
       ARRAY(SELECT '/lp-assets/' || i.folder || '/gif/' || lpad(n::text, 2, '0') || '.gif' FROM generate_series(1, 20) n ORDER BY n),
       p.body, true, false, true
  FROM item i CROSS JOIN policy p
 WHERE NOT EXISTS (SELECT 1 FROM ebooks e WHERE e.title = i.title);
