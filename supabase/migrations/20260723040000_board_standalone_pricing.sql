-- 뉴스레터 독립 상품화 — 강의(courses) 연결을 제거하고 자체 가격 체계로 전환
--   1) 글 단건 판매: board_posts.is_paid(유료 글) + price(단건 판매가, 0 = 단건 판매 없이 구독 전용).
--      단건 구매는 영구 열람 (purchases.board_post_id, expires_at NULL).
--   2) 강사 월 구독: instructors.newsletter_price / newsletter_days(기본 30일).
--      구독 구매(purchases.board_instructor_id)는 expires_at 로 기간 관리, 재구매 시 연장.
--   3) 유료 글 열람 = 그 글 단건 구매 OR 해당 강사 유효 구독 OR 관리자.
-- 기존 강의 연결 컬럼(required_course_id / membership_course_id)은 미사용 상태에서 제거.
-- purchases 의 새 FK 는 각각 해당 테이블과의 유일한 관계라 PostgREST 임베드 모호성이 없다
-- (instructors.membership_course_id FK 사고의 재발 조건 아님 — 같은 페어에 FK 2개일 때만 발생).

ALTER TABLE board_posts
  ADD COLUMN IF NOT EXISTS is_paid BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS price INTEGER NOT NULL DEFAULT 0,
  DROP COLUMN IF EXISTS required_course_id;

ALTER TABLE instructors
  ADD COLUMN IF NOT EXISTS newsletter_price INTEGER,
  ADD COLUMN IF NOT EXISTS newsletter_days INTEGER NOT NULL DEFAULT 30,
  DROP COLUMN IF EXISTS membership_course_id;

ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS board_post_id BIGINT REFERENCES board_posts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS board_instructor_id INTEGER REFERENCES instructors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS purchases_board_post_idx ON purchases (user_id, board_post_id) WHERE board_post_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS purchases_board_sub_idx ON purchases (user_id, board_instructor_id) WHERE board_instructor_id IS NOT NULL;

