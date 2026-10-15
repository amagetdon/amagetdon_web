-- 129 상세 이미지 8번째·14번째(신청 버튼 그림)를 눌렀을 때 신청으로 이어지게 링크 '#apply' 설정 (2026-10-15)
-- 다른 이미지 링크·이미지 주소는 건드리지 않음. 코드(#apply 처리)가 배포된 뒤에 실행할 것.
UPDATE courses
   SET landing_image_links = (
         SELECT array_agg(CASE WHEN i IN (8, 14) THEN '#apply' ELSE coalesce(l, '') END ORDER BY i)
           FROM generate_subscripts(landing_image_urls, 1) AS i
           LEFT JOIN LATERAL (SELECT landing_image_links[i] AS l) x ON true)
 WHERE id = 129
   AND cardinality(landing_image_urls) = 14
   AND landing_image_urls[8] LIKE '%vdv4zobr.webp'
   AND landing_image_urls[14] LIKE '%vam1zyvr.webp'
RETURNING id, landing_image_links[8] AS link8, landing_image_links[14] AS link14, cardinality(landing_image_links) AS links;
-- 기대값: 129 | #apply | #apply | 14   (0행이면 이미지 순서가 바뀐 것 — 실행 안 된 것이니 알려 주세요)

-- 되돌리기(링크 비우기):
-- UPDATE courses SET landing_image_links[8] = '', landing_image_links[14] = '' WHERE id = 129;
