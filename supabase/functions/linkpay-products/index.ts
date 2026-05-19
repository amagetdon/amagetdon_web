// 토스 링크페이 상품 갱신 — 신규 상품만 추가로 조회해 캐시(linkpay_products)에 저장.
//
// /v1/products 는 오래된순(createdAt 오름차순)으로 응답한다. 캐시에 저장된 가장 최근 상품의
// productKey 를 startingAfter 커서로 넘기면 그 이후 생성된 신규 상품만 받아온다.
// (캐시가 비어 있으면 전체 조회) 갱신 후 캐시 전체를 반환한다.
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

interface CacheRow {
  product_key: string
  name: string
  amount: number
  thumbnail: string | null
  status: string | null
  toss_created_at: string | null
}

// 토스에서 startingAfter 이후 신규 상품을 모두 받아온다
async function fetchNewProducts(secret: string, startCursor: string): Promise<CacheRow[]> {
  const auth = `Basic ${btoa(`${secret}:`)}`
  const out: CacheRow[] = []
  let startingAfter = startCursor
  for (let i = 0; i < 50; i++) {
    const url = `https://api.tosspayments.com/v1/products?limit=100${startingAfter ? `&startingAfter=${startingAfter}` : ''}`
    const res = await fetch(url, { headers: { Authorization: auth } })
    if (!res.ok) {
      if (i === 0 && !startCursor) throw new Error(`토스 상품 조회 실패 (${res.status})`)
      break
    }
    const list = await res.json() as Array<Record<string, unknown>>
    if (!Array.isArray(list) || list.length === 0) break
    for (const p of list) {
      const img = p.mainImage as { path?: string; thumbnailPath?: string } | undefined
      out.push({
        product_key: String(p.productKey ?? ''),
        name: String(p.name ?? ''),
        amount: Number(p.amount ?? 0),
        thumbnail: img?.thumbnailPath ?? img?.path ?? null,
        status: (p.status as string) ?? null,
        toss_created_at: (p.createdAt as string) ?? null,
      })
    }
    if (list.length < 100) break
    startingAfter = String(list[list.length - 1].productKey ?? '')
    if (!startingAfter) break
  }
  return out
}

async function loadCache(supabase: SupabaseClient): Promise<CacheRow[]> {
  const { data } = await supabase
    .from('linkpay_products')
    .select('product_key, name, amount, thumbnail, status, toss_created_at')
    .order('toss_created_at', { ascending: false, nullsFirst: false })
  return (data ?? []) as CacheRow[]
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // full=true 면 전체 재동기화 (캐시 비우고 전체 재조회), 아니면 신규만
    let full = false
    try {
      const body = await req.json()
      full = !!(body && (body as { full?: boolean }).full)
    } catch { /* 본문 없음 — 신규만 */ }

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

    const secret = Deno.env.get('TOSS_LINKPAY_SECRET_KEY')
    if (!secret) return json({ error: '링크페이 시크릿 키가 설정되지 않았습니다.' }, 500)

    // 신규만: 캐시 최신 productKey 를 커서로 / 전체: 커서 없이 처음부터
    let cursor = ''
    if (!full) {
      const { data: latest } = await supabase
        .from('linkpay_products')
        .select('product_key')
        .order('toss_created_at', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle()
      cursor = (latest as { product_key?: string } | null)?.product_key ?? ''
    }

    const fresh = await fetchNewProducts(secret, cursor)

    // 전체 재동기화: 캐시를 비우고 새로 받은 것으로 교체 (수정·삭제 반영).
    // 단 받아온 게 0건이면 안전하게 캐시를 건드리지 않음.
    if (full && fresh.length > 0) {
      await supabase.from('linkpay_products').delete().neq('product_key', '__none__')
    }
    if (fresh.length > 0) {
      await supabase.from('linkpay_products').upsert(
        fresh.map((p) => ({ ...p, synced_at: new Date().toISOString() })),
        { onConflict: 'product_key' },
      )
    }

    const all = await loadCache(supabase)
    return json({
      full,
      syncedCount: fresh.length,
      products: all.map((r) => ({
        productKey: r.product_key,
        name: r.name,
        amount: r.amount,
        thumbnail: r.thumbnail,
        status: r.status,
        createdAt: r.toss_created_at,
      })),
    })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : '알 수 없는 오류' }, 500)
  }
})
