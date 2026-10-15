-- 무통장 입금함 (2026-10-16) — 링크페이 처리함처럼 은행 입금 내역을 받아 두고, 관리자가 회원·강의를 지정해 등록한다.
--  · bank_deposits: 입금 한 건 = 한 줄. 상태 pending(미처리) / processed(등록됨) / excluded(제외, 매출 아님)
--    가져오는 길: ①매일 12시 예약 작업 → /api/bank-deposits-import(전용 비밀키, 새 줄 추가만) ②관리자 엑셀 업로드 ③첫 적재 SQL
--    중복 방지: external_id(클로브 거래 ID, 없으면 입금일+금액+입금자+잔액 조합) 고유
--  · depositor_aliases: 법인·상호명 입금자 → 회원 기억(다음부터 추천 1순위)
--  · 등록은 기존 admin_record_manual_payment(무통장 입금 등록·분할 누적 규칙)를 그대로 부른다.
--  · 입금자명은 개인정보 → 관리자만 조회.
-- 되돌리기: supabase/diagnostics/20261016_bank_deposit_inbox_rollback.sql

CREATE TABLE IF NOT EXISTS bank_deposits (
  id BIGSERIAL PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'clobe' CHECK (source IN ('clobe', 'excel', 'seed', 'manual')),
  external_id TEXT NOT NULL UNIQUE,
  deposited_at TIMESTAMPTZ NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  depositor TEXT,
  memo TEXT,
  balance BIGINT,
  hint JSONB,                                  -- 첫 적재 매칭표 후보 등 참고 정보 {"label":"확실","course_id":129,"user_label":"…"}
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'excluded')),
  exclude_reason TEXT,
  manual_payment_id BIGINT REFERENCES manual_payments(id) ON DELETE SET NULL,
  processed_by UUID,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bank_deposits_status_date ON bank_deposits (status, deposited_at DESC);
ALTER TABLE bank_deposits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bank_deposits_admin_select ON bank_deposits;
CREATE POLICY bank_deposits_admin_select ON bank_deposits FOR SELECT USING (is_admin());
DROP POLICY IF EXISTS bank_deposits_admin_insert ON bank_deposits;
CREATE POLICY bank_deposits_admin_insert ON bank_deposits FOR INSERT WITH CHECK (is_admin());
-- 수정·삭제는 아래 처리 함수로만 (직접 수정 정책 없음)

