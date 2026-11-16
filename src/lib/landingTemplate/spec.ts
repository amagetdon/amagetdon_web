import type { LandingSectionSpec } from './types'
import { FREE_SPEC } from './spec.free'
import { PAID_SPEC } from './spec.paid'

/** 종류별 표준 섹션 순서와 섹션마다 필요한 자료 */
export const LANDING_SPEC: { free: LandingSectionSpec[]; paid: LandingSectionSpec[] } = {
  free: FREE_SPEC,
  paid: PAID_SPEC,
}
