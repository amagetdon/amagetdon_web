-- 게시글 방문 기록 + 게시글 → 강의 이동 → 신청 집계 (2026-10-15, 미적용 — 승인 후 실행)
-- 배경: 데이블 B 게시글은 방문(365)·강의 이동(17)을 데이블·Umami 로만 볼 수 있고 사이트 안에서 이어서 볼 수 없었다.
-- 1) product_visits.kind 에 'board_post' 허용 (공개 글만 기록)
-- 2) log_product_visit 가 게시글도 받도록 (기존 강의·전자책 동작 동일)
-- 3) get_course_board_funnel(강의 id): 이 강의로 링크한 게시글별 방문자 → 같은 방문자의 강의 페이지 방문 → 그 방문자의 신청
--    방문자 연결은 브라우저 방문자 ID(visitor_id) 기준이라 UTM 이 빠져도 이어진다. 신청은 로그인으로 연결된 방문자만 집계(추정치 아님).
-- RLS: product_visits 는 기존대로 관리자만 조회, 쓰기는 log_product_visit(SECURITY DEFINER)만. 새 함수도 관리자만.

-- 1) kind 허용 범위
alter table public.product_visits drop constraint if exists product_visits_kind_check;
alter table public.product_visits add constraint product_visits_kind_check check (kind in ('course', 'ebook', 'board_post'));

-- 2) 방문 기록 함수 — board_post 추가
create or replace function public.log_product_visit(p_visitor uuid, p_kind text, p_id integer, p_touch jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_visitor is null or p_kind not in ('course', 'ebook', 'board_post') or p_id is null then return; end if;
  if p_touch is not null and (jsonb_typeof(p_touch) <> 'object' or length(p_touch::text) > 2000) then p_touch := null; end if;
  if p_kind = 'course' and not exists (select 1 from courses where id = p_id) then return; end if;
  if p_kind = 'ebook' and not exists (select 1 from ebooks where id = p_id) then return; end if;
  if p_kind = 'board_post' and not exists (select 1 from board_posts where id = p_id and is_published) then return; end if;
  insert into product_visits (visitor_id, user_id, kind, product_id, source, medium, campaign, content, term, referrer)
  values (p_visitor, auth.uid(), p_kind, p_id,
    left(p_touch->>'source', 200), left(p_touch->>'medium', 200), left(p_touch->>'campaign', 200),
    left(p_touch->>'content', 200), left(p_touch->>'term', 200), left(p_touch->>'referrer', 200))
  on conflict (visitor_id, kind, product_id, day)
  do update set user_id = coalesce(product_visits.user_id, excluded.user_id);
end;
$$;
revoke all on function public.log_product_visit(uuid, text, integer, jsonb) from public;
grant execute on function public.log_product_visit(uuid, text, integer, jsonb) to anon, authenticated;

-- 3) 강의별 게시글 경유 퍼널 (관리자 전용)
create or replace function public.get_course_board_funnel(p_course_id integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  if not is_admin() then raise exception '관리자만 조회할 수 있습니다.'; end if;
  with posts as (
    -- 본문에 이 강의 링크가 있는 글
    select b.id, b.title from board_posts b
     where b.content like '%/course/' || p_course_id || '%'
  ), post_v as (
    select v.product_id as post_id, v.visitor_id, min(v.first_at) as at, max(v.user_id::text)::uuid as user_id
      from product_visits v join posts p on p.id = v.product_id
     where v.kind = 'board_post'
     group by 1, 2
  ), moved as (
    select pv.post_id, pv.visitor_id from post_v pv
     where exists (select 1 from product_visits c
                    where c.kind = 'course' and c.product_id = p_course_id
                      and c.visitor_id = pv.visitor_id and c.day >= (pv.at at time zone 'Asia/Seoul')::date)
  ), linked as (
    -- 방문자 → 회원 (게시글·강의 방문 중 로그인 상태였거나 이후 로그인으로 연결된 경우)
    select distinct pv.post_id, pv.visitor_id, coalesce(pv.user_id, c.user_id) as user_id, pv.at
      from post_v pv
      left join product_visits c on c.visitor_id = pv.visitor_id and c.user_id is not null
  ), enrolled as (
    select l.post_id, count(distinct l.user_id) as n
      from linked l join purchases pu on pu.user_id = l.user_id and pu.course_id = p_course_id and pu.purchased_at >= l.at
     where l.user_id is not null
     group by 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'post_id', p.id, 'title', p.title,
           'visitors', (select count(*) from post_v where post_id = p.id),
           'moved', (select count(*) from moved where post_id = p.id),
           'enrolled', coalesce((select n from enrolled where post_id = p.id), 0)
         ) order by p.id desc), '[]'::jsonb)
    into v
    from posts p;
  return v;
end;
$$;
revoke all on function public.get_course_board_funnel(integer) from public, anon;
grant execute on function public.get_course_board_funnel(integer) to authenticated;
