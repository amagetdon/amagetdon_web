import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { communityService } from '../../services/communityService'
import type { CommunityAccess, CommunityBoard, CommunityBoardGroup, CommunityMember } from '../../types/community'
import { CommunityCtx, type CommunityState } from './communityState'

export function CommunityProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [access, setAccess] = useState<CommunityAccess | null>(null)
  const [member, setMember] = useState<CommunityMember | null>(null)
  const [groups, setGroups] = useState<CommunityBoardGroup[]>([])
  const [boards, setBoards] = useState<CommunityBoard[]>([])
  const [readable, setReadable] = useState<Set<number>>(new Set())
  const [favorites, setFavorites] = useState<Set<number>>(new Set())
  const [newCounts, setNewCounts] = useState<Record<number, number>>({})
  const [unread, setUnread] = useState(0)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const refreshCounts = useCallback(async () => {
    if (!user) return
    const [nc, un] = await Promise.all([communityService.newCounts(), communityService.unreadCount()])
    setNewCounts(nc)
    setUnread(un)
  }, [user])

  const reload = useCallback(async () => {
    if (!user) { setReady(true); return }
    try {
      setError(null)
      const [acc, me, bd, fav] = await Promise.all([
        communityService.access(),
        communityService.me(user.id),
        communityService.boards(),
        communityService.favorites(),
      ])
      setAccess(acc)
      setMember(me)
      setGroups(bd.groups)
      setBoards(bd.boards)
      setFavorites(new Set(fav))
      setReadable(await communityService.readableBoardIds(bd.boards.map((b) => b.id)))
      await refreshCounts()
    } catch (e) {
      setError(e instanceof Error ? e.message : '커뮤니티를 불러오지 못했어요.')
    } finally {
      setReady(true)
    }
  }, [user, refreshCounts])

  useEffect(() => { setReady(false); void reload() }, [reload])

  const toggleFavorite = useCallback(async (boardId: number) => {
    const on = !favorites.has(boardId)
    setFavorites((prev) => { const n = new Set(prev); if (on) n.add(boardId); else n.delete(boardId); return n })
    try { await communityService.setFavorite(boardId, on) } catch {
      setFavorites((prev) => { const n = new Set(prev); if (on) n.delete(boardId); else n.add(boardId); return n })
    }
  }, [favorites])

  const value = useMemo<CommunityState>(() => ({
    ready, error, access, member, groups, boards, readable, favorites, newCounts, unread, drawerOpen, setDrawerOpen,
    boardById: (id) => boards.find((b) => b.id === id),
    boardBySlug: (slug) => boards.find((b) => b.slug === slug),
    toggleFavorite, setMember, refreshCounts, reload,
  }), [ready, error, access, member, groups, boards, readable, favorites, newCounts, unread, drawerOpen, toggleFavorite, refreshCounts, reload])

  return <CommunityCtx.Provider value={value}>{children}</CommunityCtx.Provider>
}
