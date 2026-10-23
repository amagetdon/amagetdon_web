import { createContext, useContext } from 'react'
import type { CommunityAccess, CommunityBoard, CommunityBoardGroup, CommunityMember } from '../../types/community'

// 커뮤니티 화면 전체가 같이 쓰는 상태: 입장 단계, 내 닉네임, 게시판 목록, 즐겨찾기, 새 글 수, 안 읽은 알림 수
export interface CommunityState {
  ready: boolean
  error: string | null
  access: CommunityAccess | null
  member: CommunityMember | null
  groups: CommunityBoardGroup[]
  boards: CommunityBoard[]
  readable: Set<number>
  favorites: Set<number>
  newCounts: Record<number, number>
  unread: number
  drawerOpen: boolean
  setDrawerOpen: (v: boolean) => void
  boardById: (id: number) => CommunityBoard | undefined
  boardBySlug: (slug: string) => CommunityBoard | undefined
  toggleFavorite: (boardId: number) => Promise<void>
  setMember: (m: CommunityMember) => void
  refreshCounts: () => Promise<void>
  reload: () => Promise<void>
}

export const CommunityCtx = createContext<CommunityState | null>(null)

export function useCommunity(): CommunityState {
  const v = useContext(CommunityCtx)
  if (!v) throw new Error('useCommunity 는 CommunityProvider 안에서만 씁니다.')
  return v
}

