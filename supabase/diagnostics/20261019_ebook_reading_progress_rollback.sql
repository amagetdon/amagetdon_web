-- 되돌리기: 20261019030000_ebook_reading_progress.sql
-- 읽음 기록 표와 저장 함수를 지운다. 쌓인 읽음 기록도 함께 지워지므로, 남겨야 하면 먼저 내보낸 뒤 실행.
-- 웹 코드는 표·함수가 없어도 뷰어가 열리게 되어 있음(저장 실패는 조용히 무시, 이어 읽기만 1쪽부터).
drop function if exists public.save_ebook_progress(integer, integer, integer, boolean);
drop table if exists public.ebook_reading_progress;
