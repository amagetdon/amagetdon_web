-- [조회 전용] 수강 기간(purchases.expires_at) 무제한 점검 — 데이터를 바꾸지 않습니다.
-- 다시보기 기간(duration_days)이 설정된 강의별로, 수강 기간이 잡힌 건 / 무제한 건 / 구매일 범위를 보여줍니다.
-- last_dated_buy(기간이 잡힌 마지막 구매일) 이후로 무제한만 쌓였다면 그 시점부터 자동 부여가 끊긴 것.
select
  c.id                                                    as course_id,
  c.title,
  c.duration_days                                         as replay_days,
  c.enrollment_deadline at time zone 'Asia/Seoul'         as deadline_kst,
  count(*)                                                as total,
  count(*) filter (where p.expires_at is not null)        as dated,
  count(*) filter (where p.expires_at is null)            as unlimited,
  (min(p.purchased_at) at time zone 'Asia/Seoul')::date   as first_buy,
  (max(p.purchased_at) at time zone 'Asia/Seoul')::date   as last_buy,
  (max(p.purchased_at) filter (where p.expires_at is not null) at time zone 'Asia/Seoul')::date as last_dated_buy,
  (min(p.purchased_at) filter (where p.expires_at is null) at time zone 'Asia/Seoul')::date     as first_unlimited_buy
from purchases p
join courses c on c.id = p.course_id
where coalesce(c.duration_days, 0) > 0
group by c.id
order by unlimited desc, c.id desc;
