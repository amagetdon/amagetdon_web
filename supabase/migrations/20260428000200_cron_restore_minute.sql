-- 매 10분 으로 늘렸던 cron 을 다시 매 1분으로 복구.
-- cron 호출은 사용자 수와 무관한 고정 비용 (월 43,200회 ≈ Pro 한도의 2.2%)
-- 알림톡 예약 발송 즉각성이 우선.

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT jobid, jobname FROM cron.job WHERE schedule = '*/10 * * * *' LOOP
    PERFORM cron.alter_job(r.jobid, schedule := '* * * * *');
    RAISE NOTICE 'Restored cron job % (id=%) to every-minute', r.jobname, r.jobid;
  END LOOP;
END $$;
