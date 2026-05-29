-- 관리자 전용 숨김 게시판 (board)
-- 의도: 목록/내부는 관리자(role='admin')만 접근. 개별 글은 추측 불가능한 share_token 으로
--       링크를 공유하면 누구나(비로그인 anon 포함) 단건 열람 가능.
-- 보안: board_posts 직접 SELECT 는 관리자만 허용 → 일반 회원/비로그인은 테이블을 통째로 덤프할 수 없고
--       게시판 존재 자체가 노출되지 않음. 공유 열람은 SECURITY DEFINER RPC 로 토큰 일치 단건만 반환.

CREATE TABLE IF NOT EXISTS board_posts (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',                                       -- 리치텍스트(HTML)
  -- 공유 링크용 비공개 토큰. 추측 불가능한 랜덤값(32 hex). 재발급 시 기존 링크가 즉시 무효화됨.
  share_token TEXT NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  -- 공유 링크 활성화 여부. false 면 링크로 접근해도 글이 보이지 않음(링크 비활성화).
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS board_posts_share_token_idx ON board_posts (share_token);
CREATE INDEX IF NOT EXISTS board_posts_created_at_idx ON board_posts (created_at DESC);

ALTER TABLE board_posts ENABLE ROW LEVEL SECURITY;

-- 관리자만 직접 테이블 접근(목록 조회/작성/수정/삭제). anon/일반 회원은 직접 SELECT 불가.
DROP POLICY IF EXISTS "Admin manage board_posts" ON board_posts;
CREATE POLICY "Admin manage board_posts" ON board_posts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP TRIGGER IF EXISTS set_updated_at ON board_posts;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON board_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 공유 링크 열람용: 토큰으로만 단건 조회. RLS 우회(SECURITY DEFINER).
-- is_published = true 인 글만 반환 → 관리자가 토글로 링크를 비활성화할 수 있다.
CREATE OR REPLACE FUNCTION get_board_post_by_token(p_token TEXT)
RETURNS TABLE (
  id BIGINT,
  title TEXT,
  content TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT b.id, b.title, b.content, b.created_at, b.updated_at
  FROM board_posts b
  WHERE b.share_token = p_token AND b.is_published = TRUE
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION get_board_post_by_token(TEXT) TO anon, authenticated;
