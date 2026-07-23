-- 게시판 → "아마겟돈 뉴스레터" (강사별 유료 칼럼) 확장
-- 의도: 기존 관리자 숨김 게시판(board_posts)을 bcave 식 강사별 멤버십 콘텐츠로 확장.
--   1) 글에 강사(instructor_id)를 연결하고, is_listed 로 공개 목록(/board) 노출을 선택한다.
--      기존 글은 is_listed=FALSE 로 남아 지금처럼 share_token 링크로만 열람된다.
--   2) 열람권(혼합 모델): 글별 required_course_id 가 있으면 그 상품, 없으면 강사의
--      membership_course_id. 둘 다 없으면 무료 글(기존 티저 규칙: 비로그인만 잠금).
--   3) 유료 글 잠금은 멤버십 상품 구매(미만료) 여부로만 판정 — 강사의 다른 강의 구매는 무관.
-- 보안: 기존 티저는 전체 본문을 내려보내고 클라이언트 CSS 로만 가렸다(API 로 전문 유출).
--   유료화하면서 잠금 판정과 본문 자르기를 SECURITY DEFINER RPC 안으로 옮겨,
--   잠긴 글은 미리보기 분량만 서버에서 잘라 반환한다. 직접 SELECT 는 여전히 관리자 전용(RLS).

-- 강사 기본 멤버십 상품 (글별 지정이 없을 때 fallback)
ALTER TABLE instructors
  ADD COLUMN IF NOT EXISTS membership_course_id INTEGER REFERENCES courses(id) ON DELETE SET NULL;

ALTER TABLE board_posts
  ADD COLUMN IF NOT EXISTS instructor_id INTEGER REFERENCES instructors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS required_course_id INTEGER REFERENCES courses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_listed BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS board_posts_listed_idx ON board_posts (is_listed, is_published, created_at DESC);
CREATE INDEX IF NOT EXISTS board_posts_instructor_idx ON board_posts (instructor_id);

