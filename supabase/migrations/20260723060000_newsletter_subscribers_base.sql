-- 뉴스레터 구독자 수 표시 보정 — 표시 구독자 수 = 기본값(base) + 실제 유효 구독자 수.
-- 강의 신청자 수(applicants_initial)와 같은 취지의 운영 장치로, 실제 구독이 늘면
-- 표시 수치도 그대로 함께 늘어난다. 기본값은 강사 관리에서 설정.

ALTER TABLE instructors
  ADD COLUMN IF NOT EXISTS newsletter_subscribers_base INTEGER NOT NULL DEFAULT 0;

-- subscriber_count 에 기본값을 합산해 반환 (반환 타입 동일 — 본문만 교체)
CREATE OR REPLACE FUNCTION get_board_instructors()
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
    GREATEST(i.newsletter_subscribers_base, 0)
      + (SELECT COUNT(DISTINCT p.user_id) FROM purchases p
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
