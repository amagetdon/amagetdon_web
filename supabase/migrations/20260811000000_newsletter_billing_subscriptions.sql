-- 뉴스레터 강사 구독 → 토스페이먼츠 자동결제(빌링) 전환
--   1) 구독 카드결제를 1회성 결제창 대신 빌링키 발급(requestBillingAuth) 방식으로 변경.
--      발급된 빌링키·카드정보·다음결제일을 newsletter_subscriptions 에 보관하고,
--      pg_cron 이 billing-charge 엣지 함수를 주기 호출해 만기 도래 구독을 자동 갱신 결제한다.
--   2) 결제 성공 시마다 기존과 동일하게 purchases(board_instructor_id, expires_at) 행을 쌓는다.
--      → 열람권 판정 RPC(get_board_post_public 등)·매출 통계는 변경 없이 그대로 동작.
--   3) 포인트 결제는 기존 1회권(자동갱신 없음) 흐름 유지.
-- 보안: billing_key 는 클라이언트에 절대 노출 금지 — 컬럼 단위 GRANT 로 차단하고
--   모든 쓰기는 service_role(엣지 함수)만 수행한다.

CREATE TABLE IF NOT EXISTS newsletter_subscriptions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  instructor_id INTEGER NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  customer_key TEXT NOT NULL,            -- 토스 customerKey (= auth user id)
  billing_key TEXT,                      -- 발급된 빌링키 (service_role 전용, 해지 시 NULL)
  card_company TEXT,                     -- 표시용 카드사
  card_number TEXT,                      -- 표시용 마스킹 카드번호
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'failed')),
  price INTEGER NOT NULL,                -- 최근 결제 금액 (갱신 시 강사의 현재 구독료로 재결제)
  period_days INTEGER NOT NULL DEFAULT 30,
  current_expires_at TIMESTAMPTZ,        -- 현재 이용권 만료일 (purchases.expires_at 와 동기)
  next_charge_at TIMESTAMPTZ,            -- 다음 자동결제 예정 시각 (만료 6시간 전)
  fail_count INTEGER NOT NULL DEFAULT 0, -- 연속 결제 실패 횟수 (3회 도달 시 status='failed')
  last_error TEXT,
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, instructor_id)
);

-- billing-charge 스캐너가 매 실행마다 조회하는 조건
CREATE INDEX IF NOT EXISTS newsletter_subs_due_idx
  ON newsletter_subscriptions (next_charge_at)
  WHERE status = 'active' AND next_charge_at IS NOT NULL;

ALTER TABLE newsletter_subscriptions ENABLE ROW LEVEL SECURITY;

-- 본인 구독(마이페이지) + 관리자 조회. 쓰기 정책 없음 — service_role 만 기록.
CREATE POLICY "own or admin read" ON newsletter_subscriptions
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = (SELECT auth.uid()) AND pr.role = 'admin')
  );

-- billing_key 컬럼은 SELECT 권한 자체를 주지 않는다 (클라이언트는 명시 컬럼만 조회)
REVOKE ALL ON newsletter_subscriptions FROM anon, authenticated;
GRANT SELECT (
  id, user_id, instructor_id, card_company, card_number, status,
  price, period_days, current_expires_at, next_charge_at,
  fail_count, canceled_at, created_at, updated_at
) ON newsletter_subscriptions TO authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- pg_cron 등록 (SQL Editor 에서 1회 수동 실행 — 기존 edge function 잡들과 동일 관례)
-- 서비스 롤 키가 필요해 마이그레이션에 넣지 않는다. <SERVICE_ROLE_KEY> 치환 후 실행:
--
-- SELECT cron.schedule(
--   'newsletter-billing-charge',
--   '5 * * * *',  -- 매시 5분
--   $$
--   SELECT net.http_post(
--     url := 'https://uxpihuccunqqtdbxszqa.supabase.co/functions/v1/billing-charge',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
--     ),
--     body := '{}'::jsonb
--   )
--   $$
-- );
-- ─────────────────────────────────────────────────────────────────────

NOTIFY pgrst, 'reload schema';
