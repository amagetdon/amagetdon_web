-- [되돌리기] 20261015000000_board_post_visits.sql 적용 전 상태로 (게시글 방문 기록만 지움, 강의·전자책 방문 기록은 그대로)
drop function if exists public.get_course_board_funnel(integer);
delete from public.product_visits where kind = 'board_post';
alter table public.product_visits drop constraint if exists product_visits_kind_check;
alter table public.product_visits add constraint product_visits_kind_check check (kind in ('course', 'ebook'));

create or replace function public.log_product_visit(p_visitor uuid, p_kind text, p_id integer, p_touch jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_visitor is null or p_kind not in ('course', 'ebook') or p_id is null then return; end if;
  if p_touch is not null and (jsonb_typeof(p_touch) <> 'object' or length(p_touch::text) > 2000) then p_touch := null; end if;
  if p_kind = 'course' and not exists (select 1 from courses where id = p_id) then return; end if;
  if p_kind = 'ebook' and not exists (select 1 from ebooks where id = p_id) then return; end if;
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