-- 단건 공개 조회: share_token(비밀 링크) 또는 id(공개 목록 진입) 로 조회.
-- id 접근은 is_listed=TRUE 글만 허용 — 숨김 글을 id 열거로 발견할 수 없게 한다.
-- 잠긴 글의 content 는 미리보기 분량(preview_height 기반)만 잘라 반환한다.
DROP FUNCTION IF EXISTS get_board_post_public(TEXT, BIGINT);
CREATE FUNCTION get_board_post_public(p_token TEXT DEFAULT NULL, p_id BIGINT DEFAULT NULL)
RETURNS TABLE (
  id BIGINT,
  title TEXT,
  content TEXT,
  preview_height INT,
  cta_enabled BOOLEAN,
  cta_locked_text TEXT,
  cta_title TEXT,
  cta_subtitle TEXT,
  cta_button_text TEXT,
  instructor_id INTEGER,
  instructor_name TEXT,
  unlock_course_id INTEGER,
  is_locked BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_post board_posts%ROWTYPE;
  v_instructor_name TEXT;
  v_unlock INTEGER;
  v_locked BOOLEAN;
  v_content TEXT;
BEGIN
  IF p_token IS NOT NULL THEN
    SELECT b.* INTO v_post FROM board_posts b
      WHERE b.share_token = p_token AND b.is_published LIMIT 1;
  ELSIF p_id IS NOT NULL THEN
    SELECT b.* INTO v_post FROM board_posts b
      WHERE b.id = p_id AND b.is_published AND b.is_listed LIMIT 1;
  END IF;
  IF v_post.id IS NULL THEN RETURN; END IF;

  IF v_post.instructor_id IS NOT NULL THEN
    SELECT i.name, COALESCE(v_post.required_course_id, i.membership_course_id)
      INTO v_instructor_name, v_unlock
      FROM instructors i WHERE i.id = v_post.instructor_id;
  ELSE
    v_unlock := v_post.required_course_id;
  END IF;

  IF v_unlock IS NULL THEN
    -- 열람 상품이 없는 무료 글: 기존 티저 규칙 그대로 (티저 on + 비로그인 → 잠금)
    v_locked := v_post.cta_enabled AND auth.uid() IS NULL;
  ELSE
    -- 유료 글: 해당 상품을 구매했고 수강기간이 남은 사람(또는 관리자)만 열람
    v_locked := NOT EXISTS (
        SELECT 1 FROM purchases p
        WHERE p.user_id = auth.uid()
          AND p.course_id = v_unlock
          AND (p.expires_at IS NULL OR p.expires_at > now())
      )
      AND NOT EXISTS (
        SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.role = 'admin'
      );
  END IF;

  v_content := v_post.content;
  IF v_locked THEN
    -- preview_height(px) 를 넉넉히 덮는 분량만 반환. 끝의 미완성 태그 조각은 잘라낸다.
    v_content := regexp_replace(
      left(v_post.content, GREATEST(v_post.preview_height * 8, 600)),
      '<[^>]*$', ''
    );
  END IF;

  RETURN QUERY SELECT
    v_post.id, v_post.title, v_content,
    v_post.preview_height, v_post.cta_enabled, v_post.cta_locked_text,
    v_post.cta_title, v_post.cta_subtitle, v_post.cta_button_text,
    v_post.instructor_id, v_instructor_name,
    v_unlock, v_locked,
    v_post.created_at, v_post.updated_at;
END;
$$;

GRANT EXECUTE ON FUNCTION get_board_post_public(TEXT, BIGINT) TO anon, authenticated;

-- 구 클라이언트(배포 캐시) 호환용 래퍼. 이전 버전은 전체 본문을 반환했으므로
-- 반드시 서버 컷 버전 위에서 재작성해 유출 경로를 막는다.
DROP FUNCTION IF EXISTS get_board_post_by_token(TEXT);
CREATE FUNCTION get_board_post_by_token(p_token TEXT)
RETURNS TABLE (
  id BIGINT,
  title TEXT,
  content TEXT,
  preview_height INT,
  cta_enabled BOOLEAN,
  cta_locked_text TEXT,
  cta_title TEXT,
  cta_subtitle TEXT,
  cta_button_text TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT g.id, g.title, g.content, g.preview_height, g.cta_enabled,
         g.cta_locked_text, g.cta_title, g.cta_subtitle, g.cta_button_text,
         g.created_at, g.updated_at
  FROM get_board_post_public(p_token, NULL) g;
$$;

GRANT EXECUTE ON FUNCTION get_board_post_by_token(TEXT) TO anon, authenticated;

-- 공개 목록: is_listed & is_published 글만. content 는 태그/엔티티를 걷어낸 200자 발췌만 노출.
-- is_locked 는 목록의 자물쇠 배지용 — 단건과 동일한 판정.
DROP FUNCTION IF EXISTS get_board_posts_listed(INTEGER, INT, INT);
CREATE FUNCTION get_board_posts_listed(
  p_instructor_id INTEGER DEFAULT NULL,
  p_limit INT DEFAULT 10,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id BIGINT,
  title TEXT,
  excerpt TEXT,
  instructor_id INTEGER,
  instructor_name TEXT,
  instructor_image TEXT,
  is_locked BOOLEAN,
  created_at TIMESTAMPTZ,
  total_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH me AS (
    SELECT auth.uid() AS uid,
           EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.role = 'admin') AS is_admin
  )
  SELECT
    b.id,
    b.title,
    left(btrim(regexp_replace(
      replace(replace(replace(replace(replace(replace(
        regexp_replace(b.content, '<[^>]*>', ' ', 'g'),
        '&nbsp;', ' '), '&amp;', '&'), '&lt;', '<'), '&gt;', '>'), '&quot;', '"'), '&#39;', ''''),
      '\s+', ' ', 'g')), 200) AS excerpt,
    b.instructor_id,
    i.name AS instructor_name,
    COALESCE(i.thumbnail_url, i.image_url) AS instructor_image,
    CASE
      WHEN COALESCE(b.required_course_id, i.membership_course_id) IS NULL
        THEN b.cta_enabled AND me.uid IS NULL
      ELSE NOT me.is_admin AND NOT EXISTS (
        SELECT 1 FROM purchases p
        WHERE p.user_id = me.uid
          AND p.course_id = COALESCE(b.required_course_id, i.membership_course_id)
          AND (p.expires_at IS NULL OR p.expires_at > now())
      )
    END AS is_locked,
    b.created_at,
    COUNT(*) OVER () AS total_count
  FROM board_posts b
  LEFT JOIN instructors i ON i.id = b.instructor_id
  CROSS JOIN me
  WHERE b.is_listed AND b.is_published
    AND (p_instructor_id IS NULL OR b.instructor_id = p_instructor_id)
  ORDER BY b.created_at DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 50) OFFSET GREATEST(p_offset, 0);
$$;

GRANT EXECUTE ON FUNCTION get_board_posts_listed(INTEGER, INT, INT) TO anon, authenticated;

-- 목록 상단 강사 탭: 공개 글이 1개 이상 있는 강사만.
DROP FUNCTION IF EXISTS get_board_instructors();
CREATE FUNCTION get_board_instructors()
RETURNS TABLE (
  id INTEGER,
  name TEXT,
  image_url TEXT,
  post_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT i.id, i.name, COALESCE(i.thumbnail_url, i.image_url), COUNT(b.id)
  FROM instructors i
  JOIN board_posts b ON b.instructor_id = i.id AND b.is_listed AND b.is_published
  GROUP BY i.id
  ORDER BY MIN(i.sort_order), i.name;
$$;

GRANT EXECUTE ON FUNCTION get_board_instructors() TO anon, authenticated;
