-- 강의 일정 기반 예약 알림톡 (D-3, D-1, 시작 30분 전 등)
-- webhook_schedules: 강의별 알림톡 발송 정의 (템플릿)
-- webhook_schedule_runs: 사용자별 발송 큐 (구매 시점에 fan-out)

CREATE TABLE IF NOT EXISTS webhook_schedules (
  id SERIAL PRIMARY KEY,
  scope TEXT NOT NULL CHECK (scope IN ('course', 'ebook')),
  scope_id BIGINT NOT NULL,
  label TEXT NOT NULL DEFAULT '',           -- 'D-3 안내', '시작 30분 전' 등
  trigger_type TEXT NOT NULL DEFAULT 'time_offset' CHECK (trigger_type IN ('time_offset', 'enrollment_full', 'manual')),
  offset_minutes INTEGER NOT NULL DEFAULT 0, -- time_offset 전용: 음수=강의 전 / 양수=강의 후
  request_template TEXT NOT NULL DEFAULT '', -- 기존 webhook 템플릿과 동일 형식 (key=value 또는 JSON)
  enabled BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  -- enrollment_full 자동 트리거 1회만 발사 보장용
  enrollment_full_fired_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS webhook_schedules_scope_idx ON webhook_schedules (scope, scope_id);

ALTER TABLE webhook_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage webhook_schedules" ON webhook_schedules
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE TRIGGER set_updated_at BEFORE UPDATE ON webhook_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 사용자별 발송 큐 (각 구매마다 강의 일정 × 스케줄 정의 만큼 fan-out)
CREATE TABLE IF NOT EXISTS webhook_schedule_runs (
  id BIGSERIAL PRIMARY KEY,
  webhook_schedule_id INTEGER NOT NULL REFERENCES webhook_schedules(id) ON DELETE CASCADE,
  course_schedule_id INTEGER REFERENCES schedules(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 표시용 스냅샷
  user_name TEXT,
  user_phone TEXT,
  user_email TEXT,
  course_title TEXT,
  course_scheduled_at TIMESTAMPTZ,

  fire_at TIMESTAMPTZ NOT NULL,
  fired_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'skipped', 'cancelled')),
  webhook_log_id BIGINT REFERENCES webhook_logs(id) ON DELETE SET NULL,
  error_message TEXT,
  attempt_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT now()
);

-- 도래한 미발송 검색용
CREATE INDEX IF NOT EXISTS webhook_schedule_runs_due_idx
  ON webhook_schedule_runs (fire_at)
  WHERE fired_at IS NULL AND status = 'pending';
CREATE INDEX IF NOT EXISTS webhook_schedule_runs_user_idx ON webhook_schedule_runs (user_id);
CREATE INDEX IF NOT EXISTS webhook_schedule_runs_schedule_idx ON webhook_schedule_runs (webhook_schedule_id);

ALTER TABLE webhook_schedule_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin read webhook_schedule_runs" ON webhook_schedule_runs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "Admin update webhook_schedule_runs" ON webhook_schedule_runs
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "Admin delete webhook_schedule_runs" ON webhook_schedule_runs
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "Anyone insert webhook_schedule_runs" ON webhook_schedule_runs
  FOR INSERT WITH CHECK (true);

-- 환불 시 취소 처리용 헬퍼 함수
CREATE OR REPLACE FUNCTION cancel_webhook_schedule_runs_for_user_course(
  p_user_id UUID,
  p_scope TEXT,
  p_scope_id BIGINT
) RETURNS INTEGER AS $$
DECLARE
  cancelled_count INTEGER;
BEGIN
  UPDATE webhook_schedule_runs r
  SET status = 'cancelled'
  FROM webhook_schedules s
  WHERE r.webhook_schedule_id = s.id
    AND r.user_id = p_user_id
    AND s.scope = p_scope
    AND s.scope_id = p_scope_id
    AND r.fired_at IS NULL
    AND r.status = 'pending';

  GET DIAGNOSTICS cancelled_count = ROW_COUNT;
  RETURN cancelled_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION cancel_webhook_schedule_runs_for_user_course(UUID, TEXT, BIGINT) TO authenticated;
