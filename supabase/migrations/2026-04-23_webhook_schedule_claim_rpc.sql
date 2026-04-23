-- webhook-schedule-runner edge function이 RLS 우회하여 원자적 claim하기 위한 RPC
-- .update().select() 패턴이 RLS SELECT 정책 때문에 rows를 반환하지 못하는 문제 해결

CREATE OR REPLACE FUNCTION claim_webhook_schedule_runs(p_ids BIGINT[])
RETURNS TABLE (
  id BIGINT,
  webhook_schedule_id INT,
  course_schedule_id INT,
  user_id UUID,
  user_name TEXT,
  user_phone TEXT,
  user_email TEXT,
  course_title TEXT,
  course_scheduled_at TIMESTAMPTZ,
  fire_at TIMESTAMPTZ,
  attempt_count INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  UPDATE webhook_schedule_runs r
  SET status = 'processing'
  WHERE r.id = ANY(p_ids) AND r.status = 'pending' AND r.fired_at IS NULL
  RETURNING
    r.id, r.webhook_schedule_id, r.course_schedule_id, r.user_id,
    r.user_name, r.user_phone, r.user_email,
    r.course_title, r.course_scheduled_at, r.fire_at, r.attempt_count;
END;
$$;

GRANT EXECUTE ON FUNCTION claim_webhook_schedule_runs(BIGINT[]) TO service_role;

-- 'processing' 상태가 누락된 기존 제약조건 보강
ALTER TABLE webhook_schedule_runs DROP CONSTRAINT IF EXISTS webhook_schedule_runs_status_check;
ALTER TABLE webhook_schedule_runs ADD CONSTRAINT webhook_schedule_runs_status_check
  CHECK (status IN ('pending', 'processing', 'success', 'failed', 'skipped', 'cancelled'));
