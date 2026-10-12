-- 유료 콘텐츠 주소 보호 (2026-10-12)
-- 문제: curriculum_items.video_url/video_urls(강의 영상)와 ebooks.file_url(PDF)을 비로그인 누구나 조회 가능.
-- 해결: 두 컬럼을 공개 조회에서 빼고, 구매자(만료 전)·관리자에게만 서버 함수로 내려준다.

-- ── 1단계: 새 코드가 쓰는 함수·컬럼 (코드 배포 전에 실행) ──────────────────────────

-- 파일 주소 대신 "파일이 있는지"만 공개 (내 강의실의 'PDF 준비중' 표시용)
alter table public.ebooks
  add column if not exists has_file boolean generated always as (coalesce(file_url, '') <> '') stored;

-- 강의 영상 주소: 관리자 또는 해당 강의를 (만료 전) 구매한 회원만
create or replace function public.get_curriculum_videos(p_course_ids bigint[])
returns table (id bigint, course_id bigint, video_url text, video_urls jsonb)
language sql
stable
security definer
set search_path = public
as $$
  select ci.id::bigint, ci.course_id::bigint, ci.video_url::text, to_jsonb(ci.video_urls)
  from curriculum_items ci
  where ci.course_id = any(p_course_ids)
    and (
      (select is_admin())
      or exists (
        select 1 from purchases p
        where p.user_id = auth.uid()
          and p.course_id = ci.course_id
          and (p.expires_at is null or p.expires_at > now())
      )
    )
$$;

revoke all on function public.get_curriculum_videos(bigint[]) from public, anon;
grant execute on function public.get_curriculum_videos(bigint[]) to authenticated;

-- 전자책 PDF 주소: 관리자 또는 해당 전자책을 (만료 전) 구매한 회원만. 권한 없으면 null
create or replace function public.get_ebook_file_url(p_ebook_id bigint)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select e.file_url
  from ebooks e
  where e.id = p_ebook_id
    and (
      (select is_admin())
      or exists (
        select 1 from purchases p
        where p.user_id = auth.uid()
          and p.ebook_id = e.id
          and (p.expires_at is null or p.expires_at > now())
      )
    )
$$;

revoke all on function public.get_ebook_file_url(bigint) from public, anon;
grant execute on function public.get_ebook_file_url(bigint) to authenticated;

-- ── 2단계: 코드 배포 확인 후 실행 — 주소 컬럼을 공개 조회에서 제외 ───────────────────
-- (INSERT/UPDATE/DELETE 권한은 그대로라 관리자 편집·저장은 영향 없음)

revoke select on public.curriculum_items from anon, authenticated;
grant select (id, course_id, week, label, description, is_redirect, sort_order, created_at)
  on public.curriculum_items to anon, authenticated;

revoke select on public.ebooks from anon, authenticated;
grant select (id, instructor_id, title, thumbnail_url, original_price, sale_price, is_free, is_hot,
  is_published, duration_days, sort_order, created_at, updated_at, landing_image_url, is_on_sale,
  search_keywords, strengths, features, seo, reward_points, max_purchases, discount_start, discount_end,
  related_ebook_ids, open_date, close_date, refund_policy, default_webhooks_seeded, landing_image_urls,
  landing_image_links, has_file)
  on public.ebooks to anon, authenticated;
