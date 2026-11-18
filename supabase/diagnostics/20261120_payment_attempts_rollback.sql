-- 되돌리기: 20261120000000_payment_attempts.sql
-- 주의: 그동안 쌓인 결제창 기록이 함께 지워진다. 사이트 코드는 이 함수가 없어도 결제에 영향이 없다(기록만 안 됨).
drop function if exists public.log_payment_attempt(text, text, integer, text, integer, text, text);
drop table if exists public.payment_attempts;
