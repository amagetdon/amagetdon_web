// 토스 링크페이 상품 목록 조회 — 어드민이 productKey 를 직접 찾지 않고 상품을 골라 매핑하도록.
// 토스 대시보드 내부 API 는 로그인 세션 쿠키로만 인증되므로, 어드민이 저장해 둔
// 대시보드 쿠키(linkpay_config.dashboard_cookie)를 사용해 호출한다.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const MERCHANT_ID = '1268738'
const MID = 'link_amagcdwao'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

interface TossProductRaw {
  id?: string
  title?: string
  amount?: number
  status?: string
  paymentLinkId?: string
  createdAt?: string
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: '인증이 필요합니다.' }, 401)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (!user) return json({ error: '유효하지 않은 사용자입니다.' }, 401)
    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).maybeSingle()
    if ((profile as { role?: string } | null)?.role !== 'admin') {
      return json({ error: '관리자 권한이 필요합니다.' }, 403)
    }

    const { data: cfg } = await supabase
      .from('linkpay_config').select('dashboard_cookie').eq('id', 1).maybeSingle()
    const cookie = (cfg as { dashboard_cookie?: string } | null)?.dashboard_cookie
    if (!cookie) {
      return json({ error: '토스 대시보드 쿠키가 설정되지 않았습니다. 어드민에서 쿠키를 먼저 저장해 주세요.' }, 400)
    }

    // 대시보드 내부 API 를 페이지 순회하며 전체 상품 수집
    const products: { productKey: string; name: string; amount: number; paymentLinkId: string | null; status: string | null }[] = []
    for (let page = 1; page <= 30; page++) {
      const res = await fetch(
        `https://homepage-api-gateway.tosspayments.com/linkpay/api/v1/merchants/${MERCHANT_ID}/mids/${MID}/products?page=${page}&size=50`,
        {
          headers: {
            'Cookie': cookie,
            'Accept': 'application/json',
            'Origin': 'https://dashboard.tosspayments.com',
            'Referer': 'https://dashboard.tosspayments.com/',
          },
        },
      )
      if (!res.ok) {
        if (page === 1) {
          return json({ error: `토스 상품 조회 실패 (${res.status}). 대시보드 쿠키가 만료됐을 수 있습니다 — 다시 저장해 주세요.` }, 502)
        }
        break
      }
      const body = await res.json() as { data?: { contents?: TossProductRaw[]; hasNext?: boolean } }
      const contents = body?.data?.contents ?? []
      for (const p of contents) {
        if (!p.id) continue
        products.push({
          productKey: p.id,
          name: p.title ?? '',
          amount: p.amount ?? 0,
          paymentLinkId: p.paymentLinkId ?? null,
          status: p.status ?? null,
        })
      }
      if (!body?.data?.hasNext) break
    }

    return json({ products })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : '알 수 없는 오류' }, 500)
  }
})
