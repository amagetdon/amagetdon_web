import { supabase } from './supabase'

/**
 * 오픈채팅(구매 직후 안내 링크) 진입을 본인 purchases 행에 기록 — 관리자 수강생 목록 '오픈채팅' 열.
 * contentId 는 tracking 의 content_id 규약(course_{id} / ebook_{id}). manual=true 는 사용자가 직접 버튼을 누른 경우.
 * 최초 1회만 기록(RPC 가 이미 채워진 값은 건드리지 않음). 실패는 무시 — 앱 흐름에 영향 없음.
 * 같은 탭에서 오픈채팅으로 넘어가는 경우 기록이 끝날 때까지 기다릴 수 있도록 Promise 를 돌려준다(기다리지 않아도 됨).
 */
export function logOpenChat(contentId: string | null | undefined, manual: boolean): Promise<void> {
  const m = contentId?.match(/^(course|ebook)_(\d+)$/)
  if (!m) return Promise.resolve()
  return Promise.resolve(
    supabase.rpc('mark_openchat_open', { p_kind: m[1], p_id: Number(m[2]), p_manual: manual } as never),
  ).then(() => {}, () => {})
}
