-- profiles 보안 정비 (2026-10-12 점검)
-- 점검 결과(운영 pg_policies):
--   profiles_select  SELECT USING (true)            → 비로그인으로 전 회원(5,189명) 이름·이메일·전화·주소·생년월일 조회 가능
--   profiles_insert  INSERT WITH CHECK (true)       → 누구나 프로필 행 생성 가능(role 지정 포함)
--   profiles_update  UPDATE USING (auth.uid() = id) → 본인 행의 모든 컬럼 수정 가능(role='admin' 자기 승격 가능)
-- 선행: 20261012040000_purchase_feed_rpc.sql + PurchaseFeed 가 RPC 를 쓰는 코드 배포.

-- 관리자 판별 — SECURITY DEFINER 로 RLS 를 거치지 않아 profiles 정책 안에서 써도 재귀가 생기지 않음
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin');
$$;
GRANT EXECUTE ON FUNCTION is_admin() TO anon, authenticated;

-- 1) 조회: 본인 + 관리자만
DROP POLICY IF EXISTS profiles_select ON profiles;
CREATE POLICY profiles_select ON profiles FOR SELECT
  USING (auth.uid() = id OR (SELECT is_admin()));

-- 2) 생성: 본인 행 또는 관리자만 (가입 시 프로필 생성 트리거·서버 함수는 RLS 영향 없음)
DROP POLICY IF EXISTS profiles_insert ON profiles;
CREATE POLICY profiles_insert ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id OR (SELECT is_admin()));

-- 3) 권한(role) 보호 — 브라우저(anon/authenticated)에서 관리자가 아닌 사용자가 role 을 바꾸거나 지정하지 못하게.
--    SECURITY INVOKER(기본) 라 current_user 가 호출자 역할: 브라우저=authenticated, 서버(service_role)·SQL·DEFINER 함수=그 외 → 통과.
CREATE OR REPLACE FUNCTION protect_profile_role()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') AND NOT is_admin() THEN
    IF TG_OP = 'INSERT' THEN
      NEW.role := 'user';
    ELSIF NEW.role IS DISTINCT FROM OLD.role THEN
      NEW.role := OLD.role;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_protect_role ON profiles;
CREATE TRIGGER profiles_protect_role BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION protect_profile_role();

-- 4) [핫픽스 2026-10-12] 기존 "admin can update any profile" 정책이 USING 안에서 profiles 를 다시 조회해,
--    SELECT 정책 변경 후 일반 회원 UPDATE 시 "infinite recursion detected in policy for relation profiles"(42P17) 발생
--    (온보딩 저장 실패·카카오 정보 자동 채움 실패). is_admin() 로 교체 — 운영 트랜잭션 시뮬레이션으로 일반/관리자 모두 확인.
DROP POLICY IF EXISTS "admin can update any profile" ON profiles;
CREATE POLICY "admin can update any profile" ON profiles FOR UPDATE
  USING ((SELECT is_admin())) WITH CHECK (true);
