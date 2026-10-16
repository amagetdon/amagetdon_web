-- 입금 문자 출처 되돌리기 (20261016040000_bank_deposit_sms.sql 취소)
-- ⚠️ 문자로 들어온 입금 줄(source='sms')을 먼저 지워야 출처 목록을 되돌릴 수 있음. 이미 '등록'한 입금의 매출은 그대로.
DELETE FROM bank_deposits WHERE source = 'sms' AND status = 'pending';
UPDATE bank_deposits SET source = 'manual' WHERE source = 'sms';
ALTER TABLE bank_deposits DROP CONSTRAINT IF EXISTS bank_deposits_source_check;
ALTER TABLE bank_deposits ADD CONSTRAINT bank_deposits_source_check CHECK (source IN ('clobe', 'excel', 'seed', 'manual'));
ALTER TABLE bank_deposits DROP COLUMN IF EXISTS raw_text;
