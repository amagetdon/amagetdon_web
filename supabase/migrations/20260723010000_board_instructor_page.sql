-- 뉴스레터 강사 페이지(bcave 식) 지원
--   /board      : 강사 카드 그리드 — 프로필/직함/경력 배지/칼럼 수/구독자 수/멤버십 가격
--   /board/instructor/:id : 강사 히어로 + 글 목록(№순번, 무료/유료 필터, 썸네일)
-- 이를 위해 목록/강사 RPC 반환 컬럼을 확장한다. 반환 타입 변경이므로 DROP 후 재생성.

-- 강사 카드/히어로: 멤버십 상품 정보(가격·기간·구매여부)와 구독자 수(미만료 구매자)까지 반환.
DROP FUNCTION IF EXISTS get_board_instructors();
CREATE FUNCTION get_board_instructors()
RETURNS TABLE (
  id INTEGER,
  name TEXT,
  image_url TEXT,
  title TEXT,
  careers TEXT[],
  post_count BIGINT,
  subscriber_count BIGINT,
  membership_course_id INTEGER,
  price INTEGER,
  duration_days INTEGER,
  is_subscribed BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    i.id,
    i.name,
    COALESCE(i.thumbnail_url, i.image_url) AS image_url,
    i.title,
    i.careers,
    COUNT(b.id) AS post_count,
    (SELECT COUNT(DISTINCT p.user_id) FROM purchases p
      WHERE p.course_id = i.membership_course_id
        AND (p.expires_at IS NULL OR p.expires_at > now())) AS subscriber_count,
    i.membership_course_id,
    COALESCE(c.sale_price, c.original_price) AS price,
    NULLIF(c.duration_days, 0) AS duration_days,
    EXISTS (SELECT 1 FROM purchases p
      WHERE p.user_id = auth.uid()
        AND p.course_id = i.membership_course_id
        AND (p.expires_at IS NULL OR p.expires_at > now())) AS is_subscribed
  FROM instructors i
  JOIN board_posts b ON b.instructor_id = i.id AND b.is_listed AND b.is_published
  LEFT JOIN courses c ON c.id = i.membership_course_id
  GROUP BY i.id, c.id
  ORDER BY MIN(i.sort_order), i.name;
$$;

GRANT EXECUTE ON FUNCTION get_board_instructors() TO anon, authenticated;

-- 공개 목록 확장:
--   is_paid   : 유료(멤버십 연결) 글 여부 — 목록의 "멤버십/무료" 배지용 (is_locked 는 "나에게 잠김")
--   thumbnail : 본문 첫 이미지 URL (없으면 NULL — 프론트에서 아이콘 폴백)
--   seq       : 강사 내 발행 순번 (오래된 글이 1) — №001 스타일 표기용. 필터와 무관하게 고정.
--   p_paid    : NULL=전체, TRUE=유료만, FALSE=무료만
DROP FUNCTION IF EXISTS get_board_posts_listed(INTEGER, INT, INT);
DROP FUNCTION IF EXISTS get_board_posts_listed(INTEGER, INT, INT, BOOLEAN);
CREATE FUNCTION get_board_posts_listed(
  p_instructor_id INTEGER DEFAULT NULL,
  p_limit INT DEFAULT 10,
  p_offset INT DEFAULT 0,
  p_paid BOOLEAN DEFAULT NULL
)
RETURNS TABLE (
  id BIGINT,
  title TEXT,
  excerpt TEXT,
  instructor_id INTEGER,
  instructor_name TEXT,
  instructor_image TEXT,
  is_locked BOOLEAN,
  is_paid BOOLEAN,
  thumbnail TEXT,
  seq BIGINT,
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
  ), base AS (
    SELECT
      b.id, b.title, b.content, b.cta_enabled, b.instructor_id, b.created_at,
      i.name AS instructor_name,
      COALESCE(i.thumbnail_url, i.image_url) AS instructor_image,
      COALESCE(b.required_course_id, i.membership_course_id) AS unlock_id,
      ROW_NUMBER() OVER (PARTITION BY b.instructor_id ORDER BY b.created_at ASC, b.id ASC) AS seq
    FROM board_posts b
    LEFT JOIN instructors i ON i.id = b.instructor_id
    WHERE b.is_listed AND b.is_published
  )
  SELECT
    base.id,
    base.title,
    left(btrim(regexp_replace(
      replace(replace(replace(replace(replace(replace(
        regexp_replace(base.content, '<[^>]*>', ' ', 'g'),
        '&nbsp;', ' '), '&amp;', '&'), '&lt;', '<'), '&gt;', '>'), '&quot;', '"'), '&#39;', ''''),
      '\s+', ' ', 'g')), 200) AS excerpt,
    base.instructor_id,
    base.instructor_name,
    base.instructor_image,
    CASE
      WHEN base.unlock_id IS NULL THEN base.cta_enabled AND me.uid IS NULL
      ELSE NOT me.is_admin AND NOT EXISTS (
        SELECT 1 FROM purchases p
        WHERE p.user_id = me.uid
          AND p.course_id = base.unlock_id
          AND (p.expires_at IS NULL OR p.expires_at > now())
      )
    END AS is_locked,
    base.unlock_id IS NOT NULL AS is_paid,
    (regexp_match(base.content, '<img[^>]*src=["'']([^"'']+)["'']'))[1] AS thumbnail,
    base.seq,
    base.created_at,
    COUNT(*) OVER () AS total_count
  FROM base
  CROSS JOIN me
  WHERE (p_instructor_id IS NULL OR base.instructor_id = p_instructor_id)
    AND (p_paid IS NULL OR (base.unlock_id IS NOT NULL) = p_paid)
  ORDER BY base.created_at DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 50) OFFSET GREATEST(p_offset, 0);
$$;

GRANT EXECUTE ON FUNCTION get_board_posts_listed(INTEGER, INT, INT, BOOLEAN) TO anon, authenticated;
