-- 환불규정: 강의/전자책별 환불규정 본문과 재사용 템플릿 저장소
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS refund_policy TEXT;

ALTER TABLE ebooks
  ADD COLUMN IF NOT EXISTS refund_policy TEXT;

CREATE TABLE IF NOT EXISTS refund_policy_templates (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE refund_policy_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read refund policy templates" ON refund_policy_templates
  FOR SELECT USING (true);

CREATE POLICY "Admin manage refund policy templates" ON refund_policy_templates
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE TRIGGER set_updated_at BEFORE UPDATE ON refund_policy_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
