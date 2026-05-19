-- 후기에 작성자 연락처(이메일/전화) 보관용 컬럼. 저장 시 마스킹된 값만 들어간다.
-- 엑셀 일괄 업로드 및 일반 후기 작성 모두 마스킹 후 기록.

ALTER TABLE reviews ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS phone TEXT;
