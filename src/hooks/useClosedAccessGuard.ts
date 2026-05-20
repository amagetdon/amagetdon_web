import { useCallback, useEffect } from 'react'
import type { MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { isClosedAt } from '../utils/courseStatus'
import { useAcademySettings } from './useAcademySettings'

// closedVisualEffect 키는 호환을 위해 그대로 두지만 의미는 "마감 시 접근 차단" 으로 재해석.
// 켜져 있으면 마감된 강의/전자책은 카드 클릭과 직접 URL 진입을 모두 막고 토스트로 안내한다.

type Kind = 'course' | 'ebook'

const MESSAGES: Record<Kind, string> = {
  course: '마감된 강의입니다',
  ebook: '마감된 전자책입니다',
}

export function useClosedAccessGuard() {
  const { closedVisualEffect } = useAcademySettings()
  const enabled = closedVisualEffect !== false

  const blockIfClosed = useCallback(
    (kind: Kind, deadline: string | null | undefined) =>
      (e: MouseEvent) => {
        if (!enabled) return
        if (!isClosedAt(deadline)) return
        e.preventDefault()
        e.stopPropagation()
        toast.error(MESSAGES[kind])
      },
    [enabled]
  )

  return { enabled, blockIfClosed }
}

export function useRedirectIfClosed(opts: {
  kind: Kind
  deadline: string | null | undefined
  fallback: string
  active: boolean
}) {
  const { kind, deadline, fallback, active } = opts
  const { closedVisualEffect } = useAcademySettings()
  const enabled = closedVisualEffect !== false
  const navigate = useNavigate()

  useEffect(() => {
    if (!active || !enabled) return
    if (!isClosedAt(deadline)) return
    toast.error(MESSAGES[kind])
    navigate(fallback, { replace: true })
  }, [active, enabled, kind, deadline, fallback, navigate])
}
