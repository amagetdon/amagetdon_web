-- 커뮤니티 '아마 돈 벌고 있을걸요?' MVP (2026-10-22, 미적용 — 대표님이 SQL Editor 에서 직접 Run)
-- 기준: 기획 10·15·16번 MVP 칸, 사용자 시안 v8, 어드민 시안 v1(2단계 표시 기능 제외)
-- 대표님 결정(10/22): 강사 계정 1개 연결 · 수강 끝난 기수도 기수 방 입장 · 수강생 글은 글자만(사진은 별도 첨부)
--                    · 전자책만 산 회원도 라운지 입장 · 신고 3건 자동 숨김 · 글 하루 5개 · 댓글 하루 30개
-- 권한 근거는 기존 구매 기록(purchases, 무료 신청 = 0원 구매). 환불로 구매 행이 지워지면 권한도 자동 회수.
-- 실명·연락처는 커뮤니티 표에 두지 않는다(글에는 닉네임만).
-- 되돌리기: supabase/diagnostics/20261022_community_rollback.sql

create extension if not exists pg_trgm with schema extensions;

-- ───────────────────────── 1. 게시판 ─────────────────────────
-- 읽기·쓰기 단계: member(로그인 회원) < buyer(무료 신청·전자책 포함 구매 1건 이상) < paid(0원 넘는 구매) / cohort(이 게시판 강의 구매자) / staff(강사·스탭·관리자만)
create table public.community_board_groups (
  id serial primary key,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.community_boards (
  id serial primary key,
  group_id int references public.community_board_groups(id) on delete set null,
  slug text not null unique check (slug ~ '^[a-z0-9-]{1,40}$'),
  name text not null,
  description text,
  icon text,
  kind text not null default 'normal' check (kind in ('normal', 'qna', 'notice')),
  read_level text not null default 'buyer' check (read_level in ('member', 'buyer', 'paid', 'cohort', 'staff')),
  write_level text not null default 'buyer' check (write_level in ('member', 'buyer', 'paid', 'cohort', 'staff')),
  course_ids int[] not null default '{}',           -- cohort 단계일 때 이 강의 구매자만
  heads text[] not null default '{}',                -- 말머리(win·fail·stop·q 등)
  allow_images boolean not null default true,
  sort_order int not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

-- ───────────────────────── 2. 회원 쪽 ─────────────────────────
create table public.community_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null check (char_length(btrim(nickname)) between 2 and 12),
  badge text check (badge in ('instructor', 'staff')),                         -- 관리자만 지정
  instructor_id int unique references public.instructors(id) on delete set null, -- 강사 계정 1개 연결(관리자만)
  grade text not null default 's' check (grade in ('s', 'r', 'm', 't')),        -- 새싹·실행러 등(표시용, 2단계에서 규칙)
  onboarded_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index community_members_nickname_uq on public.community_members (lower(btrim(nickname)));

-- 글쓰기 정지(본인·관리자만 보임)
create table public.community_sanctions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  suspended_until timestamptz not null,
  reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ───────────────────────── 3. 글·댓글·사진 ─────────────────────────
create table public.community_posts (
  id bigserial primary key,
  board_id int not null references public.community_boards(id) on delete restrict,
  author_id uuid not null references auth.users(id) on delete cascade,
  head text,                                   -- 말머리
  title text not null check (char_length(btrim(title)) between 1 and 80),
  body text not null default '' check (char_length(body) <= 5000),   -- 글자만(서식 없음)
  revenue int check (revenue is null or revenue >= 0),
  spend int check (spend is null or spend >= 0),
  verify_status text not null default 'none' check (verify_status in ('none', 'pending', 'approved', 'rejected')),
  is_hidden boolean not null default false,
  hidden_reason text,
  hidden_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz,                      -- 댓글 있으면 '삭제된 글입니다'로 자리만 남김
  comment_count int not null default 0,
  reaction_count int not null default 0,
  view_count int not null default 0,
  image_count int not null default 0,
  instructor_answered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index community_posts_board_idx on public.community_posts (board_id, created_at desc);
create index community_posts_author_idx on public.community_posts (author_id, created_at desc);
create index community_posts_created_idx on public.community_posts (created_at desc);
create index community_posts_title_trgm on public.community_posts using gin (title extensions.gin_trgm_ops);
create index community_posts_body_trgm on public.community_posts using gin (body extensions.gin_trgm_ops);

create table public.community_post_images (
  id bigserial primary key,
  post_id bigint not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  path text not null unique,                   -- 저장소 'community' 버킷 안 경로: <user_id>/<임의 이름>
  width int,
  height int,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index community_post_images_post_idx on public.community_post_images (post_id, sort_order);

create table public.community_comments (
  id bigserial primary key,
  post_id bigint not null references public.community_posts(id) on delete cascade,
  parent_id bigint references public.community_comments(id) on delete cascade,  -- 답글 1단
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  is_instructor boolean not null default false,
  is_pinned boolean not null default false,
  is_hidden boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index community_comments_post_idx on public.community_comments (post_id, created_at);
create index community_comments_author_idx on public.community_comments (author_id, created_at desc);

create table public.community_reactions (
  post_id bigint not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'like' check (kind in ('like', 'cheer', 'support', 'helpful')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id, kind)
);
create index community_reactions_user_idx on public.community_reactions (user_id, created_at desc);

create table public.community_saves (
  post_id bigint not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table public.community_reports (
  id bigserial primary key,
  target_type text not null check (target_type in ('post', 'comment')),
  target_id bigint not null,
  post_id bigint not null references public.community_posts(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (reason in ('ad', 'abuse', 'privacy', 'fake', 'etc')),
  detail text check (detail is null or char_length(detail) <= 300),
  status text not null default 'open' check (status in ('open', 'hidden', 'dismissed', 'deleted', 'restored')),
  handled_by uuid references auth.users(id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now(),
  unique (target_type, target_id, reporter_id)
);
create index community_reports_open_idx on public.community_reports (status, created_at desc);

-- 조회(회원·글·날짜당 1회) — 조회수·새 글 읽음 표시에 같이 씀
create table public.community_post_views (
  post_id bigint not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default (now() at time zone 'Asia/Seoul')::date,
  primary key (post_id, user_id, day)
);
create index community_post_views_user_idx on public.community_post_views (user_id, post_id);

-- ───────────────────────── 4. 홈·고정·운영 설정 ─────────────────────────
create table public.community_pins (
  id serial primary key,
  post_id bigint not null references public.community_posts(id) on delete cascade,
  scope text not null check (scope in ('home', 'board')),   -- 홈 전체 / 그 글의 게시판
  label text not null default 'pin' check (label in ('notice', 'must', 'pin')),  -- 공지·필독·고정
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (post_id, scope)
);

create table public.community_banners (
  id serial primary key,
  eyebrow text,
  title text not null,
  subtitle text,
  button_text text,
  link_board_id int references public.community_boards(id) on delete set null,
  link_url text check (link_url is null or link_url ~ '^(/|https://)'),
  icon text,
  color text not null default 'a' check (color in ('a', 'b', 'c')),
  sort_order int not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.community_tiles (
  id serial primary key,
  title text not null,
  subtitle text,
  icon text,
  link_board_id int references public.community_boards(id) on delete set null,
  link_url text check (link_url is null or link_url ~ '^(/|https://)'),
  highlight boolean not null default false,
  sort_order int not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.community_blocklist (
  id serial primary key,
  kind text not null check (kind in ('word', 'domain')),
  value text not null check (char_length(btrim(value)) between 1 and 100),
  created_at timestamptz not null default now(),
  unique (kind, value)
);

create table public.community_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  board_id int not null references public.community_boards(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, board_id)
);

create table public.community_board_reads (
  user_id uuid not null references auth.users(id) on delete cascade,
  board_id int not null references public.community_boards(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (user_id, board_id)
);

-- 인기 순위(정해진 간격으로 다시 계산해 둠)
create table public.community_hot (
  kind text not null check (kind in ('now', 'week')),
  rank int not null,
  post_id bigint not null references public.community_posts(id) on delete cascade,
  score numeric not null,
  computed_at timestamptz not null default now(),
  primary key (kind, rank)
);

create table public.community_notifications (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('comment', 'reply', 'instructor_answer', 'remind_instructor', 'admin')),
  post_id bigint references public.community_posts(id) on delete cascade,
  comment_id bigint references public.community_comments(id) on delete cascade,
  message text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index community_notifications_user_idx on public.community_notifications (user_id, created_at desc);

-- ───────────────────────── 5. 권한 판단 함수 ─────────────────────────
create or replace function public.community_is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select is_admin() or exists (select 1 from community_members where user_id = auth.uid() and badge in ('instructor', 'staff'));
$$;

-- 강사 계정이 이 강의들 중 하나의 강사인지
create or replace function public.community_is_course_instructor(p_course_ids int[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from community_members m join courses c on c.instructor_id = m.instructor_id
     where m.user_id = auth.uid() and m.badge = 'instructor' and c.id = any(p_course_ids));
$$;

create or replace function public.community_level_ok(p_level text, p_course_ids int[])
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then return false; end if;
  if is_admin() then return true; end if;
  if p_level = 'cohort' then
    -- 수강 기간이 끝난 기수도 입장(대표님 결정 ②) → expires_at 은 보지 않음
    return community_is_course_instructor(p_course_ids)
        or exists (select 1 from purchases where user_id = auth.uid() and course_id = any(p_course_ids));
  end if;
  if p_level = 'staff' then return community_is_staff(); end if;
  if community_is_staff() then return true; end if;
  if p_level = 'member' then return true; end if;
  if p_level = 'buyer' then  -- 무료 신청(0원)·전자책만 산 회원 포함(대표님 결정 ④)
    return exists (select 1 from purchases where user_id = auth.uid());
  end if;
  if p_level = 'paid' then
    return exists (select 1 from purchases where user_id = auth.uid() and price > 0);
  end if;
  return false;
end;
$$;

create or replace function public.community_can_read_board(p_board_id int)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from community_boards b
                  where b.id = p_board_id and (b.enabled or is_admin()) and community_level_ok(b.read_level, b.course_ids));
$$;

create or replace function public.community_can_write_board(p_board_id int)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from community_boards b
                  where b.id = p_board_id and b.enabled
                    and community_level_ok(b.read_level, b.course_ids)
                    and community_level_ok(b.write_level, b.course_ids))
     and not exists (select 1 from community_sanctions s where s.user_id = auth.uid() and s.suspended_until > now())
     and exists (select 1 from community_members m where m.user_id = auth.uid());  -- 닉네임 먼저
$$;

create or replace function public.community_can_read_post(p_post_id bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from community_posts p
                  where p.id = p_post_id
                    and community_can_read_board(p.board_id)
                    and (not p.is_hidden or p.author_id = auth.uid() or is_admin()));
$$;

-- 이 회원의 커뮤니티 단계(화면 잠금 안내용)
create or replace function public.community_my_access()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'logged_in', auth.uid() is not null,
    'buyer', exists (select 1 from purchases where user_id = auth.uid()),
    'paid', exists (select 1 from purchases where user_id = auth.uid() and price > 0),
    'staff', community_is_staff(),
    'admin', is_admin(),
    'has_nickname', exists (select 1 from community_members where user_id = auth.uid()),
    'suspended_until', (select suspended_until from community_sanctions where user_id = auth.uid() and suspended_until > now()));
$$;

grant execute on function public.community_is_staff(), public.community_is_course_instructor(int[]),
  public.community_level_ok(text, int[]), public.community_can_read_board(int), public.community_can_write_board(int),
  public.community_can_read_post(bigint), public.community_my_access() to authenticated;

-- ───────────────────────── 6. 지킴 트리거 ─────────────────────────
-- 회원 쪽: 관리자가 아니면 배지·강사 연결·등급을 못 바꿈
create or replace function public.community_members_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user in ('anon', 'authenticated') and not is_admin() then
    if tg_op = 'INSERT' then
      new.badge := null; new.instructor_id := null; new.grade := 's';
    else
      new.badge := old.badge; new.instructor_id := old.instructor_id; new.grade := old.grade; new.user_id := old.user_id;
    end if;
  end if;
  if new.badge is distinct from 'instructor' then new.instructor_id := null; end if;
  return new;
end;
$$;
create trigger community_members_guard before insert or update on public.community_members
  for each row execute function public.community_members_guard();

-- 차단 목록 검사(금칙어·링크 도메인)
create or replace function public.community_check_blocklist(p_text text)
returns void language plpgsql stable security definer set search_path = public as $$
declare v text;
begin
  select value into v from community_blocklist
   where (kind = 'word' and position(lower(value) in lower(p_text)) > 0)
      or (kind = 'domain' and lower(p_text) ~ ('(^|[^a-z0-9.-])(www\.)?' || regexp_replace(lower(value), '([.\-])', '\\\1', 'g') || '(/|$|[^a-z0-9.-])'))
   limit 1;
  if v is not null then raise exception '사용할 수 없는 단어나 링크가 들어 있어요.' using errcode = 'P0001'; end if;
end;
$$;

-- 글: 브라우저에서 못 고치는 칸 지키기 + 하루 5개 + 차단 목록
create or replace function public.community_posts_guard()
returns trigger language plpgsql set search_path = public as $$
declare v_admin boolean := is_admin(); v_cnt int;
begin
  if current_user in ('anon', 'authenticated') and not v_admin then
    if tg_op = 'INSERT' then
      new.author_id := auth.uid();
      new.verify_status := case when new.revenue is not null or new.spend is not null then 'pending' else 'none' end;
      new.is_hidden := false; new.hidden_reason := null; new.hidden_by := null; new.deleted_at := null;
      new.comment_count := 0; new.reaction_count := 0; new.view_count := 0; new.image_count := 0;
      new.instructor_answered_at := null; new.created_at := now();
      select count(*) into v_cnt from community_posts
       where author_id = auth.uid() and created_at > now() - interval '24 hours';
      if v_cnt >= 5 then raise exception '글은 하루 5개까지 쓸 수 있어요.' using errcode = 'P0001'; end if;
    else
      if old.deleted_at is not null then raise exception '삭제된 글은 고칠 수 없어요.' using errcode = 'P0001'; end if;
      new.id := old.id; new.author_id := old.author_id; new.board_id := old.board_id;
      new.is_hidden := old.is_hidden; new.hidden_reason := old.hidden_reason; new.hidden_by := old.hidden_by;
      new.comment_count := old.comment_count; new.reaction_count := old.reaction_count;
      new.view_count := old.view_count; new.image_count := old.image_count;
      new.instructor_answered_at := old.instructor_answered_at; new.created_at := old.created_at;
      new.deleted_at := old.deleted_at;
      -- 숫자를 고치면 다시 확인 대기
      new.verify_status := case
        when new.revenue is not distinct from old.revenue and new.spend is not distinct from old.spend then old.verify_status
        when new.revenue is null and new.spend is null then 'none' else 'pending' end;
    end if;
    perform community_check_blocklist(coalesce(new.title, '') || ' ' || coalesce(new.body, ''));
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger community_posts_guard before insert or update on public.community_posts
  for each row execute function public.community_posts_guard();

-- 댓글: 하루 30개 + 차단 목록 + 강사 표시 + 답글은 1단만
create or replace function public.community_comments_guard()
returns trigger language plpgsql set search_path = public as $$
declare v_cnt int; v_parent_parent bigint; v_board int; v_courses int[];
begin
  if current_user in ('anon', 'authenticated') and not is_admin() then
    if tg_op = 'INSERT' then
      new.author_id := auth.uid(); new.is_pinned := false; new.is_hidden := false; new.deleted_at := null; new.created_at := now();
      select count(*) into v_cnt from community_comments
       where author_id = auth.uid() and created_at > now() - interval '24 hours';
      if v_cnt >= 30 then raise exception '댓글은 하루 30개까지 쓸 수 있어요.' using errcode = 'P0001'; end if;
    else
      if old.deleted_at is not null then raise exception '삭제된 댓글은 고칠 수 없어요.' using errcode = 'P0001'; end if;
      new.id := old.id; new.post_id := old.post_id; new.parent_id := old.parent_id; new.author_id := old.author_id;
      new.is_instructor := old.is_instructor; new.is_hidden := old.is_hidden; new.created_at := old.created_at;
      new.deleted_at := old.deleted_at;
      -- 남의 댓글(강사·스탭)은 고정만 바꿀 수 있음
      if old.author_id <> auth.uid() then new.body := old.body; end if;
      -- 고정은 그 글 게시판 강의의 강사만
      if new.is_pinned is distinct from old.is_pinned then
        select b.course_ids into v_courses from community_posts p join community_boards b on b.id = p.board_id where p.id = old.post_id;
        if not community_is_course_instructor(coalesce(v_courses, '{}')) then new.is_pinned := old.is_pinned; end if;
      end if;
    end if;
    perform community_check_blocklist(coalesce(new.body, ''));
  end if;
  if tg_op = 'INSERT' then
    if new.parent_id is not null then
      select parent_id into v_parent_parent from community_comments where id = new.parent_id and post_id = new.post_id;
      if not found then raise exception '답글을 달 댓글을 찾을 수 없어요.' using errcode = 'P0001'; end if;
      if v_parent_parent is not null then raise exception '답글에는 답글을 달 수 없어요.' using errcode = 'P0001'; end if;
    end if;
    new.is_instructor := exists (select 1 from community_members where user_id = new.author_id and badge = 'instructor');
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger community_comments_guard before insert or update on public.community_comments
  for each row execute function public.community_comments_guard();

-- ───────────────────────── 7. 자동 집계·알림 ─────────────────────────
create or replace function public.community_comments_after()
returns trigger language plpgsql security definer set search_path = public as $$
declare p record; v_parent_author uuid;
begin
  if tg_op = 'INSERT' then
    update community_posts set comment_count = comment_count + 1,
           instructor_answered_at = case when new.is_instructor and instructor_answered_at is null then now() else instructor_answered_at end
     where id = new.post_id returning author_id into p;
    if new.parent_id is not null then
      select author_id into v_parent_author from community_comments where id = new.parent_id;
      if v_parent_author is not null and v_parent_author <> new.author_id then
        insert into community_notifications (user_id, kind, post_id, comment_id) values (v_parent_author, 'reply', new.post_id, new.id);
      end if;
    end if;
    if p.author_id is not null and p.author_id <> new.author_id and p.author_id is distinct from v_parent_author then
      insert into community_notifications (user_id, kind, post_id, comment_id)
      values (p.author_id, case when new.is_instructor then 'instructor_answer' else 'comment' end, new.post_id, new.id);
    end if;
  elsif tg_op = 'DELETE' then
    update community_posts set comment_count = greatest(comment_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end;
$$;
create trigger community_comments_after after insert or delete on public.community_comments
  for each row execute function public.community_comments_after();

create or replace function public.community_reactions_after()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update community_posts set reaction_count = reaction_count + 1 where id = new.post_id;
  else
    update community_posts set reaction_count = greatest(reaction_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end;
$$;
create trigger community_reactions_after after insert or delete on public.community_reactions
  for each row execute function public.community_reactions_after();

create or replace function public.community_images_after()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from community_post_images where post_id = new.post_id) > 5 then
      raise exception '사진은 글 하나에 5장까지예요.' using errcode = 'P0001';
    end if;
    update community_posts set image_count = image_count + 1 where id = new.post_id;
  else
    update community_posts set image_count = greatest(image_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end;
$$;
create trigger community_images_after after insert or delete on public.community_post_images
  for each row execute function public.community_images_after();

-- 신고: 같은 글(댓글) 3건이면 자동 숨김(대표님 결정 ⑤)
create or replace function public.community_reports_after()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_cnt int;
begin
  -- 신고 대상이 그 글(또는 그 글의 댓글)인지 확인
  if (new.target_type = 'post' and new.target_id <> new.post_id)
     or (new.target_type = 'comment' and not exists (select 1 from community_comments where id = new.target_id and post_id = new.post_id)) then
    raise exception '신고 대상을 확인할 수 없어요.' using errcode = 'P0001';
  end if;
  select count(*) into v_cnt from community_reports
   where target_type = new.target_type and target_id = new.target_id and status in ('open', 'hidden');
  if v_cnt >= 3 then
    if new.target_type = 'post' then
      update community_posts set is_hidden = true, hidden_reason = '신고 3건 자동 숨김' where id = new.target_id and not is_hidden;
    else
      update community_comments set is_hidden = true where id = new.target_id and not is_hidden;
    end if;
    update community_reports set status = 'hidden'
     where target_type = new.target_type and target_id = new.target_id and status = 'open';
  end if;
  return null;
end;
$$;
create trigger community_reports_after after insert on public.community_reports
  for each row execute function public.community_reports_after();

-- ───────────────────────── 8. 사용자 동작 함수 ─────────────────────────
-- 글 보기: 하루 1회 조회 기록 + 조회수
create or replace function public.community_view_post(p_post_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not community_can_read_post(p_post_id) then return; end if;
  insert into community_post_views (post_id, user_id) values (p_post_id, auth.uid()) on conflict do nothing;
  if found then update community_posts set view_count = view_count + 1 where id = p_post_id; end if;
end;
$$;

-- 내 글 삭제: 댓글 있으면 자리만 남기고 내용 비움, 없으면 지움
create or replace function public.community_delete_post(p_post_id bigint)
returns text language plpgsql security definer set search_path = public as $$
declare p record;
begin
  select * into p from community_posts where id = p_post_id for update;
  if not found then raise exception '글을 찾을 수 없어요.'; end if;
  if p.author_id <> auth.uid() and not is_admin() then raise exception '내 글만 지울 수 있어요.'; end if;
  if p.comment_count > 0 then
    update community_posts set deleted_at = now(), title = '삭제된 글입니다', body = '', revenue = null, spend = null,
           verify_status = 'none' where id = p_post_id;
    delete from community_post_images where post_id = p_post_id;  -- 파일은 저장소 정리에서 지움
    delete from community_pins where post_id = p_post_id;
    return 'soft';
  end if;
  delete from community_posts where id = p_post_id;
  return 'hard';
end;
$$;

create or replace function public.community_delete_comment(p_comment_id bigint)
returns text language plpgsql security definer set search_path = public as $$
declare c record;
begin
  select * into c from community_comments where id = p_comment_id for update;
  if not found then raise exception '댓글을 찾을 수 없어요.'; end if;
  if c.author_id <> auth.uid() and not is_admin() then raise exception '내 댓글만 지울 수 있어요.'; end if;
  if exists (select 1 from community_comments where parent_id = p_comment_id) then
    update community_comments set deleted_at = now(), body = '삭제된 댓글입니다' where id = p_comment_id;
    return 'soft';
  end if;
  delete from community_comments where id = p_comment_id;
  return 'hard';
end;
$$;

-- 인기: 실시간(최근 24시간, 1시간마다) · 주간(최근 7일, 하루마다) — 오래됐으면 부른 사람이 다시 계산
create or replace function public.community_get_hot(p_kind text)
returns table (rank int, post_id bigint, computed_at timestamptz)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare v_at timestamptz; v_ttl interval; v_win interval;
begin
  if p_kind not in ('now', 'week') then raise exception 'kind'; end if;
  v_ttl := case p_kind when 'now' then interval '1 hour' else interval '1 day' end;
  v_win := case p_kind when 'now' then interval '24 hours' else interval '7 days' end;
  select max(h.computed_at) into v_at from community_hot h where h.kind = p_kind;
  if v_at is null or v_at < now() - v_ttl then
    perform pg_advisory_xact_lock(hashtext('community_hot_' || p_kind));
    select max(h.computed_at) into v_at from community_hot h where h.kind = p_kind;
    if v_at is null or v_at < now() - v_ttl then
      delete from community_hot h where h.kind = p_kind;
      insert into community_hot (kind, rank, post_id, score, computed_at)
      select p_kind, row_number() over (order by s.score desc, s.id desc), s.id, s.score, now()
        from (select p.id, p.reaction_count * 3 + p.comment_count * 2 + p.view_count * 0.2 as score
                from community_posts p join community_boards b on b.id = p.board_id
               where p.created_at > now() - v_win and not p.is_hidden and p.deleted_at is null
                 and b.enabled and b.kind <> 'notice'
               order by score desc, p.id desc limit 50) s;
    end if;
  end if;
  -- 읽을 수 있는 게시판 글만 돌려줌
  return query select h.rank, h.post_id, h.computed_at from community_hot h
                where h.kind = p_kind and community_can_read_post(h.post_id) order by h.rank limit 20;
end;
$$;

-- 내정보 숫자
create or replace function public.community_my_stats()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'posts', (select count(*) from community_posts where author_id = auth.uid() and deleted_at is null),
    'commented', (select count(distinct post_id) from community_comments where author_id = auth.uid() and deleted_at is null),
    'liked', (select count(distinct post_id) from community_reactions where user_id = auth.uid()),
    'saved', (select count(*) from community_saves where user_id = auth.uid()),
    'cohorts', (select coalesce(jsonb_agg(jsonb_build_object('board_id', b.id, 'name', b.name) order by b.sort_order), '[]'::jsonb)
                  from community_boards b
                 where b.read_level = 'cohort' and b.enabled
                   and exists (select 1 from purchases pu where pu.user_id = auth.uid() and pu.course_id = any(b.course_ids))));
$$;

-- 게시판별 새 글 수(메뉴 'N'): 마지막 본 시각 뒤 글
create or replace function public.community_board_new_counts()
returns table (board_id int, new_count int)
language sql stable security definer set search_path = public as $$
  select b.id, (select count(*)::int from community_posts p
                 where p.board_id = b.id and not p.is_hidden and p.deleted_at is null and p.author_id <> auth.uid()
                   and p.created_at > coalesce((select r.last_read_at from community_board_reads r where r.user_id = auth.uid() and r.board_id = b.id),
                                               now() - interval '7 days'))
    from community_boards b
   where b.enabled and community_can_read_board(b.id);
$$;

-- 관리자: 48시간 넘은 미답변 질문 → 강사에게 사이트 안 알림 다시 보내기
create or replace function public.community_remind_instructor(p_post_id bigint)
returns int language plpgsql security definer set search_path = public as $$
declare v_courses int[]; v_n int;
begin
  if not is_admin() then raise exception '관리자만 처리할 수 있습니다.'; end if;
  select b.course_ids into v_courses from community_posts p join community_boards b on b.id = p.board_id where p.id = p_post_id;
  insert into community_notifications (user_id, kind, post_id, message)
  select distinct m.user_id, 'remind_instructor', p_post_id, '48시간 넘게 답이 없는 질문이 있어요'
    from community_members m
   where m.badge = 'instructor'
     and (coalesce(array_length(v_courses, 1), 0) = 0
          or exists (select 1 from courses c where c.instructor_id = m.instructor_id and c.id = any(v_courses)));
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- 관리자: 회원 닉네임 목록(회원 원본 정보는 계속 잠금, 관리자 화면에서 이메일 등은 기존 회원 관리로)
grant execute on function public.community_view_post(bigint), public.community_delete_post(bigint),
  public.community_delete_comment(bigint), public.community_get_hot(text), public.community_my_stats(),
  public.community_board_new_counts(), public.community_remind_instructor(bigint) to authenticated;
revoke execute on function public.community_view_post(bigint), public.community_delete_post(bigint),
  public.community_delete_comment(bigint), public.community_get_hot(text), public.community_my_stats(),
  public.community_board_new_counts(), public.community_remind_instructor(bigint),
  public.community_check_blocklist(text) from anon, public;
grant execute on function public.community_check_blocklist(text) to authenticated;  -- 글·댓글 지킴 트리거가 호출

-- ───────────────────────── 9. 행 권한(RLS) ─────────────────────────
alter table public.community_board_groups enable row level security;
alter table public.community_boards enable row level security;
alter table public.community_members enable row level security;
alter table public.community_sanctions enable row level security;
alter table public.community_posts enable row level security;
alter table public.community_post_images enable row level security;
alter table public.community_comments enable row level security;
alter table public.community_reactions enable row level security;
alter table public.community_saves enable row level security;
alter table public.community_reports enable row level security;
alter table public.community_post_views enable row level security;
alter table public.community_pins enable row level security;
alter table public.community_banners enable row level security;
alter table public.community_tiles enable row level security;
alter table public.community_blocklist enable row level security;
alter table public.community_favorites enable row level security;
alter table public.community_board_reads enable row level security;
alter table public.community_hot enable row level security;
alter table public.community_notifications enable row level security;

-- 설정 표: 로그인 회원 읽기(게시판은 메뉴에 잠금 표시를 위해 이름까지 보임), 쓰기는 관리자
create policy cbg_read on public.community_board_groups for select to authenticated using (true);
create policy cbg_admin on public.community_board_groups for all to authenticated using (is_admin()) with check (is_admin());
create policy cb_read on public.community_boards for select to authenticated using (enabled or is_admin());
create policy cb_admin on public.community_boards for all to authenticated using (is_admin()) with check (is_admin());
create policy cban_read on public.community_banners for select to authenticated using (enabled or is_admin());
create policy cban_admin on public.community_banners for all to authenticated using (is_admin()) with check (is_admin());
create policy ct_read on public.community_tiles for select to authenticated using (enabled or is_admin());
create policy ct_admin on public.community_tiles for all to authenticated using (is_admin()) with check (is_admin());
create policy cbl_admin on public.community_blocklist for all to authenticated using (is_admin()) with check (is_admin());
create policy cpin_read on public.community_pins for select to authenticated using (community_can_read_post(post_id));
create policy cpin_admin on public.community_pins for all to authenticated using (is_admin()) with check (is_admin());

-- 회원: 닉네임·배지는 로그인 회원에게 보임(글 작성자 표시), 본인은 닉네임만 만들고 고침
create policy cm_read on public.community_members for select to authenticated using (true);
create policy cm_insert on public.community_members for insert to authenticated with check (user_id = auth.uid() or is_admin());
create policy cm_update on public.community_members for update to authenticated using (user_id = auth.uid() or is_admin()) with check (user_id = auth.uid() or is_admin());
create policy cm_delete on public.community_members for delete to authenticated using (is_admin());
create policy cs_read on public.community_sanctions for select to authenticated using (user_id = auth.uid() or is_admin());
create policy cs_admin on public.community_sanctions for all to authenticated using (is_admin()) with check (is_admin());

-- 글
create policy cp_read on public.community_posts for select to authenticated
  using (community_can_read_board(board_id) and (not is_hidden or author_id = auth.uid() or is_admin()));
create policy cp_insert on public.community_posts for insert to authenticated
  with check (is_admin() or (author_id = auth.uid() and community_can_write_board(board_id)));
create policy cp_update on public.community_posts for update to authenticated
  using (author_id = auth.uid() or is_admin()) with check (author_id = auth.uid() or is_admin());
create policy cp_delete on public.community_posts for delete to authenticated using (is_admin());

create policy cpi_read on public.community_post_images for select to authenticated using (community_can_read_post(post_id));
create policy cpi_insert on public.community_post_images for insert to authenticated
  with check (user_id = auth.uid() and path like auth.uid()::text || '/%'
              and exists (select 1 from community_posts p join community_boards b on b.id = p.board_id
                           where p.id = post_id and p.author_id = auth.uid() and p.deleted_at is null and b.allow_images));
create policy cpi_delete on public.community_post_images for delete to authenticated using (user_id = auth.uid() or is_admin());

-- 댓글
create policy cc_read on public.community_comments for select to authenticated
  using (community_can_read_post(post_id) and (not is_hidden or author_id = auth.uid() or is_admin()));
create policy cc_insert on public.community_comments for insert to authenticated
  with check (is_admin() or (author_id = auth.uid() and community_can_read_post(post_id)
              and exists (select 1 from community_posts p where p.id = post_id and p.deleted_at is null
                           and community_can_write_board(p.board_id))));
create policy cc_update on public.community_comments for update to authenticated
  using (author_id = auth.uid() or is_admin() or community_is_staff()) with check (author_id = auth.uid() or is_admin() or community_is_staff());
create policy cc_delete on public.community_comments for delete to authenticated using (is_admin());

-- 반응·저장: 본인 것만, 읽을 수 있는 글에만
create policy cr_read on public.community_reactions for select to authenticated using (user_id = auth.uid() or is_admin());
create policy cr_insert on public.community_reactions for insert to authenticated with check (user_id = auth.uid() and community_can_read_post(post_id));
create policy cr_delete on public.community_reactions for delete to authenticated using (user_id = auth.uid());
create policy csv_read on public.community_saves for select to authenticated using (user_id = auth.uid());
create policy csv_insert on public.community_saves for insert to authenticated with check (user_id = auth.uid() and community_can_read_post(post_id));
create policy csv_delete on public.community_saves for delete to authenticated using (user_id = auth.uid());

-- 신고: 본인 신고만 넣고 봄, 처리는 관리자
create policy crep_read on public.community_reports for select to authenticated using (reporter_id = auth.uid() or is_admin());
create policy crep_insert on public.community_reports for insert to authenticated
  with check (reporter_id = auth.uid() and status = 'open' and community_can_read_post(post_id));
create policy crep_admin on public.community_reports for update to authenticated using (is_admin()) with check (is_admin());

-- 조회 기록: 본인 것만 읽음(새 글 빨간 점), 넣기는 함수로
create policy cv_read on public.community_post_views for select to authenticated using (user_id = auth.uid());

-- 즐겨찾기·마지막 본 시각: 본인
create policy cf_all on public.community_favorites for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy cbr_all on public.community_board_reads for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 인기: 함수로만 읽음(정책 없음 = 직접 조회 막힘)
-- 알림: 본인 읽고 읽음 표시, 관리자 보내기
create policy cn_read on public.community_notifications for select to authenticated using (user_id = auth.uid());
create policy cn_update on public.community_notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy cn_admin on public.community_notifications for all to authenticated using (is_admin()) with check (is_admin());

-- 알림 표: 본인이 바꿀 수 있는 칸은 읽은 시각뿐
create or replace function public.community_notifications_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user in ('anon', 'authenticated') and not is_admin() then
    new.id := old.id; new.user_id := old.user_id; new.kind := old.kind; new.post_id := old.post_id;
    new.comment_id := old.comment_id; new.message := old.message; new.created_at := old.created_at;
  end if;
  return new;
end;
$$;
create trigger community_notifications_guard before update on public.community_notifications
  for each row execute function public.community_notifications_guard();

-- ───────────────────────── 10. 사진 저장소(비공개 버킷) ─────────────────────────
-- 경로: community/<user_id>/<임의 이름>. 글을 읽을 수 있는 회원만 서명 주소로 봄. 5MB · 사진 형식만.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('community', 'community', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

create policy community_obj_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'community' and (storage.foldername(name))[1] = auth.uid()::text);
create policy community_obj_read on storage.objects for select to authenticated
  using (bucket_id = 'community' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin()
    or exists (select 1 from public.community_post_images i where i.path = name and public.community_can_read_post(i.post_id))));
create policy community_obj_delete on storage.objects for delete to authenticated
  using (bucket_id = 'community' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- ───────────────────────── 11. 처음 게시판(시안 v8과 같은 이름, 글은 없음) ─────────────────────────
insert into public.community_board_groups (name, sort_order) values ('소식', 1), ('수익화', 2), ('소통', 3), ('기수 방', 4);

insert into public.community_boards (group_id, slug, name, description, icon, kind, read_level, write_level, heads, sort_order)
select g.id, v.slug, v.name, v.description, v.icon, v.kind, v.read_level, v.write_level, v.heads, v.sort_order
  from (values
    ('소식', 'notice', '공지', '운영진 공지', 'ti-speakerphone', 'notice', 'member', 'staff', '{}'::text[], 1),
    ('소식', 'guide', '이용 가이드', '처음 오셨다면 여기부터', 'ti-book', 'notice', 'member', 'staff', '{}'::text[], 2),
    ('소식', 'grade', '등급 안내', '등급과 등업 조건', 'ti-award', 'notice', 'member', 'staff', '{}'::text[], 3),
    ('소식', 'hello', '가입인사', '자기소개 + 댓글 3개 = 실행러', 'ti-hand-stop', 'normal', 'buyer', 'buyer', '{}'::text[], 4),
    ('소식', 'live', '무료 특강 신청', '다음 무료 라이브 일정과 신청', 'ti-broadcast', 'notice', 'member', 'staff', '{}'::text[], 5),
    ('수익화', 'log', '수익화 일지', '됐다·안 됐다·멈춤 모두 기록', 'ti-notebook', 'normal', 'buyer', 'buyer', '{win,fail,stop}'::text[], 1),
    ('수익화', 'proof', '성과 인증', '운영자 확인을 거친 수익 인증', 'ti-receipt', 'normal', 'buyer', 'buyer', '{win}'::text[], 2),
    ('수익화', 'qna', '질문방', '48시간 안에 답해요', 'ti-help-circle', 'qna', 'buyer', 'buyer', '{q}'::text[], 3),
    ('수익화', 'lib', '자료실', '함께 쓰는 자료', 'ti-folder', 'normal', 'buyer', 'buyer', '{}'::text[], 4),
    ('소통', 'talk', '찐소통방', '', 'ti-messages', 'normal', 'buyer', 'buyer', '{}'::text[], 1),
    ('소통', 'free', '자유게시판', '', 'ti-message-2', 'normal', 'buyer', 'buyer', '{}'::text[], 2)
  ) as v(grp, slug, name, description, icon, kind, read_level, write_level, heads, sort_order)
  join public.community_board_groups g on g.name = v.grp;
-- 기수 방은 관리자 '게시판·회원' 화면에서 강의를 골라 만든다(예: AI 블로그 1기 → 강의 129).
