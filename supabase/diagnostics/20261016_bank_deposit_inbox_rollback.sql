-- 무통장 입금함 되돌리기 (20261016030000_bank_deposit_inbox.sql 취소)
-- ⚠️ 입금함 목록과 입금자명 기억이 지워짐(복구 불가). 이미 '등록'한 입금은 manual_payments·구매 금액에 남아 있음(그대로 유지).
DROP FUNCTION IF EXISTS admin_bank_deposit_candidates(BIGINT);
DROP FUNCTION IF EXISTS admin_reopen_bank_deposit(BIGINT);
DROP FUNCTION IF EXISTS admin_exclude_bank_deposit(BIGINT, TEXT);
DROP FUNCTION IF EXISTS admin_process_bank_deposit(BIGINT, UUID, INTEGER, INTEGER, TIMESTAMPTZ, BOOLEAN);
DROP TABLE IF EXISTS depositor_aliases;
DROP TABLE IF EXISTS bank_deposits;