CREATE TABLE IF NOT EXISTS depositor_aliases (
  name TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_by UUID DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE depositor_aliases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS depositor_aliases_admin_all ON depositor_aliases;
CREATE POLICY depositor_aliases_admin_all ON depositor_aliases FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- 등록: 입금 한 건을 회원·강의(또는 전자책)에 연결 → 기존 무통장 등록 규칙으로 구매에 금액 반영 + 입금함 '등록됨'
CREATE OR REPLACE FUNCTION admin_process_bank_deposit(
  p_deposit_id BIGINT,
  p_user_id UUID,
  p_course_id INTEGER,
  p_ebook_id INTEGER,
  p_expires_at TIMESTAMPTZ,
  p_remember BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d bank_deposits%ROWTYPE;
  r JSONB;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION '관리자만 처리할 수 있습니다.'; END IF;
  SELECT * INTO d FROM bank_deposits WHERE id = p_deposit_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION '입금 내역을 찾을 수 없습니다.'; END IF;
  IF d.status <> 'pending' THEN RAISE EXCEPTION '이미 처리된 입금입니다.'; END IF;

  r := admin_record_manual_payment(p_user_id, p_course_id, p_ebook_id, d.amount, d.deposited_at, 'bank',
                                   d.depositor, '무통장 입금함 #' || d.id, NULL, p_expires_at);

  UPDATE bank_deposits
     SET status = 'processed', manual_payment_id = (r->>'manual_payment_id')::BIGINT,
         processed_by = auth.uid(), processed_at = now()
   WHERE id = d.id;

  IF p_remember AND NULLIF(btrim(d.depositor), '') IS NOT NULL THEN
    INSERT INTO depositor_aliases (name, user_id) VALUES (btrim(d.depositor), p_user_id)
    ON CONFLICT (name) DO UPDATE SET user_id = EXCLUDED.user_id, created_at = now(), created_by = auth.uid();
  END IF;

  RETURN r || jsonb_build_object('deposit_id', d.id);
END;
$$;

-- 제외(매출 아님): 이자·환불 입금·개인·회사 간 이체·카드 캐시백·기타
CREATE OR REPLACE FUNCTION admin_exclude_bank_deposit(p_deposit_id BIGINT, p_reason TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION '관리자만 처리할 수 있습니다.'; END IF;
  IF NULLIF(btrim(p_reason), '') IS NULL THEN RAISE EXCEPTION '제외 사유를 고르세요.'; END IF;
  UPDATE bank_deposits SET status = 'excluded', exclude_reason = btrim(p_reason), processed_by = auth.uid(), processed_at = now()
   WHERE id = p_deposit_id AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION '미처리 입금만 제외할 수 있습니다.'; END IF;
END;
$$;

-- 제외 취소(다시 미처리로) — 등록된 건은 되돌리지 않음(구매 금액이 이미 바뀌었으므로)
CREATE OR REPLACE FUNCTION admin_reopen_bank_deposit(p_deposit_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION '관리자만 처리할 수 있습니다.'; END IF;
  UPDATE bank_deposits SET status = 'pending', exclude_reason = NULL, processed_by = NULL, processed_at = NULL
   WHERE id = p_deposit_id AND status = 'excluded';
  IF NOT FOUND THEN RAISE EXCEPTION '제외된 입금만 되돌릴 수 있습니다.'; END IF;
END;
$$;

-- 추천 후보: 입금일 ±3일 안에 0원 수강권을 받은 회원 중 이름 전체·끝 두 글자 일치, 그 강의 판매가 = 입금액, 기억한 입금자명
CREATE OR REPLACE FUNCTION admin_bank_deposit_candidates(p_deposit_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d bank_deposits%ROWTYPE;
  v_name TEXT;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  SELECT * INTO d FROM bank_deposits WHERE id = p_deposit_id;
  IF NOT FOUND THEN RETURN '[]'::jsonb; END IF;
  v_name := regexp_replace(coalesce(d.depositor, ''), '\s', '', 'g');

  RETURN (
    WITH alias AS (
      SELECT a.user_id FROM depositor_aliases a WHERE a.name = btrim(coalesce(d.depositor, ''))
    ),
    cand AS (
      SELECT p.id AS purchase_id, p.user_id, p.course_id, p.ebook_id, p.price, p.purchased_at,
             pr.name, pr.phone, pr.email,
             coalesce(c.title, e.title, p.title) AS item_title,
             coalesce(c.sale_price, c.original_price, e.sale_price, e.original_price) AS list_price,
             (EXISTS (SELECT 1 FROM alias WHERE alias.user_id = p.user_id)) AS alias_hit,
             (v_name <> '' AND regexp_replace(coalesce(pr.name, ''), '\s', '', 'g') = v_name) AS name_full,
             (char_length(v_name) >= 2 AND right(regexp_replace(coalesce(pr.name, ''), '\s', '', 'g'), 2) = right(v_name, 2)) AS name_tail
        FROM purchases p
        LEFT JOIN profiles pr ON pr.id = p.user_id
        LEFT JOIN courses c ON c.id = p.course_id
        LEFT JOIN ebooks e ON e.id = p.ebook_id
       WHERE (p.purchased_at BETWEEN d.deposited_at - interval '3 days' AND d.deposited_at + interval '3 days'
              OR EXISTS (SELECT 1 FROM alias WHERE alias.user_id = p.user_id))
         AND coalesce(p.price, 0) = 0
         AND (p.course_id IS NOT NULL OR p.ebook_id IS NOT NULL)
    ),
    scored AS (
      SELECT cand.*,
             (CASE WHEN alias_hit THEN 100 ELSE 0 END
              + CASE WHEN name_full THEN 50 WHEN name_tail THEN 20 ELSE 0 END
              + CASE WHEN list_price = d.amount THEN 30 ELSE 0 END) AS score
        FROM cand
    )
    SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.score DESC, x.purchased_at DESC), '[]')
      FROM (SELECT purchase_id, user_id, course_id, ebook_id, item_title, list_price, purchased_at, name, phone, email,
                   alias_hit, name_full, name_tail, (list_price = d.amount) AS price_match, score
              FROM scored WHERE score > 0 ORDER BY score DESC, purchased_at DESC LIMIT 15) x
  );
END;
$$;

REVOKE ALL ON FUNCTION admin_process_bank_deposit(BIGINT, UUID, INTEGER, INTEGER, TIMESTAMPTZ, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION admin_exclude_bank_deposit(BIGINT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION admin_reopen_bank_deposit(BIGINT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION admin_bank_deposit_candidates(BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_process_bank_deposit(BIGINT, UUID, INTEGER, INTEGER, TIMESTAMPTZ, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_exclude_bank_deposit(BIGINT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_reopen_bank_deposit(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_bank_deposit_candidates(BIGINT) TO authenticated;

SELECT
  (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('bank_deposits', 'depositor_aliases')) AS tables,
  (SELECT count(*) FROM pg_proc WHERE proname IN ('admin_process_bank_deposit', 'admin_exclude_bank_deposit', 'admin_reopen_bank_deposit', 'admin_bank_deposit_candidates')) AS functions;
-- 기대 결과: tables 2, functions 4