-- 링크페이 상품 매핑에도 뉴스레터 상품(글 단건/강사 구독) 추가
ALTER TABLE linkpay_links
  ADD COLUMN IF NOT EXISTS board_post_id BIGINT REFERENCES board_posts(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS board_instructor_id INTEGER REFERENCES instructors(id) ON DELETE CASCADE;

-- 링크페이 결제 기록(큐)에도 매핑 결과 보관용 컬럼 (FK 없이 기록용)
ALTER TABLE linkpay_payments
  ADD COLUMN IF NOT EXISTS board_post_id BIGINT,
  ADD COLUMN IF NOT EXISTS board_instructor_id INTEGER;

-- ───────────────────── 단건 공개 조회 ─────────────────────
-- 잠금 판정: is_paid 글은 (단건 구매 OR 유효 구독 OR 관리자)만 전체 열람.
-- 무료 글은 기존 티저 규칙(cta_enabled + 비로그인 → 잠금) 유지.
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
  is_paid BOOLEAN,
  post_price INTEGER,
  sub_price INTEGER,
  sub_days INTEGER,
  is_purchased BOOLEAN,
  is_subscribed BOOLEAN,
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
  v_sub_price INTEGER;
  v_sub_days INTEGER;
  v_purchased BOOLEAN := FALSE;
  v_subscribed BOOLEAN := FALSE;
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
    SELECT i.name, NULLIF(i.newsletter_price, 0), NULLIF(i.newsletter_days, 0)
      INTO v_instructor_name, v_sub_price, v_sub_days
      FROM instructors i WHERE i.id = v_post.instructor_id;
  END IF;

  IF auth.uid() IS NOT NULL THEN
    v_purchased := EXISTS (
      SELECT 1 FROM purchases p
      WHERE p.user_id = auth.uid() AND p.board_post_id = v_post.id
    );
    IF v_post.instructor_id IS NOT NULL THEN
      v_subscribed := EXISTS (
        SELECT 1 FROM purchases p
        WHERE p.user_id = auth.uid()
          AND p.board_instructor_id = v_post.instructor_id
          AND (p.expires_at IS NULL OR p.expires_at > now())
      );
    END IF;
  END IF;

  IF NOT v_post.is_paid THEN
    -- 무료 글: 기존 티저 규칙 (티저 on + 비로그인 → 잠금)
    v_locked := v_post.cta_enabled AND auth.uid() IS NULL;
  ELSE
    v_locked := NOT v_purchased AND NOT v_subscribed
      AND NOT EXISTS (
        SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.role = 'admin'
      );
  END IF;

  v_content := v_post.content;
  IF v_locked THEN
    -- 잠긴 글은 미리보기 분량만 서버에서 잘라 반환 — API 로 전문이 유출되지 않게.
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
    v_post.is_paid, v_post.price, v_sub_price, v_sub_days,
    v_purchased, v_subscribed, v_locked,
    v_post.created_at, v_post.updated_at;
END;
$$;

GRANT EXECUTE ON FUNCTION get_board_post_public(TEXT, BIGINT) TO anon, authenticated;

-- 구 클라이언트 호환 래퍼 (반환 컬럼은 기존 그대로, 서버 컷 적용본 위에서 동작)
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

-- ───────────────────── 공개 목록 ─────────────────────
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
  price INTEGER,
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
      b.is_paid, b.price,
      i.name AS instructor_name,
      COALESCE(i.image_url, i.thumbnail_url) AS instructor_image,
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
      WHEN NOT base.is_paid THEN base.cta_enabled AND me.uid IS NULL
      ELSE NOT me.is_admin
        AND NOT EXISTS (
          SELECT 1 FROM purchases p
          WHERE p.user_id = me.uid AND p.board_post_id = base.id
        )
        AND NOT EXISTS (
          SELECT 1 FROM purchases p
          WHERE p.user_id = me.uid
            AND p.board_instructor_id = base.instructor_id
            AND (p.expires_at IS NULL OR p.expires_at > now())
        )
    END AS is_locked,
    base.is_paid,
    base.price,
    (regexp_match(base.content, '<img[^>]*src=["'']([^"'']+)["'']'))[1] AS thumbnail,
    base.seq,
    base.created_at,
    COUNT(*) OVER () AS total_count
  FROM base
  CROSS JOIN me
  WHERE (p_instructor_id IS NULL OR base.instructor_id = p_instructor_id)
    AND (p_paid IS NULL OR base.is_paid = p_paid)
  ORDER BY base.created_at DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 50) OFFSET GREATEST(p_offset, 0);
$$;

GRANT EXECUTE ON FUNCTION get_board_posts_listed(INTEGER, INT, INT, BOOLEAN) TO anon, authenticated;

-- ───────────────────── 강사 카드/히어로 ─────────────────────
DROP FUNCTION IF EXISTS get_board_instructors();
CREATE FUNCTION get_board_instructors()
RETURNS TABLE (
  id INTEGER,
  name TEXT,
  image_url TEXT,
  title TEXT,
  headline TEXT,
  bio TEXT,
  careers TEXT[],
  post_count BIGINT,
  subscriber_count BIGINT,
  sub_price INTEGER,
  sub_days INTEGER,
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
    COALESCE(i.image_url, i.thumbnail_url) AS image_url,
    i.title,
    i.headline,
    i.bio,
    i.careers,
    COUNT(b.id) AS post_count,
    (SELECT COUNT(DISTINCT p.user_id) FROM purchases p
      WHERE p.board_instructor_id = i.id
        AND (p.expires_at IS NULL OR p.expires_at > now())) AS subscriber_count,
    NULLIF(i.newsletter_price, 0) AS sub_price,
    NULLIF(i.newsletter_days, 0) AS sub_days,
    EXISTS (SELECT 1 FROM purchases p
      WHERE p.user_id = auth.uid()
        AND p.board_instructor_id = i.id
        AND (p.expires_at IS NULL OR p.expires_at > now())) AS is_subscribed
  FROM instructors i
  JOIN board_posts b ON b.instructor_id = i.id AND b.is_listed AND b.is_published
  GROUP BY i.id
  ORDER BY MIN(i.sort_order), i.name;
$$;

GRANT EXECUTE ON FUNCTION get_board_instructors() TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
