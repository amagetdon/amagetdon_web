-- PG(토스 통합결제조회) 대사용 일회성 집계 조회 — 데이터 변경 없음.
-- 2026-07-16 ~ 07-23(KST) 구간의 purchases / linkpay_payments 집계를 NOTICE 로 출력해
-- 상점관리자 정산 수치와 사이트 매출 통계가 다른 원인을 확인한다.

DO $$
DECLARE r RECORD;
BEGIN
  RAISE NOTICE '=== purchases: 결제수단별 (7/16~7/23 KST) ===';
  FOR r IN
    SELECT COALESCE(payment_method, '(없음=포인트/수기)') AS method, COUNT(*) AS cnt, SUM(price) AS total
    FROM purchases
    WHERE purchased_at >= '2026-07-15 15:00:00+00' AND purchased_at < '2026-07-23 15:00:00+00'
    GROUP BY 1 ORDER BY 1
  LOOP
    RAISE NOTICE 'method=% | cnt=% | total=%', r.method, r.cnt, r.total;
  END LOOP;

  RAISE NOTICE '=== purchases: 일별 (KST, 유료만 price>0) ===';
  FOR r IN
    SELECT (purchased_at + interval '9 hours')::date AS d,
           COUNT(*) AS cnt, SUM(price) AS total,
           COUNT(*) FILTER (WHERE payment_method = 'toss') AS toss_cnt,
           SUM(price) FILTER (WHERE payment_method = 'toss') AS toss_total
    FROM purchases
    WHERE purchased_at >= '2026-07-15 15:00:00+00' AND purchased_at < '2026-07-23 15:00:00+00'
      AND price > 0
    GROUP BY 1 ORDER BY 1
  LOOP
    RAISE NOTICE 'day=% | 전체 cnt=% total=% | toss cnt=% total=%', r.d, r.cnt, r.total, r.toss_cnt, r.toss_total;
  END LOOP;

  RAISE NOTICE '=== purchases 개별 건 (7/16~7/23 KST, price>0) ===';
  FOR r IN
    SELECT p.id, (p.purchased_at + interval '9 hours') AS at_kst, p.price,
           COALESCE(p.payment_method, '-') AS method,
           p.course_id, p.ebook_id, p.board_post_id, p.board_instructor_id
    FROM purchases p
    WHERE p.purchased_at >= '2026-07-15 15:00:00+00' AND p.purchased_at < '2026-07-23 15:00:00+00'
      AND p.price > 0
    ORDER BY p.purchased_at
  LOOP
    RAISE NOTICE 'at=% | price=% | method=% | course=% ebook=% bpost=% bins=%',
      r.at_kst, r.price, r.method, r.course_id, r.ebook_id, r.board_post_id, r.board_instructor_id;
  END LOOP;

  RAISE NOTICE '=== linkpay_payments: 상태별 (승인일 7/16~7/23) ===';
  FOR r IN
    SELECT status, granted, COUNT(*) AS cnt, SUM(amount) AS total
    FROM linkpay_payments
    WHERE approved_at IS NOT NULL
      AND approved_at::timestamptz >= '2026-07-15 15:00:00+00'
      AND approved_at::timestamptz < '2026-07-23 15:00:00+00'
    GROUP BY 1, 2 ORDER BY 1, 2
  LOOP
    RAISE NOTICE 'status=% granted=% | cnt=% | total=%', r.status, r.granted, r.cnt, r.total;
  END LOOP;

  RAISE NOTICE '=== linkpay_payments: 미지급(granted=false, DONE) 사유 분포 ===';
  FOR r IN
    SELECT (matched_user_id IS NULL) AS no_user, (course_id IS NULL AND ebook_id IS NULL) AS no_product,
           COUNT(*) AS cnt, SUM(amount) AS total
    FROM linkpay_payments
    WHERE status = 'DONE' AND granted = FALSE
    GROUP BY 1, 2 ORDER BY 1, 2
  LOOP
    RAISE NOTICE 'no_user=% no_product=% | cnt=% | total=%', r.no_user, r.no_product, r.cnt, r.total;
  END LOOP;
END $$;
