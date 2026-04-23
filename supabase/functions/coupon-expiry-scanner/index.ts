// 쿠폰 만료 임박/만료 알림 스캐너 — pg_cron이 매일 1회 호출
// D-3, D-1, D-day 도래한 쿠폰 claims에 대해 사용자에게 webhook 발사
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface CouponClaimRow {
  id: number
  coupon_id: number
  user_id: string
  claimed_at: string
  used_at: string | null
}

interface CouponRow {
  id: number
  title: string
  discount_type: 'fixed' | 'percent'
  discount_value: number
  expires_at: string | null
  use_days: number | null
}

interface ProfileRow {
  id: string
  name: string | null
  phone: string | null
  email: string | null
}

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function effectiveExpiry(coupon: CouponRow, claim: CouponClaimRow): Date | null {
  if (coupon.expires_at) {
    return new Date(coupon.expires_at)
  }
  if (coupon.use_days != null) {
    const claimedAt = new Date(claim.claimed_at)
    return new Date(claimedAt.getTime() + coupon.use_days * 86400_000)
  }
  return null
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const token = authHeader.replace('Bearer ', '')
    if (token !== serviceKey) {
      const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '')
      const { data: { user } } = await userClient.auth.getUser(token)
      if (!user) {
        return new Response(JSON.stringify({ error: 'Invalid auth' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const adminCheck = createClient(supabaseUrl, serviceKey)
      const { data: prof } = await adminCheck.from('profiles').select('role').eq('id', user.id).maybeSingle()
      if ((prof as { role?: string } | null)?.role !== 'admin') {
        return new Response(JSON.stringify({ error: 'Admin only' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    const supabase = createClient(supabaseUrl, serviceKey)
    const today = startOfDay(new Date())
    const tomorrow = new Date(today.getTime() + 86400_000)
    const dayAfterTomorrow = new Date(today.getTime() + 2 * 86400_000)
    const threeDaysLater = new Date(today.getTime() + 3 * 86400_000)
    const fourDaysLater = new Date(today.getTime() + 4 * 86400_000)

    // 미사용 클레임 조회 (배치)
    const { data: claims } = await supabase
      .from('coupon_claims')
      .select('id, coupon_id, user_id, claimed_at, used_at')
      .is('used_at', null)
      .limit(5000)

    const claimList = (claims as CouponClaimRow[] | null) ?? []
    if (claimList.length === 0) {
      return new Response(JSON.stringify({ scanned: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 쿠폰 정보 일괄 조회
    const couponIds = Array.from(new Set(claimList.map((c) => c.coupon_id)))
    const { data: coupons } = await supabase.from('coupons').select('*').in('id', couponIds)
    const couponMap = new Map<number, CouponRow>(((coupons as CouponRow[] | null) ?? []).map((c) => [c.id, c]))

    // 사용자 프로필 일괄 조회
    const userIds = Array.from(new Set(claimList.map((c) => c.user_id)))
    const { data: profiles } = await supabase.from('profiles').select('id, name, phone, email').in('id', userIds)
    const profileMap = new Map<string, ProfileRow>(((profiles as ProfileRow[] | null) ?? []).map((p) => [p.id, p]))

    // 이미 발송한 알림 조회 (claim_id × notification_code)
    const { data: alreadySent } = await supabase
      .from('coupon_notification_log')
      .select('coupon_claim_id, notification_code')
      .in('coupon_claim_id', claimList.map((c) => c.id))
    const sentSet = new Set<string>(((alreadySent as Array<{ coupon_claim_id: number; notification_code: string }> | null) ?? []).map((x) => `${x.coupon_claim_id}:${x.notification_code}`))

    // 발송 대상 분류
    const targets: Array<{ claim: CouponClaimRow; code: string }> = []

    for (const claim of claimList) {
      const coupon = couponMap.get(claim.coupon_id)
      if (!coupon) continue
      const expiry = effectiveExpiry(coupon, claim)
      if (!expiry) continue
      const expiryDay = startOfDay(expiry)

      // D-3: expiry가 오늘+3일
      if (expiryDay.getTime() === threeDaysLater.getTime() && !sentSet.has(`${claim.id}:coupon_expiring_d3`)) {
        targets.push({ claim, code: 'coupon_expiring_d3' })
      }
      // D-1: expiry가 오늘+1일
      if (expiryDay.getTime() === tomorrow.getTime() && !sentSet.has(`${claim.id}:coupon_expiring_d1`)) {
        targets.push({ claim, code: 'coupon_expiring_d1' })
      }
      // 만료: expiry가 오늘
      if (expiryDay.getTime() === today.getTime() && !sentSet.has(`${claim.id}:coupon_expired`)) {
        targets.push({ claim, code: 'coupon_expired' })
      }
    }

    // 사용 안 됨 변수 — 향후 다른 시점 추가 시 대비
    void dayAfterTomorrow
    void fourDaysLater

    // 발사
    let sent = 0
    let failed = 0

    for (const t of targets) {
      const coupon = couponMap.get(t.claim.coupon_id)!
      const profile = profileMap.get(t.claim.user_id)
      if (!profile?.phone) continue // 전화번호 없으면 스킵

      const expiry = effectiveExpiry(coupon, t.claim)!
      const payload = {
        ITEM1: profile.name ?? '',
        ITEM2: profile.phone,
        ITEM2_NOH: profile.phone.replace(/-/g, ''),
        TITLE: coupon.title,
        name: profile.name ?? '',
        user_name: profile.name ?? '',
        phone: profile.phone,
        user_phone: profile.phone,
        email: profile.email ?? '',
        user_email: profile.email ?? '',
        title: coupon.title,
        coupon_name: coupon.title,
        coupon_value: coupon.discount_type === 'percent' ? `${coupon.discount_value}%` : `${coupon.discount_value.toLocaleString()}원`,
        expires_at: expiry.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }),
        DATE: new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }),
        TIME: new Date().toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false }),
      }

      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/webhook-send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            event: 'custom',
            custom_event_code: t.code,
            scope: 'coupon',
            scope_id: coupon.id,
            user_id: t.claim.user_id,
            payload,
          }),
        })
        const data = await res.json().catch(() => ({}))
        const ok = data.status === 'success'
        if (ok) sent++; else failed++

        // 중복 방지 기록
        await supabase.from('coupon_notification_log').insert({
          coupon_claim_id: t.claim.id,
          user_id: t.claim.user_id,
          notification_code: t.code,
          webhook_log_id: data.log_id ?? null,
        } as never)
      } catch {
        failed++
      }
    }

    return new Response(JSON.stringify({ scanned: claimList.length, candidates: targets.length, sent, failed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
