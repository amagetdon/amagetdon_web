-- 어드민 데이터 챗봇 되돌리기 (20261016000000_admin_data_chat.sql 취소)
-- 챗봇 전용으로 새로 만든 것만 지운다. 기존 표·함수는 건드리지 않음.
-- ⚠️ admin_chat_usage(챗봇 사용량 기록)는 지우면 복구 불가 — 필요하면 먼저 내려받기.
drop function if exists public.admin_chat_applicants(date, date, text, integer, text[]);
drop function if exists public.admin_chat_visits(date, date, text, integer, text[]);
drop function if exists public.admin_chat_ad_spend(date, date, text, integer, text[]);
drop function if exists public.chat_check_group(text[], text[]);
drop function if exists public.chat_age_band(text);
drop table if exists public.admin_chat_usage;
