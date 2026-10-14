-- [조회 전용] 사이트 DB 기준 월별·결제수단별 매출 — 토스페이먼츠 정산 내역과 대조용. 데이터를 바꾸지 않습니다.
-- payment_method: toss(카드 등 토스 결제) / points(포인트) / NULL(무료·관리자 부여) 등
select
  to_char(purchased_at at time zone 'Asia/Seoul', 'YYYY-MM')  as month_kst,
  coalesce(payment_method, '(없음)')                           as payment_method,
  count(*)                                                     as cnt,
  count(*) filter (where price > 0)                            as paid_cnt,
  sum(price)                                                   as revenue,
  count(*) filter (where payment_key is not null)              as with_payment_key
from purchases
group by 1, 2
order by 1 desc, 2;
