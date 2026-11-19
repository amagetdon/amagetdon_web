-- 강의 143(민태훈 2기로 따로 모집하던 강의)의 데이터를 강의 129의 2기로 합친다 (2026-11-19, 한 번만 실행)
--  1) 129 의 1기 마감 = 2기 시작 시각을 143 등록 시각(2026-11-13 11:57 한국 시간)으로 당긴다
--     (143 신청은 전부 그 뒤라 2기로 잡힌다. 129 의 1기 마지막 신청은 10/26 이라 1기 숫자는 변하지 않는다)
--  2) 143 의 신청(purchases)을 129 로 옮긴다
--  3) 143 의 방문 기록(product_visits)을 129 로 옮긴다. 같은 사람이 같은 날 두 강의를 다 본 줄은 143 쪽을 지운다(129 쪽에 이미 있음)
-- 건드리지 않는 것: 예약 알림 설정·대기 건, 발송 기록(webhook_logs), 강의 143 자체(삭제는 확인 뒤 따로)
-- 바꾸기 전 값은 merge_143_to_129_backup 표에 남긴다(관리자 화면·일반 회원은 못 읽음).
-- 되돌리기: supabase/diagnostics/20261119_merge_course_143_into_129_rollback.sql (강의 143 을 지우기 전까지만 가능)

begin;

create table if not exists public.merge_143_to_129_backup (
  tbl text not null,
  row_id text not null,
  old jsonb,
  at timestamptz not null default now()
);
alter table public.merge_143_to_129_backup enable row level security;
revoke all on public.merge_143_to_129_backup from anon, authenticated;

do $$
declare
  t constant timestamptz := '2026-11-13 02:57:36+00';
begin
  if not exists (select 1 from courses where id = 143) or not exists (select 1 from courses where id = 129) then
    raise exception '강의 129 또는 143 이 없습니다';
  end if;
  if exists (select 1 from merge_143_to_129_backup) then
    raise exception '이미 한 번 실행했습니다 (백업 표에 기록이 있음)';
  end if;
  if (select count(*) from product_cohorts where kind = 'course' and product_id = 129) <> 2
     or not exists (select 1 from product_cohorts where kind = 'course' and product_id = 129 and no = 2 and ends_at is null) then
    raise exception '129 의 기수 구성이 조사 때(1기 마감·2기 진행 중)와 다릅니다';
  end if;
  if exists (select 1 from product_cohorts where kind = 'course' and product_id = 143) then
    raise exception '143 에 기수가 만들어져 있습니다';
  end if;
  if exists (select 1 from purchases where course_id = 143 and purchased_at < t) then
    raise exception '143 에 2기 시작 시각보다 이른 신청이 있습니다';
  end if;
  if exists (select 1 from purchases p where p.course_id = 129 and p.purchased_at >= t
              and p.purchased_at < (select starts_at from product_cohorts where kind = 'course' and product_id = 129 and no = 2)) then
    raise exception '129 에 11/13 ~ 지금 2기 시작 사이의 신청이 있습니다 (1기 숫자가 바뀌게 됨)';
  end if;
end $$;

-- 1) 기수 경계
insert into merge_143_to_129_backup (tbl, row_id, old)
select 'product_cohorts', k.id::text, jsonb_build_object('starts_at', k.starts_at, 'ends_at', k.ends_at)
  from product_cohorts k where k.kind = 'course' and k.product_id = 129;
update product_cohorts set ends_at = '2026-11-13 02:57:36+00' where kind = 'course' and product_id = 129 and no = 1;
update product_cohorts set starts_at = '2026-11-13 02:57:36+00' where kind = 'course' and product_id = 129 and no = 2;

-- 2) 신청
insert into merge_143_to_129_backup (tbl, row_id, old)
select 'purchases', p.id::text, jsonb_build_object('course_id', p.course_id, 'title', p.title)
  from purchases p where p.course_id = 143;
update purchases set course_id = 129, title = (select c.title from courses c where c.id = 129) where course_id = 143;

-- 3) 방문 기록
insert into merge_143_to_129_backup (tbl, row_id, old)
select 'product_visits_deleted', a.id::text, to_jsonb(a)
  from product_visits a
 where a.kind = 'course' and a.product_id = 143
   and exists (select 1 from product_visits b where b.kind = 'course' and b.product_id = 129 and b.visitor_id = a.visitor_id and b.day = a.day);
delete from product_visits a
 where a.kind = 'course' and a.product_id = 143
   and exists (select 1 from product_visits b where b.kind = 'course' and b.product_id = 129 and b.visitor_id = a.visitor_id and b.day = a.day);
insert into merge_143_to_129_backup (tbl, row_id, old)
select 'product_visits_moved', a.id::text, null from product_visits a where a.kind = 'course' and a.product_id = 143;
update product_visits set product_id = 129 where kind = 'course' and product_id = 143;

commit;

-- 결과 확인 (숫자만)
select
  (select count(*) from merge_143_to_129_backup where tbl = 'purchases') as "옮긴 신청",
  (select count(*) from merge_143_to_129_backup where tbl = 'product_visits_moved') as "옮긴 방문",
  (select count(*) from merge_143_to_129_backup where tbl = 'product_visits_deleted') as "겹쳐서 지운 방문",
  (select count(*) from purchases where course_id = 143) as "143 에 남은 신청",
  (select count(*) from purchases p where p.course_id = 129 and p.purchased_at < '2026-11-13 02:57:36+00') as "129 1기 신청",
  (select count(*) from purchases p where p.course_id = 129 and p.purchased_at >= '2026-11-13 02:57:36+00') as "129 2기 신청";
