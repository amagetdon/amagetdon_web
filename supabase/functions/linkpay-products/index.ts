// 토스 링크페이 상품 목록 조회 — 어드민이 productKey 를 직접 찾지 않고 상품을 골라 매핑하도록.
//
// 두 종류를 모두 모아서 반환한다:
//  - 개인결제창: 공개 API GET /v1/products (시크릿 키 Basic 인증, 쿠키 불필요)
//  - 판매상품:  토스 대시보드 내부 API (로그인 세션 쿠키 필요 — linkpay_config 에 저장된 값 사용)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const MERCHANT_ID = '1268738'
const MID = 'link_amagcdwao'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

interface Product {
  productKey: string
  name: string
  amount: number
  thumbnail: string | null
  status: string | null
  createdAt: string | null
  kind: '판매상품' | '개인결제창'
}

// 개인결제창 — 공개 API (시크릿 키)
async function fetchPersonalProducts(): Promise<Product[]> {
  const secret = Deno.env.get('TOSS_LINKPAY_SECRET_KEY')
  if (!secret) return []
  const auth = `Basic ${btoa(`${secret}:`)}`
  const out: Product[] = []
  let startingAfter = ''
  for (let i = 0; i < 30; i++) {
    const url = `https://api.tosspayments.com/v1/products?limit=100${startingAfter ? `&startingAfter=${startingAfter}` : ''}`
    const res = await fetch(url, { headers: { Authorization: auth } })
    if (!res.ok) break
    const list = await res.json() as Array<Record<string, unknown>>
    if (!Array.isArray(list) || list.length === 0) break
    for (const p of list) {
      const img = p.mainImage as { thumbnailPath?: string; path?: string } | undefined
      out.push({
        productKey: String(p.productKey ?? ''),
        name: String(p.name ?? ''),
        amount: Number(p.amount ?? 0),
        thumbnail: img?.thumbnailPath ?? img?.path ?? null,
        status: (p.status as string) ?? null,
        createdAt: (p.createdAt as string) ?? null,
        kind: '개인결제창',
      })
    }
    if (list.length < 100) break
    startingAfter = String(list[list.length - 1].productKey ?? '')
    if (!startingAfter) break
  }
  return out
}

// 판매상품 — 대시보드 내부 API (세션 쿠키)
async function fetchSalesProducts(cookie: string): Promise<Product[]> {
  const out: Product[] = []
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
      if (page === 1) throw new Error(`SALES_${res.status}`)
      break
    }
    const body = await res.json() as { data?: { contents?: Array<Record<string, unknown>>; hasNext?: boolean } }
    const contents = body?.data?.contents ?? []
    for (const p of contents) {
      if (!p.id) continue
      const img = p.mainImage as { thumbnailPath?: string; path?: string } | undefined
      out.push({
        productKey: String(p.id),
        name: String(p.title ?? ''),
        amount: Number(p.amount ?? 0),
        thumbnail: img?.thumbnailPath ?? img?.path ?? null,
        status: (p.status as string) ?? null,
        createdAt: (p.createdAt as string) ?? null,
        kind: '판매상품',
      })
    }
    if (!body?.data?.hasNext) break
  }
  return out
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
    const cookie = (cfg as { dashboard_cookie?: string } | null)?.dashboard_cookie ?? ''

    // 개인결제창은 항상, 판매상품은 쿠키가 있을 때만
    const products: Product[] = []
    let salesWarning: string | null = null

    try {
      products.push(...await fetchPersonalProducts())
    } catch { /* 개인결제창 조회 실패는 무시 */ }

    if (cookie) {
      try {
        products.push(...await fetchSalesProducts(cookie))
      } catch (e) {
        const m = e instanceof Error ? e.message : ''
        salesWarning = m.startsWith('SALES_')
          ? '판매상품 조회 실패 — 대시보드 쿠키가 만료됐을 수 있습니다. 쿠키를 다시 저장해 주세요.'
          : '판매상품 조회 중 오류가 발생했습니다.'
      }
    } else {
      salesWarning = '판매상품을 보려면 토스 대시보드 쿠키를 저장해 주세요. (개인결제창은 쿠키 없이 조회됨)'
    }

    return json({ products, salesWarning })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : '알 수 없는 오류' }, 500)
  }
})
