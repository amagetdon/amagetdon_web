-- 상세 페이지 '신청 카드'(일시·할인 문구·남은 자리·카운트다운) + '상단 타이머 배너' 설정 칸 (2026-10-16)
-- 강의·전자책마다 관리자가 켜고 끄는 설정(JSON). 비어 있으면(NULL) 기능 꺼짐 = 지금 화면 그대로.
-- 숫자(남은 자리·할인 수량)는 관리자가 직접 입력, 타이머는 종료 시각 + (선택) 반복 주기(분).
-- 기존 칸·데이터는 건드리지 않는다. 되돌리기: supabase/diagnostics/20261016_apply_card_top_banner_rollback.sql
--
-- apply_card 예: {"enabled":true,"show_schedule":true,"discount_label":"선착순 100% 할인","button_label":"무료 강의 참여하기",
--                 "seats":12,"countdown":{"label":"선착순 마감까지","end_at":"2026-10-23T10:30:00Z","loop_minutes":null}}
-- top_banner 예: {"enabled":true,"template":"오늘 남은 할인 수량: {n}개","number":22,
--                 "end_at":"2026-10-16T15:00:00Z","loop_minutes":1440,"end_text":"오늘 할인 마감"}
ALTER TABLE courses ADD COLUMN IF NOT EXISTS apply_card JSONB;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS top_banner JSONB;
ALTER TABLE ebooks  ADD COLUMN IF NOT EXISTS apply_card JSONB;
ALTER TABLE ebooks  ADD COLUMN IF NOT EXISTS top_banner JSONB;

SELECT table_name, column_name FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name IN ('courses', 'ebooks') AND column_name IN ('apply_card', 'top_banner')
 ORDER BY 1, 2;
-- 기대 결과: 4줄 (courses·ebooks × apply_card·top_banner)
