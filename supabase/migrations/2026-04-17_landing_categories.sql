-- 랜딩 카테고리 테이블
CREATE TABLE IF NOT EXISTS landing_categories (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  is_published BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  seo JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_landing_categories_slug ON landing_categories(slug);
CREATE INDEX IF NOT EXISTS idx_landing_categories_published ON landing_categories(is_published, sort_order);

ALTER TABLE landing_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read published landing categories" ON landing_categories
  FOR SELECT USING (is_published = true);

CREATE POLICY "Admin read all landing categories" ON landing_categories
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admin manage landing categories" ON landing_categories
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- courses 테이블에 landing_category_id 추가
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS landing_category_id INTEGER REFERENCES landing_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_courses_landing_category ON courses(landing_category_id);
