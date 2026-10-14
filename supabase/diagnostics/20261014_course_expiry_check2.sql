-- [조회 전용 2] 수강 기간이 잡힌 구매(expires_at 있음)가 어떤 기준으로 잡혔는지 — 데이터를 바꾸지 않습니다.
-- days_from_buy = 만료일 - 구매일(일). 다시보기 일수와 같으면 '구매일 기준', 모두 같은 만료일이면 '마감일 기준'(마감일이 그때는 있었음),
-- 그 밖은 관리자 수동 설정으로 볼 수 있습니다.
select
  c.id                                                         as course_id,
  left(c.title, 24)                                            as title,
  c.duration_days                                              as replay_days,
  round(extract(epoch from (p.expires_at - p.purchased_at)) / 86400)::int as days_from_buy,
  (p.expires_at at time zone 'Asia/Seoul')::date               as expires_kst,
  count(*)                                                     as cnt,
  (min(p.purchased_at) at time zone 'Asia/Seoul')::date        as first_buy,
  (max(p.purchased_at) at time zone 'Asia/Seoul')::date        as last_buy
from purchases p
join courses c on c.id = p.course_id
where p.expires_at is not null
  and coalesce(c.duration_days, 0) > 0
group by c.id, c.title, c.duration_days, days_from_buy, expires_kst
order by c.id desc, cnt desc
limit 200;
