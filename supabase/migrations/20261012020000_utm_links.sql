-- UTM 링크 보관함 — 관리자 'UTM 링크 생성'에서 만든 링크를 강사·강의/전자책·활용 메모와 함께 저장(관리자 전원 공유).
-- 기존에는 브라우저 localStorage(최대 20개)에만 저장돼 다른 PC/직원과 공유되지 않았음.

CREATE TABLE IF NOT EXISTS utm_links (
  id BIGSERIAL PRIMARY KEY,
  url TEXT NOT NULL,
  landing_path TEXT NOT NULL,
  utm_source TEXT NOT NULL,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  instructor_id INTEGER REFERENCES instructors(id) ON DELETE SET NULL,
  course_id INTEGER REFERENCES courses(id) ON DELETE SET NULL,
  ebook_id INTEGER REFERENCES ebooks(id) ON DELETE SET NULL,
  memo TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS utm_links_created_idx ON utm_links (created_at DESC);
CREATE INDEX IF NOT EXISTS utm_links_campaign_idx ON utm_links (utm_campaign);

ALTER TABLE utm_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin manage utm_links" ON utm_links;
CREATE POLICY "Admin manage utm_links" ON utm_links
  FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = (SELECT auth.uid()) AND pr.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = (SELECT auth.uid()) AND pr.role = 'admin'));
