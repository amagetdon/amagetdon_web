-- pg_cron job의 발송 시각을 어드민이 변경할 수 있도록 RPC 함수 제공
-- KST 기준으로 hour/minute 받아 UTC로 변환 후 cron.alter_job 호출

CREATE OR REPLACE FUNCTION update_cron_schedule(p_job_name TEXT, p_hour_kst INT, p_minute INT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_utc_hour INT;
  v_cron_expr TEXT;
  v_job_id BIGINT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  IF p_hour_kst < 0 OR p_hour_kst > 23 OR p_minute < 0 OR p_minute > 59 THEN
    RAISE EXCEPTION 'Invalid time: hour 0-23, minute 0-59';
  END IF;

  -- KST → UTC (KST = UTC+9)
  v_utc_hour := (p_hour_kst - 9 + 24) % 24;
  v_cron_expr := p_minute || ' ' || v_utc_hour || ' * * *';

  SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = p_job_name;
  IF v_job_id IS NULL THEN
    RAISE EXCEPTION 'Cron job "%" not found. Register it via SQL Editor first.', p_job_name;
  END IF;

  PERFORM cron.alter_job(v_job_id, schedule := v_cron_expr);
  RETURN v_cron_expr;
END;
$$;

GRANT EXECUTE ON FUNCTION update_cron_schedule(TEXT, INT, INT) TO authenticated;

-- 현재 스케줄 조회 (KST 시간으로 환산은 클라이언트에서)
CREATE OR REPLACE FUNCTION get_cron_schedule(p_job_name TEXT)
RETURNS TABLE(jobname TEXT, schedule TEXT, active BOOLEAN, last_run TIMESTAMPTZ, last_status TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  RETURN QUERY
  SELECT
    j.jobname::TEXT,
    j.schedule::TEXT,
    j.active,
    (SELECT d.start_time FROM cron.job_run_details d WHERE d.jobid = j.jobid ORDER BY d.start_time DESC LIMIT 1) AS last_run,
    (SELECT d.status::TEXT FROM cron.job_run_details d WHERE d.jobid = j.jobid ORDER BY d.start_time DESC LIMIT 1) AS last_status
  FROM cron.job j
  WHERE j.jobname = p_job_name;
END;
$$;

GRANT EXECUTE ON FUNCTION get_cron_schedule(TEXT) TO authenticated;

-- 활성/비활성 토글
CREATE OR REPLACE FUNCTION set_cron_active(p_job_name TEXT, p_active BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_job_id BIGINT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = p_job_name;
  IF v_job_id IS NULL THEN
    RAISE EXCEPTION 'Cron job "%" not found.', p_job_name;
  END IF;

  PERFORM cron.alter_job(v_job_id, active := p_active);
END;
$$;

GRANT EXECUTE ON FUNCTION set_cron_active(TEXT, BOOLEAN) TO authenticated;
