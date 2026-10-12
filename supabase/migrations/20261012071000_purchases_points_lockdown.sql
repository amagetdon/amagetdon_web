-- 구매·포인트 보안 3단계-2: 브라우저 직접 쓰기 차단 (선행: 3단계-1 + 관리자 화면 코드 배포)
-- 무료 신청(enroll_free)·포인트 구매(purchase_with_points)·카드 결제(confirm-payment, service_role)는 서버에서 처리되므로 영향 없음.

-- 1) 구매 행: 일반 회원 직접 생성 금지 (관리자 정책 purchases_admin_insert 는 유지)
DROP POLICY IF EXISTS purchases_insert ON purchases;

-- 2) 포인트: 브라우저(anon/authenticated)의 비관리자는 points 를 바꾸거나 지정할 수 없음
--    SECURITY DEFINER 함수(enroll_free·purchase_with_points·admin_add_points) 안의 변경은 current_user 가 함수 소유자라 통과.
CREATE OR REPLACE FUNCTION protect_profile_role()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') AND NOT is_admin() THEN
    IF TG_OP = 'INSERT' THEN
      NEW.role := 'user';
      NEW.points := 0;
    ELSE
      IF NEW.role IS DISTINCT FROM OLD.role THEN NEW.role := OLD.role; END IF;
      IF NEW.points IS DISTINCT FROM OLD.points THEN NEW.points := OLD.points; END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 3) 기존 포인트 함수: 일반 회원 실행 권한 회수 (service_role·소유자는 유지)
REVOKE EXECUTE ON FUNCTION add_points(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION insert_point_log FROM PUBLIC, anon, authenticated;
