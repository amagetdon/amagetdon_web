import { supabase } from './supabase'
import { convertNaverPost } from './naverBlog'

// 네이버 블로그 글 → 게시판 글 (관리자 글쓰기 '네이버 블로그에서 가져오기')
//  1) 서버(/api/naver-import)가 글 페이지를 받아오고  2) 브라우저에서 블록 HTML 로 변환
//  3) 사진은 서버를 거쳐 받아 우리 저장소에 다시 올리고(네이버 원본이 지워지거나 막혀도 유지)
//  4) 네이버 짧은 주소는 최종 주소로 풀고, 우리 사이트 강의·전자책 링크에는 지정한 UTM 을 붙인다

export interface ImportUtm { source: string; medium: string; campaign: string }

async function authHeader() {
  const { data: { session } } = await supabase.auth.getSession()
  return { authorization: `Bearer ${session?.access_token ?? ''}` }
}

export async function importNaverPost(
  postUrl: string,
  opts: { upload: (file: File) => Promise<string>; utm?: ImportUtm | null; onProgress?: (msg: string) => void },
): Promise<{ title: string; html: string; images: number }> {
  const headers = await authHeader()
  const say = opts.onProgress ?? (() => {})

  say('글을 받아오는 중…')
  const res = await fetch(`/api/naver-import?url=${encodeURIComponent(postUrl)}`, { headers })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
  const post = convertNaverPost(body.html as string)

  const doc = new DOMParser().parseFromString(`<div id="root">${post.bodyHtml}</div>`, 'text/html')
  const root = doc.getElementById('root')!

  // 사진 옮기기 (같은 사진은 한 번만)
  const imgs = [...root.querySelectorAll('img')].filter((i) => /(^|\.)pstatic\.net$/.test(safeHost(i.getAttribute('src'))))
  const moved = new Map<string, string>()
  let done = 0
  for (const el of imgs) {
    const src = el.getAttribute('src')!
    if (!moved.has(src)) {
      say(`사진 옮기는 중… (${done + 1}/${new Set(imgs.map((i) => i.getAttribute('src'))).size})`)
      const r = await fetch(`/api/naver-import?img=${encodeURIComponent(src)}`, { headers })
      if (!r.ok) throw new Error(`사진을 받지 못했습니다: ${src.slice(0, 80)}`)
      const blob = await r.blob()
      const name = decodeURIComponent(new URL(src).pathname.split('/').pop() || 'image').replace(/[^\w.-]/g, '_') || 'image.jpg'
      moved.set(src, await opts.upload(new File([blob], name, { type: blob.type || 'image/jpeg' })))
      done++
    }
    el.setAttribute('src', moved.get(src)!)
    el.removeAttribute('referrerpolicy')
  }

  // 링크 정리
  say('링크 정리 중…')
  for (const a of [...root.querySelectorAll('a[href]')]) {
    let href = a.getAttribute('href')!
    if (/^(m\.site\.naver\.com|naver\.me|link\.naver\.com)$/.test(safeHost(href))) {
      const r = await fetch(`/api/naver-import?resolve=${encodeURIComponent(href)}`, { headers })
      href = ((await r.json().catch(() => ({}))) as { url?: string }).url || href
    }
    if (opts.utm && /(^|\.)amag-class\.com$/.test(safeHost(href)) && /^\/(course|ebook|landing)\//.test(new URL(href).pathname)) {
      const u = new URL(href)
      u.searchParams.set('utm_source', opts.utm.source)
      u.searchParams.set('utm_medium', opts.utm.medium)
      u.searchParams.set('utm_campaign', opts.utm.campaign)
      u.searchParams.delete('utm_content') // 소재 구분은 글 화면에서 자동(광고 소재 또는 글 번호)
      href = u.toString()
    }
    a.setAttribute('href', href)
  }

  return { title: post.title, html: root.innerHTML, images: moved.size }
}

function safeHost(u: string | null) {
  try { return new URL(u || '').hostname } catch { return '' }
}
