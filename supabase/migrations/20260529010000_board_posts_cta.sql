-- 게시판 공유 페이지: 티저(미리보기 + 가입 유도 CTA) 기능
-- 공유 링크로 들어온 (비로그인) 사람에게 본문 일부(preview_height px)만 보여주고, 아래에 안내문 + 가입 유도
-- 제목/부제 + 로그인 버튼을 노출한다. cta_enabled 가 false 면 본문 전체를 그대로 보여준다(기존 동작).
-- 버튼은 항상 사이트 로그인(/login)으로 연결되므로 별도 URL 컬럼은 두지 않는다.

ALTER TABLE board_posts
  ADD COLUMN IF NOT EXISTS preview_height INT NOT NULL DEFAULT 450,                       -- 본문 미리보기 높이(px)
  ADD COLUMN IF NOT EXISTS cta_enabled BOOLEAN NOT NULL DEFAULT TRUE,                      -- 티저 모드 on/off
  ADD COLUMN IF NOT EXISTS cta_locked_text TEXT NOT NULL DEFAULT '멤버에게만 공개된 게시글입니다.',  -- 본문 아래 안내문
  ADD COLUMN IF NOT EXISTS cta_title TEXT NOT NULL DEFAULT '',                             -- 가입 유도 제목(HTML)
  ADD COLUMN IF NOT EXISTS cta_subtitle TEXT NOT NULL DEFAULT '',                          -- 부제목(평문)
  ADD COLUMN IF NOT EXISTS cta_button_text TEXT NOT NULL DEFAULT '';                       -- 버튼 라벨(링크는 /login 고정)

-- 공유 RPC 반환 컬럼 확장. 반환 타입(RETURNS TABLE)이 바뀌므로 DROP 후 재생성해야 한다.
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
  SELECT b.id, b.title, b.content, b.preview_height, b.cta_enabled,
         b.cta_locked_text, b.cta_title, b.cta_subtitle, b.cta_button_text,
         b.created_at, b.updated_at
  FROM board_posts b
  WHERE b.share_token = p_token AND b.is_published = TRUE
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION get_board_post_by_token(TEXT) TO anon, authenticated;
