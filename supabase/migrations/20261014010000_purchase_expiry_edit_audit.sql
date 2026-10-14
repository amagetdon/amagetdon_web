-- 구매 수강 기간 수정 + 구매 삭제·수정 이력 (2026-10-14)
-- 배경: purchases 에 관리자 UPDATE 권한이 없어 수강 기간을 바꾸려면 '삭제 → 수강권 0원 재부여' 밖에 없었고,
--       10/13~14 유료 결제 구매 45건이 그렇게 지워져 결제 금액이 매출·구매 이력에서 사라졌다(삭제 이력도 없음).
-- 1) purchase_audit_logs — 구매 삭제(행 전체 보관)·수강 기간 변경을 누가 언제 했는지 기록. 관리자만 조회.
-- 2) 삭제 트리거 — 어떤 경로(관리자 화면·환불·링크페이 취소)로 지워져도 원본 행을 남긴다.
-- 3) admin_set_purchase_expiry — 관리자가 구매 행은 그대로 두고 expires_at 만 바꾸는 함수.
-- 기존 데이터·기존 정책은 바꾸지 않는다.

CREATE TABLE IF NOT EXISTS purchase_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  action TEXT NOT NULL,                 -- 'delete' | 'expiry_change'
  purchase_id INTEGER,
  actor_id UUID,                        -- auth.uid() (서버 함수·웹훅에서 지우면 NULL)
  before JSONB,
  after JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_purchase_audit_logs_created_at ON purchase_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_audit_logs_purchase_id ON purchase_audit_logs(purchase_id);

ALTER TABLE purchase_audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS purchase_audit_logs_admin_select ON purchase_audit_logs;
CREATE POLICY purchase_audit_logs_admin_select ON purchase_audit_logs FOR SELECT USING (is_admin());
-- INSERT/UPDATE/DELETE 정책 없음 → 아래 SECURITY DEFINER 함수로만 기록, 브라우저에서 고치거나 지울 수 없다.

CREATE OR REPLACE FUNCTION log_purchase_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO purchase_audit_logs (action, purchase_id, actor_id, before)
  VALUES ('delete', OLD.id, auth.uid(), to_jsonb(OLD));
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_purchase_delete_log ON purchases;
CREATE TRIGGER trg_purchase_delete_log
  AFTER DELETE ON purchases
  FOR EACH ROW EXECUTE FUNCTION log_purchase_delete();

CREATE OR REPLACE FUNCTION admin_set_purchase_expiry(p_purchase_id INTEGER, p_expires_at TIMESTAMPTZ)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old TIMESTAMPTZ;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION '관리자만 수강 기간을 수정할 수 있습니다.';
  END IF;
  SELECT expires_at INTO v_old FROM purchases WHERE id = p_purchase_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION '구매 내역을 찾을 수 없습니다.';
  END IF;
  UPDATE purchases SET expires_at = p_expires_at WHERE id = p_purchase_id;
  INSERT INTO purchase_audit_logs (action, purchase_id, actor_id, before, after)
  VALUES ('expiry_change', p_purchase_id, auth.uid(),
          jsonb_build_object('expires_at', v_old), jsonb_build_object('expires_at', p_expires_at));
  RETURN jsonb_build_object('id', p_purchase_id, 'expires_at', p_expires_at);
END;
$$;

REVOKE ALL ON FUNCTION admin_set_purchase_expiry(INTEGER, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_set_purchase_expiry(INTEGER, TIMESTAMPTZ) TO authenticated;
REVOKE ALL ON FUNCTION log_purchase_delete() FROM PUBLIC, anon, authenticated;
