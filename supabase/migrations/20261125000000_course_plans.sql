-- 강의 플랜 옵션 (2026-11-24 대표님 지시) — 한 강의 안에서 베이직·마스터·프리미엄 같은 가격 옵션을 골라 결제한다.
--  · course_plans: 플랜마다 이름·가격(정가/할인가)·할부 개월·모집 인원 한도·수강 기간. 할인 기간은 강의 설정(discount_start/end)을 같이 쓴다.
--  · purchases.plan_id: 어느 플랜을 샀는지. 플랜이 없는 강의는 null(지금과 같음)
--  · curriculum_items.plan_ids: 이 항목을 볼 수 있는 플랜 목록. null = 모든 플랜(지금과 같음)
--  · 플랜은 새 강의부터 쓴다(기존 3개 페이지 묶음은 합치지 않음 — 대표님 결정). 플랜을 만들지 않은 강의는 동작이 바뀌지 않는다.
--  · 플랜 강의에서 플랜이 지정되지 않은 구매(관리자 수동 부여 등)는 공통 항목(plan_ids null)만 보인다 → 관리자 화면에서 플랜 지정.
-- 순서: 이 SQL 먼저 → 화면(PR) 머지 → confirm-payment·linkpay-webhook 배포.
-- 되돌리기: supabase/diagnostics/20261125_course_plans_rollback.sql

-- 1) 플랜 표
create table if not exists public.course_plans (
  id serial primary key,
  course_id integer not null references public.courses(id) on delete cascade,
  name text not null,
  description text,
  sort_order integer not null default 0,
  original_price integer,
  sale_price integer,
  installment_months integer not null default 0,
  max_enrollments integer,          -- null/0 = 한도 없음
  duration_days integer,            -- null = 강의 수강 기간을 따름
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists course_plans_course_idx on public.course_plans (course_id, sort_order);

alter table public.course_plans enable row level security;
drop policy if exists "public read course_plans" on public.course_plans;
create policy "public read course_plans" on public.course_plans for select using (true);
drop policy if exists "admin all course_plans" on public.course_plans;
create policy "admin all course_plans" on public.course_plans for all
  using ((select is_admin())) with check ((select is_admin()));
grant select on public.course_plans to anon, authenticated;
grant insert, update, delete on public.course_plans to authenticated;
grant usage, select on sequence public.course_plans_id_seq to authenticated;

-- 2) 구매·커리큘럼에 플랜 칸
alter table public.purchases add column if not exists plan_id integer references public.course_plans(id) on delete set null;
create index if not exists purchases_plan_idx on public.purchases (plan_id) where plan_id is not null;
grant select (plan_id) on public.purchases to anon, authenticated;

alter table public.curriculum_items add column if not exists plan_ids integer[];
grant select (plan_ids) on public.curriculum_items to anon, authenticated;

-- 3) 플랜별 판매 인원 (상세 페이지에서 "마감" 표시용 — 인원 수만, 누가 샀는지는 안 내림)
create or replace function public.get_course_plan_counts(p_course_id integer)
returns table (plan_id integer, sold bigint)
language sql
stable
security definer
set search_path = public
as $$
  select pl.id, (select count(*) from purchases p where p.plan_id = pl.id)
    from course_plans pl
   where pl.course_id = p_course_id;
$$;
revoke all on function public.get_course_plan_counts(integer) from public;
grant execute on function public.get_course_plan_counts(integer) to anon, authenticated;

-- 4) 내 구매의 플랜 (내 강의실에서 플랜 전용 항목을 가리기 위해)
create or replace function public.get_my_purchase_plans(p_course_ids bigint[])
returns table (purchase_id bigint, plan_id integer)
language sql
stable
security definer
set search_path = public
as $$
  select p.id::bigint, p.plan_id
    from purchases p
   where p.user_id = auth.uid() and p.course_id = any(p_course_ids);
$$;
revoke all on function public.get_my_purchase_plans(bigint[]) from public, anon;
grant execute on function public.get_my_purchase_plans(bigint[]) to authenticated;

-- 5) 강의 영상 주소: 기수 조건 + 플랜 조건
create or replace function public.get_curriculum_videos(p_course_ids bigint[])
returns table (id bigint, course_id bigint, video_url text, video_urls jsonb)
language sql
stable
security definer
set search_path = public
as $$
  select ci.id::bigint, ci.course_id::bigint, ci.video_url::text, to_jsonb(ci.video_urls)
  from curriculum_items ci
  where ci.course_id = any(p_course_ids)
    and (
      (select is_admin())
      or exists (
        select 1 from purchases p
        where p.user_id = auth.uid()
          and p.course_id = ci.course_id
          and (p.expires_at is null or p.expires_at > now())
          and (ci.cohort_no is null or ci.cohort_no = purchase_cohort_no(ci.course_id, p.purchased_at))
          and (ci.plan_ids is null or p.plan_id = any(ci.plan_ids))
      )
    )
