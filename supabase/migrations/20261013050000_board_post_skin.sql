-- 게시판 글별 화면 설정 (2026-10-13)
--   skin        : 'default'(기존 화면) | 'blog'(네이버 블로그형 화면) — 글마다 선택
--   hide_chrome : 이 글 화면에서 사이트 헤더·푸터·상담 버튼 숨김 (시크릿 페이지처럼)
--   blog_meta   : 블로그형 화면에 보일 블로그 이름·닉네임·프로필 사진·소개·카테고리 (비우면 강사 정보)
-- get_board_post_public 은 반환 컬럼이 늘어 DROP 후 재생성 — 로직은 20260811100000 그대로.

ALTER TABLE board_posts
  ADD COLUMN IF NOT EXISTS skin TEXT NOT NULL DEFAULT 'default' CHECK (skin IN ('default', 'blog')),
  ADD COLUMN IF NOT EXISTS hide_chrome BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS blog_meta JSONB NOT NULL DEFAULT '{}'::jsonb;

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
  sub_days INTEGER,     -- 구버전 호환 (= sub_months * 30)
  sub_months INTEGER,   -- 구독 주기(개월)
  is_purchased BOOLEAN,
  is_subscribed BOOLEAN,
  is_locked BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  skin TEXT,            -- default | blog
  hide_chrome BOOLEAN,  -- 사이트 헤더·푸터 숨김
  blog_meta JSONB       -- 블로그형 화면 표시 정보(블로그 이름·닉네임·프로필 사진·소개·카테고리)
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
  v_sub_months INTEGER;
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
    SELECT i.name, NULLIF(i.newsletter_price, 0), GREATEST(i.newsletter_months, 1)
      INTO v_instructor_name, v_sub_price, v_sub_months
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
    v_locked := v_post.cta_enabled AND auth.uid() IS NULL;
  ELSE
    v_locked := NOT v_purchased AND NOT v_subscribed
      AND NOT EXISTS (
        SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.role = 'admin'
      );
  END IF;

  v_content := v_post.content;
  IF v_locked THEN
    v_content := regexp_replace(
      left(v_post.content, GREATEST(v_post.preview_height * 8, 600)),
      '<[^>]*$', ''
    );
    -- 본문이 컷 길이보다 짧아 전문이 그대로 남으면 1/3 로 재컷 — API 전문 유출 방지
    IF length(v_content) >= length(v_post.content) THEN
      v_content := regexp_replace(
        left(v_post.content, GREATEST(length(v_post.content) / 3, 200)),
        '<[^>]*$', ''
      );
    END IF;
  END IF;

  RETURN QUERY SELECT
    v_post.id, v_post.title, v_content,
    v_post.preview_height, v_post.cta_enabled, v_post.cta_locked_text,
    v_post.cta_title, v_post.cta_subtitle, v_post.cta_button_text,
    v_post.instructor_id, v_instructor_name,
    v_post.is_paid, v_post.price, v_sub_price,
    CASE WHEN v_sub_price IS NULL THEN NULL ELSE v_sub_months * 30 END,
    CASE WHEN v_sub_price IS NULL THEN NULL ELSE v_sub_months END,
    v_purchased, v_subscribed, v_locked,
    v_post.created_at, v_post.updated_at,
    v_post.skin, v_post.hide_chrome, v_post.blog_meta;
END;
$$;

GRANT EXECUTE ON FUNCTION get_board_post_public(TEXT, BIGINT) TO anon, authenticated;
