-- 챗봇 '실제 입금' 집계 되돌리기 (20261016010000_admin_chat_payments.sql 취소)
-- 새로 만든 집계 함수 1개만 지운다. 결제 표(linkpay_payments·manual_payments)는 건드리지 않음.
drop function if exists public.admin_chat_payments(date, date, text, integer, text[]);
