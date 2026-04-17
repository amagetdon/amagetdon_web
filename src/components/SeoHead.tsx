import { useEffect } from 'react'
import { useSeoSettings } from '../hooks/useSeoSettings'
import { useBusinessInfo } from '../hooks/useBusinessInfo'

interface SeoHeadProps {
  override?: {
    title?: string
    author?: string
    description?: string
    keywords?: string
    ogTitle?: string
    ogDescription?: string
    ogImage?: string
    twitterTitle?: string
    twitterDescription?: string
    twitterImage?: string
  }
}

function upsertMetaTag(selector: string, attrs: Record<string, string>, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector)
  if (!content) {
    if (el) el.remove()
    return
  }
  if (!el) {
    el = document.createElement('meta')
    for (const [key, value] of Object.entries(attrs)) {
      el.setAttribute(key, value)
    }
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

export default function SeoHead({ override }: SeoHeadProps = {}) {
  const seo = useSeoSettings()
  const biz = useBusinessInfo()

  useEffect(() => {
    const title = override?.title || seo.title || biz.siteTitle || ''
    const author = override?.author || seo.author || ''
    const description = override?.description || seo.description || ''
    const keywords = override?.keywords || seo.keywords || ''
    const ogTitle = override?.ogTitle || seo.ogTitle || title
    const ogDescription = override?.ogDescription || seo.ogDescription || description
    const ogImage = override?.ogImage || seo.ogImage || ''
    const twitterTitle = override?.twitterTitle || seo.twitterTitle || ogTitle
    const twitterDescription = override?.twitterDescription || seo.twitterDescription || ogDescription
    const twitterImage = override?.twitterImage || seo.twitterImage || ogImage

    if (title) document.title = title
    upsertMetaTag('meta[name="author"]', { name: 'author' }, author)
    upsertMetaTag('meta[name="description"]', { name: 'description' }, description)
    upsertMetaTag('meta[name="keywords"]', { name: 'keywords' }, keywords)
    upsertMetaTag('meta[property="og:title"]', { property: 'og:title' }, ogTitle)
    upsertMetaTag('meta[property="og:description"]', { property: 'og:description' }, ogDescription)
    upsertMetaTag('meta[property="og:image"]', { property: 'og:image' }, ogImage)
    upsertMetaTag('meta[name="twitter:title"]', { name: 'twitter:title' }, twitterTitle)
    upsertMetaTag('meta[name="twitter:description"]', { name: 'twitter:description' }, twitterDescription)
    upsertMetaTag('meta[name="twitter:image"]', { name: 'twitter:image' }, twitterImage)
    upsertMetaTag('meta[name="twitter:card"]', { name: 'twitter:card' }, twitterImage ? 'summary_large_image' : '')

    const rssUrl = seo.rssUrl || ''
    let rssLink = document.head.querySelector<HTMLLinkElement>('link[rel="alternate"][type="application/rss+xml"]')
    if (rssUrl) {
      if (!rssLink) {
        rssLink = document.createElement('link')
        rssLink.setAttribute('rel', 'alternate')
        rssLink.setAttribute('type', 'application/rss+xml')
        document.head.appendChild(rssLink)
      }
      rssLink.setAttribute('href', rssUrl)
    } else if (rssLink) {
      rssLink.remove()
    }
  }, [
    override?.title, override?.author, override?.description, override?.keywords,
    override?.ogTitle, override?.ogDescription, override?.ogImage,
    override?.twitterTitle, override?.twitterDescription, override?.twitterImage,
    seo.title, seo.author, seo.description, seo.keywords,
    seo.ogTitle, seo.ogDescription, seo.ogImage,
    seo.twitterTitle, seo.twitterDescription, seo.twitterImage,
    seo.rssUrl,
    biz.siteTitle,
  ])

  return null
}
