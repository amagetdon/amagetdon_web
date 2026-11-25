-- 인터뷰 채널 영상 지표 — 강의(주로 무료 강의) 통합 대시보드 탭의 '인터뷰 채널' 영역.
-- 관리자가 유튜브 영상 링크와 그 영상 설명란에 넣은 신청 링크(UTM)를 등록하면,
--  - 조회수·댓글 수·좋아요는 edge function youtube-video-stats 가 YouTube Data API 로 채운다.
--  - 신청 수는 대시보드 화면이 get_product_dashboard 결과(매체×캠페인×소재×세트)에서 이 UTM 과 맞는 줄을 더한다.
-- 되돌리기: supabase/diagnostics/20261125_interview_videos_rollback.sql

create table if not exists public.product_interview_videos (
  id bigserial primary key,
  kind text not null check (kind in ('course', 'ebook')),
  product_id integer not null,
  video_url text not null,
  video_id text not null,
  -- 영상 설명란의 신청 링크 원문과, 거기서 뽑은 UTM 값 (빈 값 = 따지지 않음)
  utm_link text,
  utm_source text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  memo text,
  -- 유튜브에서 받아 온 값
  title text,
  channel_title text,
  thumbnail text,
  published_at timestamptz,
  view_count bigint,
  comment_count bigint,
  like_count bigint,
  stats_updated_at timestamptz,
  stats_error text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create index if not exists product_interview_videos_product_idx on public.product_interview_videos (kind, product_id);

alter table public.product_interview_videos enable row level security;
drop policy if exists "admin all product_interview_videos" on public.product_interview_videos;
create policy "admin all product_interview_videos" on public.product_interview_videos for all
  using ((select is_admin())) with check ((select is_admin()));

grant select, insert, update, delete on public.product_interview_videos to authenticated;
grant usage, select on sequence public.product_interview_videos_id_seq to authenticated;

notify pgrst, 'reload schema';
