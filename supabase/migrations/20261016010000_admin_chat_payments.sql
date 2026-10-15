-- 챗봇 '실제 입금' 집계 (2026-10-16)
-- 링크페이 결제(linkpay_payments) + 무통장·현금 등록(manual_payments)을 '들어온 돈' 기준으로 합산한다.
-- 회원에게 붙였는지(처리 여부)와 상관없이 센다 → 사이트 매출(구매 기록 금액)과 구분해서 쓰는 용도.
--  · 관리자만(is_admin) · 금액·건수만 반환 — 입금자명·전화·회원 정보는 돌려주지 않는다.
--  · 묶음: day, month, product, source(linkpay/bank/cash), processed(회원에게 붙임 여부), status(DONE/CANCELED)
--  · 기본은 완료 결제만 합산하고, 취소(CANCELED) 금액은 따로 알려 준다.
-- 되돌리기: supabase/diagnostics/20261016_admin_chat_payments_rollback.sql

create or replace function public.admin_chat_payments(
  p_from date, p_to date, p_kind text default null, p_id integer default null, p_group text[] default '{}'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare g text[];
begin
  if not coalesce((select is_admin()), false) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 400 then raise exception 'bad range' using errcode = '22023'; end if;
  g := chat_check_group(p_group, array['day','month','product','source','processed','status']);

  return (
    with base as (
      select (coalesce(l.approved_at, l.created_at) at time zone 'Asia/Seoul')::date as d,
             case when l.course_id is not null then 'course:' || l.course_id
                  when l.ebook_id is not null then 'ebook:' || l.ebook_id else '미연결' end as product,
             'linkpay'::text as source,
             (l.granted and l.purchase_id is not null) as processed,
             coalesce(l.status, '미상') as status,
             coalesce(l.amount, 0)::numeric as amount,
             l.course_id, l.ebook_id
        from linkpay_payments l
      union all
      select (m.paid_at at time zone 'Asia/Seoul')::date,
             case when m.course_id is not null then 'course:' || m.course_id
                  when m.ebook_id is not null then 'ebook:' || m.ebook_id else '미연결' end,
             coalesce(m.method, 'bank'),
             (m.purchase_id is not null),
             'DONE',
             m.amount::numeric,
             m.course_id, m.ebook_id
        from manual_payments m
    ),
    f as (
      select * from base
       where d between p_from and p_to
         and (p_kind is null
              or (p_kind = 'course' and course_id = p_id)
              or (p_kind = 'ebook' and ebook_id = p_id))
    ),
    grouped as (
      select
        case when 'day' = any(g) then d::text end as day,
        case when 'month' = any(g) then to_char(d, 'YYYY-MM') end as month,
        case when 'product' = any(g) then product end as product,
        case when 'source' = any(g) then source end as source,
        case when 'processed' = any(g) then processed::text end as processed,
        case when 'status' = any(g) then status end as status,
        count(*) filter (where status = 'DONE') as payments,
        coalesce(sum(amount) filter (where status = 'DONE'), 0) as received_won,
        count(*) filter (where status = 'CANCELED') as canceled,
        coalesce(sum(amount) filter (where status = 'CANCELED'), 0) as canceled_won
      from f
      group by 1, 2, 3, 4, 5, 6
    )
    select jsonb_build_object(
      'from', p_from, 'to', p_to, 'kind', p_kind, 'id', p_id, 'group', to_jsonb(g),
      'linkpay_since', (select min((coalesce(approved_at, created_at) at time zone 'Asia/Seoul')::date) from linkpay_payments),
      'manual_since', (select min((paid_at at time zone 'Asia/Seoul')::date) from manual_payments),
      'totals', (select jsonb_build_object(
          'payments', count(*) filter (where status = 'DONE'),
          'received_won', coalesce(sum(amount) filter (where status = 'DONE'), 0),
          'processed_won', coalesce(sum(amount) filter (where status = 'DONE' and processed), 0),
          'unprocessed_payments', count(*) filter (where status = 'DONE' and not processed),
          'unprocessed_won', coalesce(sum(amount) filter (where status = 'DONE' and not processed), 0),
          'canceled', count(*) filter (where status = 'CANCELED'),
          'canceled_won', coalesce(sum(amount) filter (where status = 'CANCELED'), 0)) from f),
      'rows', (select coalesce(jsonb_agg(jsonb_strip_nulls(to_jsonb(x))), '[]') from (
                 select * from grouped order by received_won desc limit 200) x)
    )
  );
end;
$$;

revoke all on function public.admin_chat_payments(date, date, text, integer, text[]) from public, anon;
grant execute on function public.admin_chat_payments(date, date, text, integer, text[]) to authenticated;
