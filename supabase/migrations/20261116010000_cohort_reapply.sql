-- 기수제 재신청 (2026-11-16) — 20261116000000_product_cohorts.sql 다음에 적용
-- 지난 기수에 신청한 회원이 다음 기수에 다시 신청하면 새 신청으로 기록되어 그 기수 대시보드에 잡힌다.
--  · enroll_free: 무료·사전알림 강의에 진행 중인 기수가 있으면, 그 기수 시작 뒤의 신청만 '이미 신청'으로 막는다.
--    재신청은 purchases 에 새 줄로 남는다(지난 줄은 그대로). 수강 적립은 재신청 때 다시 주지 않는다.
--  · has_current_enrollment: 강의 상세 화면의 '이미 신청' 판단용 (같은 기준). 유료 강의·기수 없는 강의는 지금과 같다.
-- 기수를 만들지 않은 강의는 동작이 바뀌지 않는다.
-- 되돌리기: supabase/diagnostics/20261116_cohort_reapply_rollback.sql

create or replace function public.has_current_enrollment(p_course_id integer)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from purchases p
     where p.user_id = auth.uid() and p.course_id = p_course_id
       and p.purchased_at >= coalesce((
         select k.starts_at
           from product_cohorts k join courses c on c.id = k.product_id
          where k.kind = 'course' and k.product_id = p_course_id and k.ends_at is null
            and c.course_type in ('free', 'pre_alert')
          order by k.no desc limit 1), '-infinity'::timestamptz));
$$;
revoke all on function public.has_current_enrollment(integer) from public, anon;
grant execute on function public.has_current_enrollment(integer) to authenticated;

CREATE OR REPLACE FUNCTION public.enroll_free(p_kind text, p_id integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid UUID := auth.uid();
  v_admin BOOLEAN := is_admin();
  v_title TEXT;
  v_reward INTEGER := 0;
  v_expires TIMESTAMPTZ;
  v_balance INTEGER;
  c RECORD;
  e RECORD;
  v_cstart TIMESTAMPTZ;      -- 진행 중인 기수의 시작 시각 (기수제 무료 강의만)
  v_again BOOLEAN := false;  -- 지난 기수에 신청했던 사람의 재신청
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  IF p_kind = 'course' THEN
    SELECT * INTO c FROM courses WHERE id = p_id;
    IF NOT FOUND THEN RAISE EXCEPTION '강의를 찾을 수 없습니다.'; END IF;
    -- 기수제: 진행 중인 기수가 시작된 뒤의 신청만 '이미 신청'으로 본다. 지난 기수 신청자는 이번 기수에 다시 신청할 수 있다.
    IF c.course_type IN ('free', 'pre_alert') THEN
      SELECT k.starts_at INTO v_cstart FROM product_cohorts k
       WHERE k.kind = 'course' AND k.product_id = p_id AND k.ends_at IS NULL
       ORDER BY k.no DESC LIMIT 1;
    END IF;
    IF EXISTS (SELECT 1 FROM purchases WHERE user_id = v_uid AND course_id = p_id
                 AND (v_cstart IS NULL OR purchased_at >= v_cstart)) THEN
      RAISE EXCEPTION '이미 등록한 상품입니다.';
    END IF;
    v_again := EXISTS (SELECT 1 FROM purchases WHERE user_id = v_uid AND course_id = p_id);
    IF NOT v_admin THEN
      IF c.course_type NOT IN ('free', 'pre_alert') THEN RAISE EXCEPTION '무료 강의가 아닙니다.'; END IF;
      IF c.is_on_sale IS FALSE THEN RAISE EXCEPTION '판매 준비 중인 강의입니다.'; END IF;
      IF c.course_type <> 'pre_alert' AND c.enrollment_start IS NOT NULL AND c.enrollment_start > now() THEN
        RAISE EXCEPTION '아직 오픈되지 않은 강의입니다.';
      END IF;
      IF c.enrollment_deadline IS NOT NULL AND c.enrollment_deadline <= now() THEN
        RAISE EXCEPTION '모집이 마감된 강의입니다.';
      END IF;
      IF COALESCE(c.max_enrollments, 0) > 0
         AND (SELECT count(*) FROM purchases WHERE course_id = p_id) >= c.max_enrollments THEN
        RAISE EXCEPTION '정원이 마감된 강의입니다.';
      END IF;
    END IF;
    v_title := c.title;
    v_reward := COALESCE(c.reward_points, 0);
    -- 수강 기간: 모집 마감일이 있으면 마감일부터, 없으면 신청 시점부터 duration_days (0 이면 무제한)
    v_expires := CASE WHEN COALESCE(c.duration_days, 0) <= 0 THEN NULL
                      WHEN c.enrollment_deadline IS NOT NULL THEN c.enrollment_deadline + make_interval(days => c.duration_days)
                      ELSE now() + make_interval(days => c.duration_days) END;
    INSERT INTO purchases (user_id, course_id, title, price, expires_at)
    VALUES (v_uid, p_id, v_title, 0, v_expires);

  ELSIF p_kind = 'ebook' THEN
    SELECT * INTO e FROM ebooks WHERE id = p_id;
    IF NOT FOUND THEN RAISE EXCEPTION '전자책을 찾을 수 없습니다.'; END IF;
    IF EXISTS (SELECT 1 FROM purchases WHERE user_id = v_uid AND ebook_id = p_id) THEN
      RAISE EXCEPTION '이미 등록한 상품입니다.';
    END IF;
    IF NOT v_admin THEN
      IF e.is_free IS NOT TRUE THEN RAISE EXCEPTION '무료 전자책이 아닙니다.'; END IF;
      IF e.is_on_sale IS FALSE THEN RAISE EXCEPTION '판매 준비 중인 전자책입니다.'; END IF;
      IF e.close_date IS NOT NULL AND e.close_date <= now() THEN RAISE EXCEPTION '판매가 마감된 전자책입니다.'; END IF;
    END IF;
    v_title := e.title;
    v_reward := COALESCE(e.reward_points, 0);
    -- 화면 규칙: 지금부터 duration_days, 없으면 무제한
    v_expires := CASE WHEN COALESCE(e.duration_days, 0) > 0 THEN now() + make_interval(days => e.duration_days) END;
    INSERT INTO purchases (user_id, ebook_id, title, price, expires_at)
    VALUES (v_uid, p_id, v_title, 0, v_expires);

  ELSE
    RAISE EXCEPTION '잘못된 상품입니다.';
  END IF;

  -- 수강 적립 (기존 grantPurchaseRewardPoints 와 동일한 기록 형식)
  IF v_reward > 0 AND NOT v_again THEN
    UPDATE profiles SET points = COALESCE(points, 0) + v_reward WHERE id = v_uid RETURNING points INTO v_balance;
    INSERT INTO point_logs (user_id, amount, balance, type, memo)
    VALUES (v_uid, v_reward, v_balance, 'charge', v_title || ' 수강 적립');
  END IF;

  RETURN jsonb_build_object('title', v_title, 'expires_at', v_expires, 'reward', v_reward);
END;
$function$;
