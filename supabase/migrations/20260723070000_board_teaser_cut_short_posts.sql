-- 짧은 유료 글의 본문 유출 보완 — 기존 컷(preview_height * 8, 최소 600자)보다 본문이
-- 짧으면 잘라도 전문이 그대로 반환되어, 화면에서는 가려져도 API 응답에는 전체 내용이
-- 담기는 문제가 있었다. 컷 결과가 원문 전체와 같으면 본문의 1/3(최소 200자)만 반환한다.
-- (get_board_post_public 본문만 교체 — 반환 타입 동일)

CREATE OR REPLACE FUNCTION get_board_post_public(p_token TEXT DEFAULT NULL, p_id BIGINT DEFAULT NULL)
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
    v_post.is_paid, v_post.price, v_sub_price, v_sub_days,
    v_purchased, v_subscribed, v_locked,
    v_post.created_at, v_post.updated_at;
END;
$$;

GRANT EXECUTE ON FUNCTION get_board_post_public(TEXT, BIGINT) TO anon, authenticated;
