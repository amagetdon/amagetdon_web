// 토스 링크페이 상품 목록 조회 — 어드민이 productKey 를 직접 찾지 않고 상품을 골라 매핑하도록.
// 공개 API GET /v1/products (시크릿 키 Basic 인증) 하나로 판매상품·개인결제창 전체가 조회된다.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

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

    const secret = Deno.env.get('TOSS_LINKPAY_SECRET_KEY')
    if (!secret) return json({ error: '링크페이 시크릿 키가 설정되지 않았습니다.' }, 500)
    const tossAuth = `Basic ${btoa(`${secret}:`)}`

    // startingAfter 커서로 전체 상품 순회
    const products: { productKey: string; name: string; amount: number; thumbnail: string | null; status: string | null; createdAt: string | null }[] = []
    let startingAfter = ''
    for (let i = 0; i < 50; i++) {
      const url = `https://api.tosspayments.com/v1/products?limit=100${startingAfter ? `&startingAfter=${startingAfter}` : ''}`
      const res = await fetch(url, { headers: { Authorization: tossAuth } })
      if (!res.ok) {
        if (i === 0) return json({ error: `토스 상품 조회 실패 (${res.status})` }, 502)
        break
      }
      const list = await res.json() as Array<Record<string, unknown>>
      if (!Array.isArray(list) || list.length === 0) break
      for (const p of list) {
        const img = p.mainImage as { path?: string; thumbnailPath?: string } | undefined
        products.push({
          productKey: String(p.productKey ?? ''),
          name: String(p.name ?? ''),
          amount: Number(p.amount ?? 0),
          thumbnail: img?.thumbnailPath ?? img?.path ?? null,
          status: (p.status as string) ?? null,
          createdAt: (p.createdAt as string) ?? null,
        })
      }
      if (list.length < 100) break
      startingAfter = String(list[list.length - 1].productKey ?? '')
      if (!startingAfter) break
    }

    return json({ products })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : '알 수 없는 오류' }, 500)
  }
})
