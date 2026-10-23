import { useEffect } from 'react'
import { supabase } from '../lib/supabase'

// 카카오 로그인 직후 1회 — 카카오 동의 화면에서 받은 서비스 약관(이용약관·개인정보·마케팅) 동의 결과를 서버에 기록시킨다.
// 카카오 토큰(provider_token)은 로그인 직후 세션에만 있어서 이때 보낸다. 실제 확인·기록은 서버(/api/kakao-consent)가
// 카카오에 직접 물어서 한다. 실패해도 로그인·신청 흐름에는 영향 없음(조용히 넘어감).
export default function KakaoConsentSync() {
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== 'SIGNED_IN' && event !== 'INITIAL_SESSION') return
      const kakaoToken = session?.provider_token
      if (!session || !kakaoToken || session.user.app_metadata?.provider !== 'kakao') return
      const key = `kakao_consent_synced_${session.user.id}`
      try {
        if (sessionStorage.getItem(key)) return
        sessionStorage.setItem(key, '1')
      } catch { /* 저장 불가 — 그래도 한 번 보낸다 */ }
      // onAuthStateChange 콜백 안에서 바로 네트워크 요청을 기다리지 않는다(supabase-js 권고) — 다음 틱에 보냄
      window.setTimeout(() => {
        fetch('/api/kakao-consent', {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ provider_token: kakaoToken }),
        }).catch(() => {})
      }, 0)
    })
    return () => data.subscription.unsubscribe()
  }, [])
  return null
}
