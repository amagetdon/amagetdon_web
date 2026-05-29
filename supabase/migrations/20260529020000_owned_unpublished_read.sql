-- 수기 부여(또는 구매)한 강의·전자책이 미공개(is_published=false)면
-- 일반 회원 RLS('Public read ...' = is_published=true)에 막혀
-- 내 강의실의 course/ebook 조인이 null 이 되어 "진행 중 (1)" 카운트만 뜨고
-- 정작 카드는 안 보이던 문제 수정.
--
-- 본인이 purchases row 를 가진 강의/전자책은 공개 여부와 무관하게 SELECT 허용.
-- (다중 permissive SELECT 정책은 OR 로 합쳐지므로 기존 공개 정책은 그대로 유지)

DROP POLICY IF EXISTS "Users can read purchased courses" ON courses;
CREATE POLICY "Users can read purchased courses" ON courses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM purchases
      WHERE purchases.course_id = courses.id
        AND purchases.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can read purchased ebooks" ON ebooks;
CREATE POLICY "Users can read purchased ebooks" ON ebooks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM purchases
      WHERE purchases.ebook_id = ebooks.id
        AND purchases.user_id = auth.uid()
    )
  );
