-- ============================================
-- 아마겟돈 클래스 Supabase DB 스키마
-- Supabase SQL Editor에서 실행
-- ============================================

-- 1. profiles (사용자 프로필)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  phone TEXT,
  birth_date DATE,
  gender TEXT CHECK (gender IN ('male', 'female')),
  address TEXT,
  points INTEGER DEFAULT 0,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. instructors (강사)
CREATE TABLE instructors (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  headline TEXT,
  bio TEXT,
  bio_bullets TEXT[],
  careers TEXT[],
  image_url TEXT,
  thumbnail_url TEXT,
  has_active_course BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. courses (강의)
CREATE TABLE courses (
  id SERIAL PRIMARY KEY,
  instructor_id INTEGER REFERENCES instructors(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  video_url TEXT,
  landing_image_url TEXT,
  original_price INTEGER,
  sale_price INTEGER,
  course_type TEXT NOT NULL CHECK (course_type IN ('free', 'premium')),
  enrollment_deadline TIMESTAMPTZ,
  duration_days INTEGER DEFAULT 30,
  is_published BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. curriculum_items (커리큘럼)
CREATE TABLE curriculum_items (
  id SERIAL PRIMARY KEY,
  course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
  week INTEGER,
  label TEXT NOT NULL,
  video_url TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. ebooks (전자책)
CREATE TABLE ebooks (
  id SERIAL PRIMARY KEY,
  instructor_id INTEGER REFERENCES instructors(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  thumbnail_url TEXT,
  file_url TEXT,
  original_price INTEGER,
  sale_price INTEGER,
  is_free BOOLEAN DEFAULT false,
  is_hot BOOLEAN DEFAULT false,
  is_published BOOLEAN DEFAULT true,
  duration_days INTEGER DEFAULT 30,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. reviews (수강 후기)
CREATE TABLE reviews (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  course_id INTEGER REFERENCES courses(id) ON DELETE SET NULL,
  instructor_id INTEGER REFERENCES instructors(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. results (성과)
CREATE TABLE results (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL,
  title TEXT NOT NULL,
  preview TEXT,
  content TEXT NOT NULL,
  image_url TEXT,
  likes_count INTEGER DEFAULT 0,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. schedules (강의 일정)
CREATE TABLE schedules (
  id SERIAL PRIMARY KEY,
  course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
  instructor_id INTEGER REFERENCES instructors(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. faqs (자주 묻는 질문)
CREATE TABLE faqs (
  id SERIAL PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  video_url TEXT,
  file_url TEXT,
  file_name TEXT,
  sort_order INTEGER DEFAULT 0,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 10. purchases (구매 내역)
CREATE TABLE purchases (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  course_id INTEGER REFERENCES courses(id) ON DELETE SET NULL,
  ebook_id INTEGER REFERENCES ebooks(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  price INTEGER NOT NULL,
  purchased_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ
);

-- 11. banners (배너)
CREATE TABLE banners (
  id SERIAL PRIMARY KEY,
  page_key TEXT NOT NULL,
  image_url TEXT NOT NULL,
  link_url TEXT,
  sort_order INTEGER DEFAULT 0,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 트리거: 새 사용자 가입 시 profiles 자동 생성
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, gender, phone, address, birth_date)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'gender',
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'address',
    CASE
      WHEN NEW.raw_user_meta_data->>'birth_date' IS NOT NULL
        AND NEW.raw_user_meta_data->>'birth_date' != ''
      THEN (NEW.raw_user_meta_data->>'birth_date')::DATE
      ELSE NULL
    END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- updated_at 자동 갱신 트리거
-- ============================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON instructors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON courses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON ebooks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON faqs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================
-- RLS (Row Level Security) 정책
-- ============================================

-- profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admin can view all profiles" ON profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "Admin can manage profiles" ON profiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- instructors (공개 읽기, admin 관리)
ALTER TABLE instructors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read instructors" ON instructors
  FOR SELECT USING (is_published = true);
CREATE POLICY "Admin read all instructors" ON instructors
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "Admin manage instructors" ON instructors
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- courses
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read courses" ON courses
  FOR SELECT USING (is_published = true);
CREATE POLICY "Admin read all courses" ON courses
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "Admin manage courses" ON courses
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- curriculum_items
ALTER TABLE curriculum_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read curriculum" ON curriculum_items
  FOR SELECT USING (true);
CREATE POLICY "Admin manage curriculum" ON curriculum_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ebooks
ALTER TABLE ebooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read ebooks" ON ebooks
  FOR SELECT USING (is_published = true);
CREATE POLICY "Admin read all ebooks" ON ebooks
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "Admin manage ebooks" ON ebooks
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- reviews
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read reviews" ON reviews
  FOR SELECT USING (is_published = true);
CREATE POLICY "Users can create reviews" ON reviews
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own reviews" ON reviews
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own reviews" ON reviews
  FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admin manage reviews" ON reviews
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- results
ALTER TABLE results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read results" ON results
  FOR SELECT USING (is_published = true);
CREATE POLICY "Users can create results" ON results
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own results" ON results
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own results" ON results
  FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admin manage results" ON results
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- schedules
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read schedules" ON schedules
  FOR SELECT USING (true);
CREATE POLICY "Admin manage schedules" ON schedules
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- faqs
ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read faqs" ON faqs
  FOR SELECT USING (is_published = true);
CREATE POLICY "Admin read all faqs" ON faqs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "Admin manage faqs" ON faqs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- purchases
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own purchases" ON purchases
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admin manage purchases" ON purchases
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- banners
ALTER TABLE banners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read banners" ON banners
  FOR SELECT USING (is_published = true);
CREATE POLICY "Admin manage banners" ON banners
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 12. course_progress (학습 진도)
CREATE TABLE course_progress (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  curriculum_item_id INTEGER NOT NULL REFERENCES curriculum_items(id) ON DELETE CASCADE,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  last_watched_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, curriculum_item_id)
);

ALTER TABLE course_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own progress" ON course_progress
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Admin can view all progress" ON course_progress
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE INDEX idx_progress_user_course ON course_progress(user_id, course_id);

-- 13. point_logs (포인트 충전/차감 내역)
CREATE TABLE point_logs (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  balance INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('charge', 'deduct', 'use', 'refund')),
  memo TEXT,
  admin_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE point_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own point logs" ON point_logs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admin manage point logs" ON point_logs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE INDEX idx_point_logs_user ON point_logs(user_id);

-- ============================================
-- 인덱스
-- ============================================
CREATE INDEX idx_courses_type ON courses(course_type);
CREATE INDEX idx_courses_instructor ON courses(instructor_id);
CREATE INDEX idx_ebooks_instructor ON ebooks(instructor_id);
CREATE INDEX idx_reviews_course ON reviews(course_id);
CREATE INDEX idx_reviews_instructor ON reviews(instructor_id);
CREATE INDEX idx_results_user ON results(user_id);
CREATE INDEX idx_schedules_date ON schedules(scheduled_at);
CREATE INDEX idx_purchases_user ON purchases(user_id);
CREATE INDEX idx_banners_page ON banners(page_key);
