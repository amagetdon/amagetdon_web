-- 뉴스레터 구독 기간을 일(日) → 달력 월(月) 단위로 전환
--   "30일 주기"는 31일/28일 달에서 결제일이 매달 조금씩 밀린다.
--   달력 월 기준(8/11 가입 → 9/11 → 10/11 갱신, 월말은 클램프: 1/31 → 2/28)으로 바꾼다.
--   1) instructors.newsletter_months(개월, 기본 1) 신설 — 기존 일 데이터는 30일=1개월로 반올림 변환.
--      newsletter_days 는 구버전(캐시된 클라이언트·미배포 함수) 호환용으로 남기고
--      관리자 폼이 months*30 으로 동기화한다. 신규 로직은 newsletter_months 만 사용.
--   2) newsletter_subscriptions.period_months 신설 (period_days 동일 취지로 유지).
--   3) RPC(get_board_post_public / get_board_instructors)에 sub_months 컬럼 추가.
--      sub_days 는 months*30 계산값으로 유지 — 구버전 클라이언트 라벨("30일=월")이 그대로 동작.
--   실제 만료일 계산(월 더하기, KST 기준·월말 클램프)은 엣지 함수/클라이언트 JS 에서 수행.

ALTER TABLE instructors
  ADD COLUMN IF NOT EXISTS newsletter_months INTEGER NOT NULL DEFAULT 1;

-- 기존 일 단위 상품 변환 (30일=1개월, 60일=2개월 … 반올림, 최소 1개월)
UPDATE instructors
  SET newsletter_months = GREATEST(1, ROUND(newsletter_days / 30.0)::int)
  WHERE newsletter_days IS NOT NULL AND newsletter_days > 0;

ALTER TABLE newsletter_subscriptions
  ADD COLUMN IF NOT EXISTS period_months INTEGER NOT NULL DEFAULT 1;

UPDATE newsletter_subscriptions
  SET period_months = GREATEST(1, ROUND(period_days / 30.0)::int)
  WHERE period_days IS NOT NULL AND period_days > 0;

GRANT SELECT (period_months) ON newsletter_subscriptions TO authenticated;

-- ───────────────────── 단건 공개 조회 (sub_months 추가) ─────────────────────
-- 반환 컬럼이 늘어나므로 DROP 후 재생성. 로직은 20260723070000(짧은 글 재컷) 최신본 기준.
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
    v_post.created_at, v_post.updated_at;
END;
$$;

GRANT EXECUTE ON FUNCTION get_board_post_public(TEXT, BIGINT) TO anon, authenticated;

-- 구 클라이언트 호환 래퍼 재생성 (get_board_post_public 재생성으로 함께 DROP 되었을 수 있음)
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

-- ───────────────────── 강사 카드/히어로 (sub_months 추가) ─────────────────────
-- 로직은 20260723060000(구독자 수 기본값 합산) 최신본 기준.
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
  sub_days INTEGER,     -- 구버전 호환 (= sub_months * 30)
  sub_months INTEGER,   -- 구독 주기(개월)
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
    GREATEST(i.newsletter_subscribers_base, 0)
      + (SELECT COUNT(DISTINCT p.user_id) FROM purchases p
          WHERE p.board_instructor_id = i.id
            AND (p.expires_at IS NULL OR p.expires_at > now())) AS subscriber_count,
    NULLIF(i.newsletter_price, 0) AS sub_price,
    CASE WHEN NULLIF(i.newsletter_price, 0) IS NULL THEN NULL
         ELSE GREATEST(i.newsletter_months, 1) * 30 END AS sub_days,
    CASE WHEN NULLIF(i.newsletter_price, 0) IS NULL THEN NULL
         ELSE GREATEST(i.newsletter_months, 1) END AS sub_months,
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
