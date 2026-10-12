-- 광고 매체 픽셀 관리 (관리자 > 픽셀 관리)
-- 매체별 픽셀/태그 ID + 사용 ON/OFF + 이벤트별 전송 ON/OFF + 적용 범위(운영/미리보기) + 변경 이력.
-- 수정은 최고관리자(super_admins)만, 읽기는 사이트 전체(픽셀 ID 는 원래 페이지 소스에 공개되는 값).

-- 1) 최고관리자 — profiles 와 분리(회원이 자기 프로필을 수정해도 바뀌지 않도록 쓰기 정책 없음, SQL 로만 관리)
CREATE TABLE IF NOT EXISTS super_admins (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Self read super_admins" ON super_admins;
CREATE POLICY "Self read super_admins" ON super_admins FOR SELECT USING (user_id = (SELECT auth.uid()));

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid());
$$;
GRANT EXECUTE ON FUNCTION is_super_admin() TO authenticated;

INSERT INTO super_admins (user_id)
SELECT id FROM profiles WHERE email = 'hsju0521@min-company.co.kr'
ON CONFLICT DO NOTHING;

-- 2) 매체 픽셀 (매체당 여러 행 가능 = 같은 매체 ID 여러 개)
CREATE TABLE IF NOT EXISTS ad_pixels (
  id BIGSERIAL PRIMARY KEY,
  media TEXT NOT NULL CHECK (media IN ('meta', 'gtm', 'ga4', 'google_ads', 'kakao', 'tiktok', 'naver', 'karrot', 'dable', 'taboola')),
  enabled BOOLEAN NOT NULL DEFAULT false,
  scope TEXT NOT NULL DEFAULT 'all' CHECK (scope IN ('all', 'preview')),
  pixel_id TEXT NOT NULL DEFAULT '',
  -- 이벤트별 전송 여부 {PageView: true, Purchase: false, ...}
  events JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- 매체별 추가 값 (Google Ads 이벤트별 라벨, Taboola 이벤트명 등)
  extra JSONB NOT NULL DEFAULT '{}'::jsonb,
  memo TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);
ALTER TABLE ad_pixels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read ad_pixels" ON ad_pixels;
CREATE POLICY "Public read ad_pixels" ON ad_pixels FOR SELECT USING (true);
DROP POLICY IF EXISTS "Super admin write ad_pixels" ON ad_pixels;
CREATE POLICY "Super admin write ad_pixels" ON ad_pixels FOR ALL
  USING ((SELECT is_super_admin())) WITH CHECK ((SELECT is_super_admin()));

-- 3) 변경 이력 (트리거로 자동 기록 — 누가/언제/무엇을)
CREATE TABLE IF NOT EXISTS ad_pixel_logs (
  id BIGSERIAL PRIMARY KEY,
  pixel_id BIGINT,
  media TEXT,
  action TEXT NOT NULL,
  before JSONB,
  after JSONB,
  changed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE ad_pixel_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin read ad_pixel_logs" ON ad_pixel_logs;
CREATE POLICY "Admin read ad_pixel_logs" ON ad_pixel_logs FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = (SELECT auth.uid()) AND pr.role = 'admin'));

CREATE OR REPLACE FUNCTION log_ad_pixel_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.updated_at := now();
    NEW.updated_by := auth.uid();
    INSERT INTO ad_pixel_logs (pixel_id, media, action, before, after, changed_by)
    VALUES (NEW.id, NEW.media, 'update', to_jsonb(OLD) - 'updated_at' - 'updated_by', to_jsonb(NEW) - 'updated_at' - 'updated_by', auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    NEW.updated_by := auth.uid();
    RETURN NEW;
  ELSE
    INSERT INTO ad_pixel_logs (pixel_id, media, action, before, changed_by)
    VALUES (OLD.id, OLD.media, 'delete', to_jsonb(OLD), auth.uid());
    RETURN OLD;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION log_ad_pixel_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO ad_pixel_logs (pixel_id, media, action, after, changed_by)
  VALUES (NEW.id, NEW.media, 'insert', to_jsonb(NEW), auth.uid());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ad_pixels_before_change ON ad_pixels;
CREATE TRIGGER ad_pixels_before_change BEFORE INSERT OR UPDATE OR DELETE ON ad_pixels
  FOR EACH ROW EXECUTE FUNCTION log_ad_pixel_change();
DROP TRIGGER IF EXISTS ad_pixels_after_insert ON ad_pixels;
CREATE TRIGGER ad_pixels_after_insert AFTER INSERT ON ad_pixels
  FOR EACH ROW EXECUTE FUNCTION log_ad_pixel_insert();

-- 4) 기존 설정 이전 — 외부 서비스(site_settings.external_services)의 GTM / GA4 / 메타 픽셀 / 네이버 전환추적을 그대로 옮김.
--    배포 후 이 4개는 '외부 서비스 설정'에서 사라지고 '픽셀 관리'에서만 관리됨(중복 주입 방지).
--    GTM 안에 있던 카카오 픽셀·Google Ads 는 OFF 로 미리 등록(켜기 전 GTM 태그 일시중지 필요).
DO $$
DECLARE
  v JSONB;
  all_events JSONB := '{"PageView":true,"ViewContent":true,"Lead":true,"OpenChatJoin":true,"CompleteRegistration":true,"InitiateCheckout":true,"Purchase":true}';
BEGIN
  IF EXISTS (SELECT 1 FROM ad_pixels) THEN
    RETURN; -- 재실행 시 중복 이전 방지
  END IF;
  SELECT value INTO v FROM site_settings WHERE key = 'external_services';
  v := COALESCE(v, '{}'::jsonb);

  INSERT INTO ad_pixels (media, enabled, pixel_id, events, sort_order) VALUES
    ('meta', COALESCE((v->'META_PIXEL'->>'enabled')::boolean, false), COALESCE(v->'META_PIXEL'->>'code', ''), all_events, 10),
    ('gtm', COALESCE((v->'GOOGLE_TAG_MANAGER'->>'enabled')::boolean, false), COALESCE(v->'GOOGLE_TAG_MANAGER'->>'code', ''), '{}'::jsonb, 20),
    ('ga4', COALESCE((v->'GOOGLE_ANALYTICS'->>'enabled')::boolean, false), COALESCE(v->'GOOGLE_ANALYTICS'->>'code', ''), '{}'::jsonb, 30),
    ('naver', COALESCE((v->'NAVER_CTS'->>'enabled')::boolean, false), COALESCE(v->'NAVER_CTS'->>'code', ''), all_events, 40),
    ('kakao', false, '9067528210878320202',
      '{"PageView":true,"ViewContent":true,"Lead":true,"CompleteRegistration":true,"Purchase":true}', 50),
    ('google_ads', false, 'AW-18225668205',
      '{"PageView":true,"Lead":true}', 60);
  UPDATE ad_pixels SET extra = '{"labels":{"Lead":"qfNmCPXek7wcEO3A1vJD"}}'::jsonb WHERE media = 'google_ads';
  UPDATE ad_pixels SET memo = 'GTM 컨테이너에서 이전 — 켜기 전에 GTM의 카카오 태그 5개를 일시중지하세요' WHERE media = 'kakao';
  UPDATE ad_pixels SET memo = 'GTM 컨테이너에서 이전 — 켜기 전에 GTM의 Google Ads 태그(기본·전환)를 일시중지하세요' WHERE media = 'google_ads';
END $$;
