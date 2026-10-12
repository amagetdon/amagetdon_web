-- 구매 1건마다 '이번 구매 경로'(last touch) 기록 — 가입 시점 경로(profiles.utm_*)와 별도로 재구매 경로 분석용.
-- purchase_touch: {source, medium, campaign, content, term, referrer, landing, at} (클라이언트 localStorage 마지막 경로, 30일)

ALTER TABLE purchases ADD COLUMN IF NOT EXISTS purchase_touch JSONB;

-- 본인 구매 행, 최근 1일 이내, 비어 있을 때만 1회 기록 (일반 유저는 purchases UPDATE 권한이 없어 SECURITY DEFINER)
CREATE OR REPLACE FUNCTION set_purchase_touch(p_kind TEXT, p_id INTEGER, p_touch JSONB)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR p_kind NOT IN ('course', 'ebook') OR p_touch IS NULL
     OR jsonb_typeof(p_touch) <> 'object' OR length(p_touch::text) > 2000 THEN
    RETURN;
  END IF;
  UPDATE purchases
  SET purchase_touch = p_touch
  WHERE user_id = auth.uid()
    AND ((p_kind = 'course' AND course_id = p_id) OR (p_kind = 'ebook' AND ebook_id = p_id))
    AND purchase_touch IS NULL
    AND purchased_at > now() - interval '1 day';
END;
$$;

REVOKE ALL ON FUNCTION set_purchase_touch(TEXT, INTEGER, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_purchase_touch(TEXT, INTEGER, JSONB) TO authenticated;
