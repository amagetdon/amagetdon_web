-- 유료 강의 기수 번호 바로잡기 + 일괄 마감 (2026-11-24, 대표님 지시)
-- ① 환사장 4기 페이지(110·111·112): 11/20 전 결제 = 3기, 뒤 = 4기. 기수 번호 1→3, 2→4, 커리큘럼 기수 표시 1→3,
--    4기에는 3기 커리큘럼 구성(주차·제목·설명·순서)만 복사(영상 비움) → 4기 결제자에게 커리큘럼이 보이게.
-- ② 지난 유료 강의 40개: 제목·썸네일의 기수 번호로 그 기수를 지금 시각에 마감하고 다음 기수를 연다.
--    커리큘럼은 기수 전용으로 나누지 않는다(cohort_no 그대로 null) → 나중에 수강권을 다시 줘도 그대로 보임.
-- ③ 판매 중 표시 끄기: 35(맛집)·92(고운쌤 베이직)·134(테스트)
-- 제외: 환사장 22·30·79~82·113, 은우 다시보기 139~142, 공개 예정 145·146, 이미 마감된 35·57·59·130·131
-- 되돌리기: 20261124_cohort_renumber_close_rollback.sql
do $$
declare
  v_now timestamptz := now();
  t record;
  v_lc integer[]; v_le integer[];
begin
  -- 안전 확인: 환사장 4기는 지금 1기(마감)·2기(진행) 두 줄이어야 함
  if (select count(*) from product_cohorts where kind='course' and product_id in (110,111,112) and no in (1,2)) <> 6
     or exists (select 1 from product_cohorts where kind='course' and product_id in (110,111,112) and no > 2) then
    raise exception '환사장 4기 기수 상태가 예상과 다름 — 중단';
  end if;
  if exists (select 1 from curriculum_items where course_id in (110,111,112) and cohort_no is distinct from 1) then
    raise exception '환사장 4기 커리큘럼이 예상과 다름 — 중단';
  end if;

  -- ① 환사장
  update product_cohorts set no = no + 2, name = (no + 2) || '기'
   where kind='course' and product_id in (110,111,112);
  update curriculum_items set cohort_no = 3 where course_id in (110,111,112) and cohort_no = 1;
  insert into curriculum_items (course_id, week, label, description, sort_order, cohort_no)
  select ci.course_id, ci.week, ci.label, ci.description, ci.sort_order, 4
    from curriculum_items ci where ci.course_id in (110,111,112) and ci.cohort_no = 3
   order by ci.course_id, ci.sort_order, ci.id;

  -- ② 지난 유료 강의 일괄 마감
  for t in
    select * from (values
      (16,1),(17,1),(18,1),(38,1),(41,1),(47,1),(55,1),(67,1),(71,1),(88,1),(90,1),(92,1),(94,1),(95,1),
      (117,1),(118,1),(119,1),(123,1),(124,1),(125,1),(127,1),(128,1),(134,1),(136,1),
      (13,2),(43,2),(49,2),(72,2),(73,2),(74,2),(75,2),(76,2),(85,2),(86,2),
      (51,3),(77,3),(78,3),(103,3),(104,3),(105,3)
    ) as v(id, n)
  loop
    if not exists (select 1 from courses c where c.id = t.id and c.course_type = 'premium') then
      raise exception '강의 % 가 없거나 유료가 아님 — 중단', t.id;
    end if;
    if exists (select 1 from product_cohorts k where k.kind='course' and k.product_id = t.id) then
      raise exception '강의 % 에 이미 기수가 있음 — 중단', t.id;
    end if;
    select nullif(s.linked_course_ids, '{}'), nullif(s.linked_ebook_ids, '{}') into v_lc, v_le
      from product_funnel_settings s where s.kind='course' and s.product_id = t.id;
    insert into product_cohorts (kind, product_id, no, name, starts_at, ends_at, live_at, linked_course_ids, linked_ebook_ids)
    select 'course', t.id, t.n, t.n || '기', null, v_now, c.scheduled_at, v_lc, v_le from courses c where c.id = t.id;
    insert into product_cohorts (kind, product_id, no, name, starts_at, ends_at, live_at)
    values ('course', t.id, t.n + 1, (t.n + 1) || '기', v_now, null, null);
    v_lc := null; v_le := null;
  end loop;

  -- ③ 판매 중 표시 끄기
  update courses set is_on_sale = false where id in (35,92,134) and is_on_sale = true;
end $$;

-- 결과 확인
select c.id, c.title, string_agg(k.no||'기'||case when k.ends_at is null then '(진행)' else '(마감)' end, ', ' order by k.no) as cohorts, c.is_on_sale
  from courses c left join product_cohorts k on k.kind='course' and k.product_id=c.id
 where c.course_type='premium' group by c.id order by c.id;
