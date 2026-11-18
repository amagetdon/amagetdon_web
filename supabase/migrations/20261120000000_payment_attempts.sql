-- 결제창 기록: 결제창을 연 것(open), 실패(fail), 취소(cancel)를 한 줄씩 남긴다.
-- 결제 완료는 지금처럼 purchases 에만 남는다. 이 표는 "결제창까지 갔다가 끝내지 못한 사람"을 세기 위한 것.
-- 개인정보 없음(회원 번호·상품·주문 번호·금액·오류 코드·유입 랜딩 이름). 관리자만 조회.
-- 되돌리기: supabase/diagnostics/20261120_payment_attempts_rollback.sql

create table if not exists public.payment_attempts (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  user_id uuid references auth.users(id) on delete set null,
  stage text not null check (stage in ('open', 'fail', 'cancel')),
  kind text not null check (kind in ('course', 'ebook')),
  product_id integer not null,
  order_id text,
  amount integer,
  code text,
  landing text
);
create index if not exists payment_attempts_product_idx on public.payment_attempts (kind, product_id, created_at);
create index if not exists payment_attempts_order_idx on public.payment_attempts (order_id);

alter table public.payment_attempts enable row level security;
drop policy if exists "admin read payment_attempts" on public.payment_attempts;
create policy "admin read payment_attempts" on public.payment_attempts for select using ((select is_admin()));
-- insert·update·delete 정책 없음 → 아래 함수로만 기록된다

create or replace function public.log_payment_attempt(
  p_stage text, p_kind text, p_id integer, p_order_id text, p_amount integer, p_code text, p_landing text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_stage not in ('open', 'fail', 'cancel') or p_kind not in ('course', 'ebook') or p_id is null then return; end if;
  if p_kind = 'course' and not exists (select 1 from courses where id = p_id) then return; end if;
  if p_kind = 'ebook' and not exists (select 1 from ebooks where id = p_id) then return; end if;
  -- 같은 주문의 같은 단계는 한 번만(새로고침·중복 호출 대비)
  if p_order_id is not null and exists (select 1 from payment_attempts where order_id = left(p_order_id, 100) and stage = p_stage) then return; end if;
  insert into payment_attempts (user_id, stage, kind, product_id, order_id, amount, code, landing)
  values (auth.uid(), p_stage, p_kind, p_id, left(p_order_id, 100),
    case when p_amount between 0 and 100000000 then p_amount end, left(p_code, 60), left(p_landing, 60));
end;
$$;
revoke all on function public.log_payment_attempt(text, text, integer, text, integer, text, text) from public;
grant execute on function public.log_payment_attempt(text, text, integer, text, integer, text, text) to anon, authenticated;
