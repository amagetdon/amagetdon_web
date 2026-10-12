-- 오픈채팅(구매 직후 안내 링크) 진입 기록 — 관리자 수강생 목록에 '오픈채팅' 열로 표시
-- openchat_opened_at : 링크가 처음 열린 시각 (자동 오픈 포함)
-- openchat_clicked_at: 수강생이 직접 버튼을 처음 누른 시각 ('지금 열기' / 상세 '채팅방 이동하기')
-- 둘 다 최초 1회만 기록. 카톡 채팅방 실제 참여 여부는 카카오 쪽이라 알 수 없음(링크 진입까지만).

ALTER TABLE purchases ADD COLUMN IF NOT EXISTS openchat_opened_at TIMESTAMPTZ;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS openchat_clicked_at TIMESTAMPTZ;

-- 본인 구매 행만, 비어 있는 컬럼만 채움. purchases 는 일반 유저 UPDATE 권한이 없으므로 SECURITY DEFINER RPC 로 처리.
CREATE OR REPLACE FUNCTION mark_openchat_open(p_kind TEXT, p_id INTEGER, p_manual BOOLEAN DEFAULT false)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR p_kind NOT IN ('course', 'ebook') THEN
    RETURN;
  END IF;
  UPDATE purchases
  SET openchat_opened_at = COALESCE(openchat_opened_at, now()),
      openchat_clicked_at = CASE WHEN p_manual THEN COALESCE(openchat_clicked_at, now()) ELSE openchat_clicked_at END
  WHERE user_id = auth.uid()
    AND ((p_kind = 'course' AND course_id = p_id) OR (p_kind = 'ebook' AND ebook_id = p_id))
    AND (openchat_opened_at IS NULL OR (p_manual AND openchat_clicked_at IS NULL));
END;
$$;

REVOKE ALL ON FUNCTION mark_openchat_open(TEXT, INTEGER, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mark_openchat_open(TEXT, INTEGER, BOOLEAN) TO authenticated;
