-- 환불규정 템플릿: 기본 템플릿 지정 기능
ALTER TABLE refund_policy_templates
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;

-- 기본 템플릿은 최대 1개만 존재하도록 부분 유니크 인덱스
CREATE UNIQUE INDEX IF NOT EXISTS idx_refund_policy_templates_single_default
  ON refund_policy_templates (is_default)
  WHERE is_default = true;
