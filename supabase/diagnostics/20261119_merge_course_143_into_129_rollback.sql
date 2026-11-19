-- 되돌리기: 20261119_merge_course_143_into_129.sql
-- 강의 143 이 아직 있을 때만 가능하다 (지운 뒤에는 옮긴 신청을 143 으로 돌려놓을 수 없다).
-- 백업 표(merge_143_to_129_backup)에 남긴 값으로 신청·방문·기수 경계를 합치기 전으로 돌린다.

begin;

do $$
begin
  if not exists (select 1 from courses where id = 143) then
    raise exception '강의 143 이 없어 되돌릴 수 없습니다';
  end if;
  if not exists (select 1 from merge_143_to_129_backup) then
    raise exception '백업 기록이 없습니다';
  end if;
end $$;

-- 신청
update purchases p
   set course_id = (b.old ->> 'course_id')::integer, title = b.old ->> 'title'
  from merge_143_to_129_backup b
 where b.tbl = 'purchases' and p.id::text = b.row_id;

-- 방문 기록: 옮긴 줄은 143 으로, 지운 줄은 다시 넣는다
update product_visits v set product_id = 143
  from merge_143_to_129_backup b
 where b.tbl = 'product_visits_moved' and v.id::text = b.row_id;
insert into product_visits
select (jsonb_populate_record(null::product_visits, b.old)).*
  from merge_143_to_129_backup b
 where b.tbl = 'product_visits_deleted';

-- 기수 경계 (2기 시작을 먼저 돌려야 '마감 > 시작' 조건에 안 걸린다)
update product_cohorts k
   set starts_at = (b.old ->> 'starts_at')::timestamptz
  from merge_143_to_129_backup b
 where b.tbl = 'product_cohorts' and k.id::text = b.row_id and k.no = 2;
update product_cohorts k
   set ends_at = (b.old ->> 'ends_at')::timestamptz
  from merge_143_to_129_backup b
 where b.tbl = 'product_cohorts' and k.id::text = b.row_id and k.no = 1;

drop table public.merge_143_to_129_backup;

commit;
