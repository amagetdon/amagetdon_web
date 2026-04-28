-- 매분 cron job → 10분 주기로 완화 (Edge Function 호출량 1/10 절감)
-- webhook-schedule-runner 가 매분 호출되어 사용량의 대부분을 차지함.
-- 도래한 schedule 발송이 최대 10분 지연되지만, 알림톡/CRM 용도엔 충분한 정밀도.

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT jobid, jobname FROM cron.job WHERE schedule = '* * * * *' LOOP
    PERFORM cron.alter_job(r.jobid, schedule := '*/10 * * * *');
    RAISE NOTICE 'Relaxed cron job % (id=%) from every-minute to every-10-minutes', r.jobname, r.jobid;
  END LOOP;
END $$;

-- 모든 cron job 목록을 어드민이 조회할 수 있도록 RPC 추가
CREATE OR REPLACE FUNCTION list_cron_jobs()
RETURNS TABLE(jobid BIGINT, jobname TEXT, schedule TEXT, command TEXT, active BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  RETURN QUERY
  SELECT j.jobid, j.jobname::TEXT, j.schedule::TEXT, j.command::TEXT, j.active
  FROM cron.job j
  ORDER BY j.jobid;
END;
$$;
GRANT EXECUTE ON FUNCTION list_cron_jobs() TO authenticated;
