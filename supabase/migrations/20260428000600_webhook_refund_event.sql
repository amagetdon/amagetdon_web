-- 환불 알림톡 — 어드민이 회원의 결제를 환불 처리한 직후 발송.
INSERT INTO webhook_custom_events (code, label, description, trigger_hint, built_in, sort_order)
VALUES
  ('refund', '환불 완료', '관리자가 회원의 강의/전자책 결제를 환불 처리한 직후 발송', '어드민 → 회원 → 환불', TRUE, 7)
ON CONFLICT (code) DO NOTHING;
