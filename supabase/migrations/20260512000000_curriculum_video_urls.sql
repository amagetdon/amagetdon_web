-- 커리큘럼 한 항목에 여러 영상/URL 을 보관할 수 있도록 jsonb 배열 컬럼 추가.
-- 각 원소: { url: string, is_redirect: boolean, label?: string | null }
alter table curriculum_items
  add column if not exists video_urls jsonb not null default '[]'::jsonb;

-- 기존 단일 video_url 데이터를 새 배열로 이전 (한 번만, 비어있는 행에 한해서).
update curriculum_items
set video_urls = jsonb_build_array(
  jsonb_build_object(
    'url', video_url,
    'is_redirect', coalesce(is_redirect, false),
    'label', null
  )
)
where video_url is not null
  and video_url <> ''
  and (video_urls is null or video_urls = '[]'::jsonb);
