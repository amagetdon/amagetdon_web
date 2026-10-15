-- 129 강의 상세 이미지 14장을 원래 주소(.gif/.jpg)로 되돌림 (webp 교체 취소)
-- 원본(.gif/.jpg)은 R2 에 그대로 남겨 둠. 링크(landing_image_links)는 건드리지 않음 — 순서 그대로라 링크도 그대로 맞음.
-- 목록에 없는 주소(첫 장 0ajm83oz 등)는 그대로 둠. 교체: 20261015_img129_webp_swap.sql
WITH map(new_url, old_url) AS (VALUES
    ('https://pub-95b8f0f45b784ba4a86ae023b75f8940.r2.dev/courses/129/landing/1790956183749_af5lru3o.gif', 'https://pub-95b8f0f45b784ba4a86ae023b75f8940.r2.dev/courses/129/landing/1790956183749_af5lru3o.webp'),
    ('https://pub-95b8f0f45b784ba4a86ae023b75f8940.r2.dev/courses/129/landing/1790956187034_q6cuib0b.jpg', 'https://pub-95b8f0f45b784ba4a86ae023b75f8940.r2.dev/courses/129/landing/1790956187034_q6cuib0b.webp'),
    ('https://pub-95b8f0f45b784ba4a86ae023b75f8940.r2.dev/courses/129/landing/1790956188122_k3l7ktrd.gif', 'https://pub-95b8f0f45b784ba4a86ae023b75f8940.r2.dev/courses/129/landing/1790956188122_k3l7ktrd.webp'),
    ('https://pub-95b8f0f45b784ba4a86ae023b75f8940.r2.dev/courses/129/landing/1790956189428_zw81et0b.jpg', 'https://pub-95b8f0f45b784ba4a86ae023b75f8940.r2.dev/courses/129/landing/1790956189428_zw81et0b.webp'),
    ('https://pub-95b8f0f45b784ba4a86ae023b75f8940.r2.dev/courses/129/landing/1790956191146_089njnv7.gif', 'https://pub-95b8f0f45b784ba4a86ae023b75f8940.r2.dev/courses/129/landing/1790956191146_089njnv7.webp'),
    ('https://pub-95b8f0f45b784ba4a86ae023b75f8940.r2.dev/courses/129/landing/1790956193059_cwbohjrx.gif', 'https://pub-95b8f0f45b784ba4a86ae023b75f8940.r2.dev/courses/129/landing/1790956193059_cwbohjrx.webp'),
    ('https://pub-95b8f0f45b784ba4a86ae023b75f8940.r2.dev/courses/129/landing/1790956200449_vmhs1fqw.jpg', 'https://pub-95b8f0f45b784ba4a86ae023b75f8940.r2.dev/courses/129/landing/1790956200449_vmhs1fqw.webp'),
    ('https://pub-95b8f0f45b784ba4a86ae023b75f8940.r2.dev/courses/129/landing/1790956202083_ei1unqlb.gif', 'https://pub-95b8f0f45b784ba4a86ae023b75f8940.r2.dev/courses/129/landing/1790956202083_ei1unqlb.webp'),
    ('https://pub-95b8f0f45b784ba4a86ae023b75f8940.r2.dev/courses/129/landing/1790956203422_upub4jxb.jpg', 'https://pub-95b8f0f45b784ba4a86ae023b75f8940.r2.dev/courses/129/landing/1790956203422_upub4jxb.webp'),
    ('https://pub-95b8f0f45b784ba4a86ae023b75f8940.r2.dev/courses/129/landing/1791781688468_ywpwoe0z.gif', 'https://pub-95b8f0f45b784ba4a86ae023b75f8940.r2.dev/courses/129/landing/1791781688468_ywpwoe0z.webp'),
    ('https://pub-95b8f0f45b784ba4a86ae023b75f8940.r2.dev/courses/129/landing/1791789510046_b9a73jf5.gif', 'https://pub-95b8f0f45b784ba4a86ae023b75f8940.r2.dev/courses/129/landing/1791789510046_b9a73jf5.webp'),
    ('https://pub-95b8f0f45b784ba4a86ae023b75f8940.r2.dev/courses/129/landing/1791790043990_vam1zyvr.jpg', 'https://pub-95b8f0f45b784ba4a86ae023b75f8940.r2.dev/courses/129/landing/1791790043990_vam1zyvr.webp'),
    ('https://pub-95b8f0f45b784ba4a86ae023b75f8940.r2.dev/courses/129/landing/1791790052446_vdv4zobr.jpg', 'https://pub-95b8f0f45b784ba4a86ae023b75f8940.r2.dev/courses/129/landing/1791790052446_vdv4zobr.webp'),
    ('https://pub-95b8f0f45b784ba4a86ae023b75f8940.r2.dev/courses/129/landing/1791793393568_trvdushk.gif', 'https://pub-95b8f0f45b784ba4a86ae023b75f8940.r2.dev/courses/129/landing/1791793393568_trvdushk.webp')
)
UPDATE courses c
   SET landing_image_urls = ARRAY(
         SELECT COALESCE(m.old_url, u)
           FROM unnest(c.landing_image_urls) WITH ORDINALITY AS t(u, i)
           LEFT JOIN map m ON m.new_url = u
          ORDER BY i)
 WHERE c.id = 129
RETURNING c.id,
          cardinality(c.landing_image_urls) AS total_images,
          (SELECT count(*) FROM unnest(c.landing_image_urls) u WHERE u LIKE '%.webp') AS webp_images;
-- 기대값: total_images 15, webp_images 0
