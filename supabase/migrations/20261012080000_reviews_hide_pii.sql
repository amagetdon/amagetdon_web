-- 후기 작성자 개인정보(email/phone) 공개 조회 차단 (2026-10-12 점검: 익명으로 1,263건의 이메일·전화 조회 가능)
-- 화면에서는 두 컬럼을 쓰지 않음(엑셀 일괄 업로드로 저장된 값). 데이터는 그대로 두고 anon/authenticated 의 SELECT 권한만 컬럼 단위로 제한.
-- 쓰기(INSERT/UPDATE) 권한은 그대로 — 후기 작성·일괄 업로드 영향 없음. 코드는 REVIEW_PUBLIC_COLUMNS 로 공개 컬럼만 조회(선배포).
REVOKE SELECT ON reviews FROM anon, authenticated;
GRANT SELECT (id, user_id, course_id, instructor_id, author_name, title, content, rating, is_published, created_at, is_low_rating)
  ON reviews TO anon, authenticated;
