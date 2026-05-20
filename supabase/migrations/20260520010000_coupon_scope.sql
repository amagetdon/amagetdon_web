-- 쿠폰을 전체 / 강의 전체 또는 특정 강의 / 전자책 전체 또는 특정 전자책 으로 제한.
-- applies_to='all' → 모두 적용, 'course' → 강의만 (course_id 있으면 그 강의에만), 'ebook' → 전자책만 (ebook_id 있으면 그 전자책에만).
ALTER TABLE coupons
  ADD COLUMN IF NOT EXISTS applies_to TEXT NOT NULL DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS course_id INTEGER REFERENCES courses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ebook_id INTEGER REFERENCES ebooks(id) ON DELETE SET NULL;

ALTER TABLE coupons
  DROP CONSTRAINT IF EXISTS coupons_applies_to_check;
ALTER TABLE coupons
  ADD CONSTRAINT coupons_applies_to_check CHECK (applies_to IN ('all', 'course', 'ebook'));
