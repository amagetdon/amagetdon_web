import { useEffect, useMemo } from 'react'
import BlogPostView from '../components/blog/BlogPostView'
import { convertNaverPost } from '../lib/naverBlog'
import sampleHtml from '../dev/naverSample.html?raw'

// 블로그형 게시판 화면 미리보기 (미리보기 배포 주소에서만) — 우리 네이버 블로그 글 1개를 변환해 그대로 보여준다.
export default function BlogPreviewPage() {
  const isProd = typeof window !== 'undefined' && /(^|\.)amag-class\.com$/.test(window.location.hostname)
  const post = useMemo(() => convertNaverPost(sampleHtml), [])
  useEffect(() => { document.title = post.title }, [post.title])
  if (isProd) return null

  const disclaimer = '<p class="bp">&nbsp;</p><p class="bp" style="text-align:left"><span style="font-size:11px;color:#999999">* 이 글은 아마겟돈 클래스 실제 수강생의 후기를 바탕으로 각색한 글 입니다.</span></p>'

  return (
    <BlogPostView
      blogTitle="senior blog"
      profile={{
        image: post.profileImage,
        name: post.nickname || '시니어 BLOG',
        sub: 'lumos___solem',
        description: '몸이 늙어도, 수익을 만드는 방법 공부',
        moreHref: '#',
        button: { label: '구독하기', onClick: () => alert('미리보기: 뉴스레터 구독으로 연결됩니다') },
      }}
      categories={[{ label: '전체보기', count: 8, active: true }, { label: post.category || '게시판', count: 8 }]}
      recent={[{ label: post.title.slice(0, 18) + '…', href: '#' }]}
      post={{
        category: post.category,
        title: post.title,
        authorName: post.nickname || '시니어 BLOG',
        authorImage: post.profileImage,
        dateText: post.dateText,
        bodyHtml: post.bodyHtml + disclaimer,
        tags: ['시니어부업', 'ai수익화', '무료강의'],
      }}
      subscribe={{ label: '구독', onClick: () => alert('미리보기: 뉴스레터 구독으로 연결됩니다') }}
    />
  )
}
