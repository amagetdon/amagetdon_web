import { supabase } from '../lib/supabase'

export type TriggerType = 'time_offset' | 'enrollment_full' | 'manual'

export interface WebhookSchedule {
  id: number
  scope: 'course' | 'ebook'
  scope_id: number
  label: string
  trigger_type: TriggerType
  offset_minutes: number
  request_template: string
  enabled: boolean
  sort_order: number
  enrollment_full_fired_at: string | null
  variable_aliases: Record<string, string>
  created_at: string
  updated_at: string
}

export interface WebhookScheduleRun {
  id: number
  webhook_schedule_id: number
  course_schedule_id: number | null
  user_id: string | null
  user_name: string | null
  user_phone: string | null
  user_email: string | null
  course_title: string | null
  course_scheduled_at: string | null
  fire_at: string
  fired_at: string | null
  status: 'pending' | 'success' | 'failed' | 'skipped' | 'cancelled'
  webhook_log_id: number | null
  error_message: string | null
  attempt_count: number
  created_at: string
}

export const webhookScheduleService = {
  async listByScope(scope: 'course' | 'ebook', scopeId: number): Promise<WebhookSchedule[]> {
    const { data } = await supabase
      .from('webhook_schedules')
      .select('*')
      .eq('scope', scope)
      .eq('scope_id', scopeId)
      .order('offset_minutes')
      .order('sort_order')
    return (data as WebhookSchedule[] | null) ?? []
  },

  async upsert(schedule: Partial<WebhookSchedule>): Promise<WebhookSchedule> {
    if (schedule.id) {
      const { data, error } = await supabase.from('webhook_schedules').update(schedule as never).eq('id', schedule.id).select().single()
      if (error) throw error
      return data as WebhookSchedule
    }
    const { data, error } = await supabase.from('webhook_schedules').insert(schedule as never).select().single()
    if (error) throw error
    return data as WebhookSchedule
  },

  async delete(id: number): Promise<void> {
    await supabase.from('webhook_schedules').delete().eq('id', id)
  },

  // 구매 시점에 발송 큐 fan-out (time_offset 트리거만)
  async enqueueForPurchase(params: {
    userId: string
    userName?: string
    userPhone?: string
    userEmail?: string
    scope: 'course' | 'ebook'
    scopeId: number
    courseTitle?: string
  }): Promise<number> {
    const schedules = await this.listByScope(params.scope, params.scopeId)
    const eligible = schedules.filter((s) => s.enabled && s.trigger_type === 'time_offset')
    if (eligible.length === 0) return 0

    let courseSchedules: Array<{ id: number; scheduled_at: string }> = []
    if (params.scope === 'course') {
      const { data } = await supabase
        .from('schedules')
        .select('id, scheduled_at')
        .eq('course_id', params.scopeId)
      courseSchedules = (data as Array<{ id: number; scheduled_at: string }> | null) ?? []
    }

    const now = Date.now()
    const rows: Record<string, unknown>[] = []

    for (const sched of eligible) {
      if (params.scope === 'course' && courseSchedules.length > 0) {
        for (const cs of courseSchedules) {
          const fireAt = new Date(new Date(cs.scheduled_at).getTime() + sched.offset_minutes * 60_000)
          if (fireAt.getTime() < now) continue
          rows.push({
            webhook_schedule_id: sched.id,
            course_schedule_id: cs.id,
            user_id: params.userId,
            user_name: params.userName ?? null,
            user_phone: params.userPhone ?? null,
            user_email: params.userEmail ?? null,
            course_title: params.courseTitle ?? null,
            course_scheduled_at: cs.scheduled_at,
            fire_at: fireAt.toISOString(),
          })
        }
      } else {
        rows.push({
          webhook_schedule_id: sched.id,
          course_schedule_id: null,
          user_id: params.userId,
          user_name: params.userName ?? null,
          user_phone: params.userPhone ?? null,
          user_email: params.userEmail ?? null,
          course_title: params.courseTitle ?? null,
          course_scheduled_at: null,
          fire_at: new Date(now).toISOString(),
        })
      }
    }

    if (rows.length === 0) return 0
    const { error } = await supabase.from('webhook_schedule_runs').insert(rows as never)
    if (error) { console.error('webhook_schedule_runs insert failed', error); return 0 }
    return rows.length
  },

  // 구매자 전체 → 알림 fan-out (enrollment_full 자동 또는 manual 수동)
  async fanOutToAllPurchasers(scheduleId: number): Promise<{ inserted: number; recipients: number }> {
    const { data: sched } = await supabase.from('webhook_schedules').select('*').eq('id', scheduleId).maybeSingle()
    if (!sched) return { inserted: 0, recipients: 0 }
    const s = sched as WebhookSchedule

    // 1) 구매자 user_id 목록
    const colName = s.scope === 'course' ? 'course_id' : 'ebook_id'
    const { data: purchases } = await supabase
      .from('purchases')
      .select('user_id')
      .eq(colName, s.scope_id)
    const userIdSet = new Set(((purchases as Array<{ user_id: string }> | null) ?? []).map((p) => p.user_id).filter(Boolean))
    const userIds = Array.from(userIdSet)
    if (userIds.length === 0) return { inserted: 0, recipients: 0 }

    // 2) 프로필 일괄 조회
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, phone, email')
      .in('id', userIds)
    const profileMap = new Map<string, { name?: string | null; phone?: string | null; email?: string | null }>(
      ((profiles as Array<{ id: string; name?: string | null; phone?: string | null; email?: string | null }> | null) ?? [])
        .map((p) => [p.id, p]),
    )

    // 3) 강의/전자책 정보
    let courseTitle = ''
    let scheduledAt: string | null = null
    if (s.scope === 'course') {
      const { data: c } = await supabase.from('courses').select('title').eq('id', s.scope_id).maybeSingle()
      courseTitle = (c as { title?: string } | null)?.title ?? ''
      const { data: cs } = await supabase.from('schedules').select('scheduled_at').eq('course_id', s.scope_id).order('scheduled_at').limit(1).maybeSingle()
      scheduledAt = (cs as { scheduled_at?: string } | null)?.scheduled_at ?? null
    } else {
      const { data: e } = await supabase.from('ebooks').select('title').eq('id', s.scope_id).maybeSingle()
      courseTitle = (e as { title?: string } | null)?.title ?? ''
    }

    const now = new Date().toISOString()
    const rows = userIds.map((uid) => {
      const p = profileMap.get(uid)
      return {
        webhook_schedule_id: s.id,
        course_schedule_id: null,
        user_id: uid,
        user_name: p?.name ?? null,
        user_phone: p?.phone ?? null,
        user_email: p?.email ?? null,
        course_title: courseTitle,
        course_scheduled_at: scheduledAt,
        fire_at: now,
      }
    })
    const { error } = await supabase.from('webhook_schedule_runs').insert(rows as never)
    if (error) { console.error('fanOut insert failed', error); return { inserted: 0, recipients: userIds.length } }
    return { inserted: rows.length, recipients: userIds.length }
  },

  // 정원 도달 시 자동 트리거 (구매 직후 호출)
  async triggerEnrollmentFullIfReached(scope: 'course' | 'ebook', scopeId: number, currentCount: number, maxCount: number | null): Promise<number> {
    if (!maxCount || currentCount < maxCount) return 0
    const schedules = await this.listByScope(scope, scopeId)
    const eligible = schedules.filter((s) => s.enabled && s.trigger_type === 'enrollment_full' && !s.enrollment_full_fired_at)
    let total = 0
    for (const s of eligible) {
      const result = await this.fanOutToAllPurchasers(s.id)
      total += result.inserted
      // 1회만 발사 보장
      await supabase.from('webhook_schedules').update({ enrollment_full_fired_at: new Date().toISOString() } as never).eq('id', s.id)
    }
    return total
  },

  // 환불 시 미발송 건 취소
  async cancelForUserScope(userId: string, scope: 'course' | 'ebook', scopeId: number): Promise<number> {
    const { data, error } = await supabase.rpc('cancel_webhook_schedule_runs_for_user_course', {
      p_user_id: userId,
      p_scope: scope,
      p_scope_id: scopeId,
    } as never)
    if (error) {
      console.error('cancel failed', error)
      return 0
    }
    return Number(data ?? 0)
  },

  // 어드민용 — 지금 즉시 도래한 큐 처리 (webhook-schedule-runner 수동 실행)
  async runDueNow(): Promise<{ processed: number; errors: number }> {
    const { data, error } = await supabase.functions.invoke('webhook-schedule-runner', { body: {} })
    if (error) throw error
    const result = data as { processed?: number; errors?: number } | null
    return { processed: result?.processed ?? 0, errors: result?.errors ?? 0 }
  },

  // 어드민용 — 강의의 모든 사용자 발송 현황 조회
  async listRuns(params: {
    scheduleId?: number
    userId?: string
    status?: string
    limit?: number
  }): Promise<WebhookScheduleRun[]> {
    let q = supabase.from('webhook_schedule_runs').select('*').order('fire_at', { ascending: false })
    if (params.scheduleId) q = q.eq('webhook_schedule_id', params.scheduleId)
    if (params.userId) q = q.eq('user_id', params.userId)
    if (params.status) q = q.eq('status', params.status)
    q = q.limit(params.limit ?? 100)
    const { data } = await q
    return (data as WebhookScheduleRun[] | null) ?? []
  },
}
