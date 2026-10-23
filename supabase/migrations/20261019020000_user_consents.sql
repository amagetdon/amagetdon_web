-- 회원 약관·마케팅 수신 동의 기록 (2026-10-19) — 카카오싱크 서비스 약관(A안)
-- 카카오 로그인 동의 화면에서 받은 약관 동의 결과를 저장한다. 회원정보 표(profiles)는 바꾸지 않는다.
-- 쓰기: 서버 함수(/api/kakao-consent)가 카카오에 직접 확인한 결과만 서버 키로 기록(화면에서 직접 쓰기 불가).
-- 읽기: 본인 + 관리자. 되돌리기: supabase/diagnostics/20261019_user_consents_rollback.sql

CREATE TABLE IF NOT EXISTS public.user_consents (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  terms_agreed_at timestamptz,          -- 서비스 이용약관(필수)
  privacy_agreed_at timestamptz,        -- 개인정보 수집·이용(필수)
  marketing_agreed boolean NOT NULL DEFAULT false,  -- 마케팅 정보 수신(선택)
  marketing_changed_at timestamptz,     -- 마케팅 동의·철회 시각
  source text NOT NULL DEFAULT 'kakao_sync',
  raw jsonb,                            -- 카카오가 돌려준 약관 동의 내역 원본(태그·동의 여부·시각만, 개인정보 없음)
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_consents_select ON public.user_consents;
CREATE POLICY user_consents_select ON public.user_consents
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR is_admin());
-- insert/update/delete 정책 없음 → 서버 키(service role)로만 기록
