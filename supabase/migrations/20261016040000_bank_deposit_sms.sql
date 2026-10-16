-- 무통장 입금함: 입금 문자(SMS) 출처 추가 (2026-10-16)
-- 대표님 폰(안드로이드)으로 오는 신한은행 입금 문자를 /api/bank-sms 가 받아 입금함에 넣는다.
--  · source 에 'sms' 허용
--  · raw_text: 문자 원문(관리자만 조회 — 입금함 표 자체가 관리자 전용). 형식을 못 읽은 문자도 원문으로 확인
-- 되돌리기: supabase/diagnostics/20261016_bank_deposit_sms_rollback.sql
ALTER TABLE bank_deposits DROP CONSTRAINT IF EXISTS bank_deposits_source_check;
ALTER TABLE bank_deposits ADD CONSTRAINT bank_deposits_source_check CHECK (source IN ('clobe', 'excel', 'seed', 'manual', 'sms'));
ALTER TABLE bank_deposits ADD COLUMN IF NOT EXISTS raw_text TEXT;

SELECT
  (SELECT count(*) FROM information_schema.columns WHERE table_name = 'bank_deposits' AND column_name = 'raw_text') AS raw_text_col,
  (SELECT pg_get_constraintdef(oid) LIKE '%sms%' FROM pg_constraint WHERE conname = 'bank_deposits_source_check') AS sms_allowed;
-- 기대 결과: raw_text_col 1, sms_allowed true
