import type { SyntheticEvent } from 'react'
import { r2Proxy } from '../lib/image'

// 강의·전자책 상세의 긴 랜딩 이미지(여러 장, 장당 최대 2MB 대 GIF 포함).
// 첫 장만 바로 받고 나머지는 화면에 가까워질 때 받는다(loading=lazy).
// 아직 안 받은 이미지는 높이가 0이라 전부 화면 근처로 몰려 결국 다 받아버리므로, 받기 전까지 임시 높이를 두고
// 받으면 원래 높이로 돌린다. (10/14 129 상세: 15장 15.2MB 를 처음에 한꺼번에 받던 문제)
export default function LandingImage({ src: rawSrc, alt, eager }: { src: string; alt: string; eager?: boolean }) {
  const src = r2Proxy(rawSrc)
  if (eager) {
    return <img src={src} alt={alt} className="w-full block" fetchPriority="high" decoding="async" />
  }
  const done = (e: SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.minHeight = '' }
  return (
    <img
      src={src}
      alt={alt}
      className="w-full block"
      loading="lazy"
      decoding="async"
      style={{ minHeight: '60vh' }}
      onLoad={done}
      onError={done}
    />
  )
}