$$;
revoke all on function public.get_curriculum_videos(bigint[]) from public, anon;
grant execute on function public.get_curriculum_videos(bigint[]) to authenticated;

-- 6) 관리자: 구매의 플랜 바꾸기 (수동 부여·링크페이 연결·무통장 처리 뒤 플랜 지정, 업그레이드 처리)
create or replace function public.admin_set_purchase_plan(p_purchase_id integer, p_plan_id integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course integer; v_old integer; v_title text; v_plan_course integer; v_plan_name text; v_course_title text;
begin
  if not coalesce((select is_admin()), false) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select p.course_id, p.plan_id, p.title into v_course, v_old, v_title from purchases p where p.id = p_purchase_id for update;
  if not found then raise exception '구매를 찾을 수 없습니다.'; end if;
  if p_plan_id is not null then
    select pl.course_id, pl.name into v_plan_course, v_plan_name from course_plans pl where pl.id = p_plan_id;
    if not found or v_plan_course is distinct from v_course then raise exception '이 강의의 플랜이 아닙니다.'; end if;
  end if;
  select c.title into v_course_title from courses c where c.id = v_course;
  update purchases
     set plan_id = p_plan_id,
         title = case when p_plan_id is null then coalesce(v_course_title, title)
                      else coalesce(v_course_title, title) || ' (' || v_plan_name || ')' end
   where id = p_purchase_id;
  insert into purchase_audit_logs (action, purchase_id, actor_id, before, after)
  values ('set_plan', p_purchase_id, auth.uid(), jsonb_build_object('plan_id', v_old, 'title', v_title),
          jsonb_build_object('plan_id', p_plan_id));
  return jsonb_build_object('purchase_id', p_purchase_id, 'plan_id', p_plan_id);
end;
$$;
revoke all on function public.admin_set_purchase_plan(integer, integer) from public, anon;
grant execute on function public.admin_set_purchase_plan(integer, integer) to authenticated;

-- 7) 포인트 결제: 플랜 강의는 플랜 가격·인원·기간으로. (3개 인자 버전을 지우고 p_plan_id 를 더한 버전으로 바꾼다 — 기존 호출은 그대로 동작)
drop function if exists public.purchase_with_points(text, integer, integer);
create or replace function public.purchase_with_points(p_kind text, p_id integer, p_coupon_id integer default null, p_plan_id integer default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
DECLARE
  v_uid UUID := auth.uid();
  v_title TEXT;
  v_price INTEGER := 0;
  v_discount INTEGER := 0;
  v_final INTEGER;
  v_reward INTEGER := 0;
  v_expires TIMESTAMPTZ;
  v_points INTEGER;
  v_balance INTEGER;
  v_disc_active BOOLEAN;
  v_days INTEGER;
  v_plan_id INTEGER;
  c RECORD; e RECORD; b RECORD; cp RECORD; cl RECORD; pl RECORD;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION '로그인이 필요합니다.'; END IF;

  -- 1) 상품 검증 + 가격 산정
  IF p_kind = 'course' THEN
    SELECT * INTO c FROM courses WHERE id = p_id;
    IF NOT FOUND THEN RAISE EXCEPTION '강의를 찾을 수 없습니다.'; END IF;
    IF EXISTS (SELECT 1 FROM purchases WHERE user_id = v_uid AND course_id = p_id) THEN RAISE EXCEPTION '이미 구매한 상품입니다.'; END IF;
    IF c.is_on_sale IS FALSE THEN RAISE EXCEPTION '판매 준비 중인 강의입니다.'; END IF;
    IF c.course_type <> 'pre_alert' AND c.enrollment_start IS NOT NULL AND c.enrollment_start > now() THEN RAISE EXCEPTION '아직 오픈되지 않은 강의입니다.'; END IF;
    IF c.enrollment_deadline IS NOT NULL AND c.enrollment_deadline <= now() THEN RAISE EXCEPTION '모집이 마감된 강의입니다.'; END IF;
    IF COALESCE(c.max_enrollments, 0) > 0 AND (SELECT count(*) FROM purchases WHERE course_id = p_id) >= c.max_enrollments THEN RAISE EXCEPTION '정원이 마감된 강의입니다.'; END IF;
    v_disc_active := c.course_type <> 'free' AND (
      (c.discount_start IS NULL AND c.discount_end IS NULL) OR
      ((c.discount_start IS NULL OR c.discount_start <= now()) AND (c.discount_end IS NULL OR c.discount_end > now())));

    -- 플랜: 판매 중인 플랜이 있는 강의는 플랜을 반드시 골라야 한다
    IF EXISTS (SELECT 1 FROM course_plans WHERE course_id = p_id AND is_active) THEN
      IF p_plan_id IS NULL THEN RAISE EXCEPTION '플랜을 선택하세요.'; END IF;
      SELECT * INTO pl FROM course_plans WHERE id = p_plan_id AND course_id = p_id AND is_active FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION '선택할 수 없는 플랜입니다.'; END IF;
      IF COALESCE(pl.max_enrollments, 0) > 0 AND (SELECT count(*) FROM purchases WHERE plan_id = pl.id) >= pl.max_enrollments THEN
        RAISE EXCEPTION '이 플랜은 정원이 마감되었습니다.';
      END IF;
      v_price := CASE
        WHEN pl.sale_price = 0 THEN 0
        WHEN v_disc_active AND COALESCE(pl.sale_price, 0) > 0 THEN pl.sale_price
        ELSE COALESCE(pl.original_price, pl.sale_price, 0) END;
      v_title := c.title || ' (' || pl.name || ')';
      v_days := COALESCE(pl.duration_days, c.duration_days);
      v_plan_id := pl.id;
    ELSE
      IF p_plan_id IS NOT NULL THEN RAISE EXCEPTION '선택할 수 없는 플랜입니다.'; END IF;
      v_price := CASE
        WHEN c.course_type = 'free' OR c.sale_price = 0 THEN 0
        WHEN v_disc_active AND COALESCE(c.sale_price, 0) > 0 THEN c.sale_price
        ELSE COALESCE(c.original_price, 0) END;
      v_title := c.title;
      v_days := c.duration_days;
    END IF;
    v_reward := COALESCE(c.reward_points, 0);
    v_expires := CASE WHEN COALESCE(v_days, 0) <= 0 THEN NULL
                      WHEN c.enrollment_deadline IS NOT NULL THEN c.enrollment_deadline + make_interval(days => v_days)
                      ELSE now() + make_interval(days => v_days) END;

  ELSIF p_kind = 'ebook' THEN
    IF p_plan_id IS NOT NULL THEN RAISE EXCEPTION '선택할 수 없는 플랜입니다.'; END IF;
    SELECT * INTO e FROM ebooks WHERE id = p_id;
    IF NOT FOUND THEN RAISE EXCEPTION '전자책을 찾을 수 없습니다.'; END IF;
    IF EXISTS (SELECT 1 FROM purchases WHERE user_id = v_uid AND ebook_id = p_id) THEN RAISE EXCEPTION '이미 구매한 상품입니다.'; END IF;
    IF e.is_on_sale IS FALSE THEN RAISE EXCEPTION '판매 준비 중인 전자책입니다.'; END IF;
    IF e.close_date IS NOT NULL AND e.close_date <= now() THEN RAISE EXCEPTION '판매가 마감된 전자책입니다.'; END IF;
    v_disc_active := e.is_free IS NOT TRUE AND (
      (e.discount_start IS NULL AND e.discount_end IS NULL) OR
      ((e.discount_start IS NULL OR e.discount_start <= now()) AND (e.discount_end IS NULL OR e.discount_end > now())));
    v_price := CASE
      WHEN e.is_free IS TRUE THEN 0
      WHEN v_disc_active AND e.sale_price IS NOT NULL THEN e.sale_price
      ELSE COALESCE(e.original_price, e.sale_price, 0) END;
    v_title := e.title;
    v_reward := COALESCE(e.reward_points, 0);
    v_expires := CASE WHEN COALESCE(e.duration_days, 0) > 0 THEN now() + make_interval(days => e.duration_days) END;

  ELSIF p_kind = 'board_post' THEN
    IF p_plan_id IS NOT NULL THEN RAISE EXCEPTION '선택할 수 없는 플랜입니다.'; END IF;
    IF p_coupon_id IS NOT NULL THEN RAISE EXCEPTION '뉴스레터 글에는 쿠폰을 사용할 수 없습니다.'; END IF;
    SELECT * INTO b FROM board_posts WHERE id = p_id;
    IF NOT FOUND THEN RAISE EXCEPTION '글을 찾을 수 없습니다.'; END IF;
    IF b.is_paid IS NOT TRUE OR COALESCE(b.price, 0) <= 0 THEN RAISE EXCEPTION '단건 구매할 수 없는 글입니다.'; END IF;
    IF EXISTS (SELECT 1 FROM purchases WHERE user_id = v_uid AND board_post_id = p_id) THEN RAISE EXCEPTION '이미 구매한 글입니다.'; END IF;
    v_price := b.price;
    v_title := b.title;
    v_expires := NULL; -- 단건 구매는 영구 열람

  ELSE
    RAISE EXCEPTION '잘못된 상품입니다.';
  END IF;

  -- 2) 쿠폰 검증 + 할인 (CouponSelector / 상세 페이지 규칙)
  IF p_coupon_id IS NOT NULL THEN
    SELECT * INTO cl FROM coupon_claims WHERE coupon_id = p_coupon_id AND user_id = v_uid AND used_at IS NULL LIMIT 1 FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION '사용할 수 없는 쿠폰입니다.'; END IF;
    SELECT * INTO cp FROM coupons WHERE id = p_coupon_id;
    IF NOT FOUND OR cp.is_published IS NOT TRUE THEN RAISE EXCEPTION '사용할 수 없는 쿠폰입니다.'; END IF;
    IF cp.expires_at IS NOT NULL AND cp.expires_at < now() THEN RAISE EXCEPTION '만료된 쿠폰입니다.'; END IF;
    IF COALESCE(cp.use_days, 0) > 0 AND cl.claimed_at IS NOT NULL AND cl.claimed_at + make_interval(days => cp.use_days) < now() THEN
      RAISE EXCEPTION '만료된 쿠폰입니다.';
    END IF;
    IF NOT (cp.applies_to = 'all'
         OR (cp.applies_to = 'course' AND p_kind = 'course' AND (cp.course_id IS NULL OR cp.course_id = p_id))
         OR (cp.applies_to = 'ebook' AND p_kind = 'ebook' AND (cp.ebook_id IS NULL OR cp.ebook_id = p_id))) THEN
      RAISE EXCEPTION '이 상품에 사용할 수 없는 쿠폰입니다.';
    END IF;
    IF v_price < COALESCE(cp.min_purchase, 0) THEN RAISE EXCEPTION '쿠폰 최소 구매 금액을 충족하지 않습니다.'; END IF;
    v_discount := CASE WHEN cp.discount_type = 'percent'
      THEN LEAST(floor(v_price * cp.discount_value / 100.0)::INTEGER, COALESCE(NULLIF(cp.max_discount, 0), v_price), v_price)
      ELSE LEAST(cp.discount_value, v_price) END;
    UPDATE coupon_claims SET used_at = now() WHERE id = cl.id;
  END IF;
  v_final := GREATEST(0, v_price - v_discount);

  -- 3) 포인트 차감 (행 잠금으로 동시 구매 방지)
  SELECT COALESCE(points, 0) INTO v_points FROM profiles WHERE id = v_uid FOR UPDATE;
  IF v_points < v_final THEN RAISE EXCEPTION '포인트가 부족합니다.'; END IF;
  v_balance := v_points - v_final;
  UPDATE profiles SET points = v_balance WHERE id = v_uid;

  -- 4) 구매 행
  INSERT INTO purchases (user_id, course_id, ebook_id, board_post_id, coupon_id, title, original_price, price, expires_at, plan_id)
  VALUES (v_uid,
          CASE WHEN p_kind = 'course' THEN p_id END,
          CASE WHEN p_kind = 'ebook' THEN p_id END,
          CASE WHEN p_kind = 'board_post' THEN p_id END,
          p_coupon_id, v_title, v_price, v_final, v_expires, v_plan_id);

  INSERT INTO point_logs (user_id, amount, balance, type, memo)
  VALUES (v_uid, -v_final, v_balance, 'use', v_title || ' 구매');

  -- 5) 수강 적립 (강의·전자책)
  IF v_reward > 0 THEN
    UPDATE profiles SET points = points + v_reward WHERE id = v_uid RETURNING points INTO v_balance;
    INSERT INTO point_logs (user_id, amount, balance, type, memo)
    VALUES (v_uid, v_reward, v_balance, 'charge', v_title || ' 수강 적립');
  END IF;

  RETURN jsonb_build_object('title', v_title, 'price', v_price, 'discount', v_discount, 'final_price', v_final,
                            'expires_at', v_expires, 'reward', v_reward, 'balance', v_balance, 'plan_id', v_plan_id);
END;
$$;
revoke all on function public.purchase_with_points(text, integer, integer, integer) from public, anon;
grant execute on function public.purchase_with_points(text, integer, integer, integer) to authenticated;

-- 8) 링크페이 상품을 플랜에 연결
alter table public.linkpay_links add column if not exists plan_id integer references public.course_plans(id) on delete set null;

notify pgrst, 'reload schema';
