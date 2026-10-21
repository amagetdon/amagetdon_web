-- 강의 신청 선택 질문 답 (2026-10-19) — 웹툰 랜딩(/w/:slug) W5·W6
-- 새 표 1개 + 저장 함수 1개. 기존 표(purchases·profiles)는 바꾸지 않는다.
-- 쓰기: 그 강의를 신청한 본인만, 저장 함수(save_course_survey)로만. 읽기: 관리자만.
-- 되돌리기: supabase/diagnostics/20261019_course_survey_answers_rollback.sql

CREATE TABLE IF NOT EXISTS public.course_survey_answers (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id integer NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  blog_exp text CHECK (blog_exp IS NULL OR char_length(blog_exp) <= 50),
  daily_time text CHECK (daily_time IS NULL OR char_length(daily_time) <= 50),
  concern text CHECK (concern IS NULL OR char_length(concern) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, course_id)
);
CREATE INDEX IF NOT EXISTS course_survey_answers_course_idx ON public.course_survey_answers (course_id);

ALTER TABLE public.course_survey_answers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS course_survey_answers_admin_select ON public.course_survey_answers;
CREATE POLICY course_survey_answers_admin_select ON public.course_survey_answers
  FOR SELECT TO authenticated USING (is_admin());
-- insert/update/delete 정책 없음 → 화면에서 직접 쓰기 불가, 아래 함수로만

CREATE OR REPLACE FUNCTION public.save_course_survey(
  p_course_id integer, p_blog_exp text DEFAULT NULL, p_daily_time text DEFAULT NULL, p_concern text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.' USING errcode = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM purchases WHERE user_id = v_uid AND course_id = p_course_id) THEN
    RAISE EXCEPTION '신청한 강의만 답할 수 있습니다.' USING errcode = '42501';
  END IF;
  -- 질문 화면마다 한 칸씩 저장 → 빈 값은 기존 답을 지우지 않는다
  INSERT INTO course_survey_answers (user_id, course_id, blog_exp, daily_time, concern)
  VALUES (v_uid, p_course_id,
          nullif(left(btrim(p_blog_exp), 50), ''), nullif(left(btrim(p_daily_time), 50), ''), nullif(left(btrim(p_concern), 1000), ''))
  ON CONFLICT (user_id, course_id) DO UPDATE SET
    blog_exp = coalesce(excluded.blog_exp, course_survey_answers.blog_exp),
    daily_time = coalesce(excluded.daily_time, course_survey_answers.daily_time),
    concern = coalesce(excluded.concern, course_survey_answers.concern),
    updated_at = now();
END;
$$;
REVOKE ALL ON FUNCTION public.save_course_survey(integer, text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.save_course_survey(integer, text, text, text) TO authenticated;
