// 토스 링크페이 상품 목록 조회 — 어드민이 productKey 를 직접 찾지 않고 상품을 골라 매핑하도록.
// 관리자 인증을 확인한 뒤, 토스 API 로 상점의 링크페이 상품 전체를 가져와 반환한다.
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
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    if ((profile as { role?: string } | null)?.role !== 'admin') {
      return json({ error: '관리자 권한이 필요합니다.' }, 403)
    }

    const secret = Deno.env.get('TOSS_LINKPAY_SECRET_KEY')
    if (!secret) return json({ error: '링크페이 시크릿 키가 설정되지 않았습니다.' }, 500)
    const tossAuth = `Basic ${btoa(`${secret}:`)}`

    // 페이지를 끝까지 순회해 전체 상품 수집
    const products: { productKey: string; name: string; amount: number; url: string | null }[] = []
    for (let page = 1; page <= 30; page++) {
      const res = await fetch(`https://api.tosspayments.com/v1/products?page=${page}&size=50`, {
        headers: { Authorization: tossAuth },
      })
      if (!res.ok) {
        if (page === 1) return json({ error: `토스 상품 조회 실패 (${res.status})` }, 502)
        break
      }
      const list = await res.json()
      if (!Array.isArray(list) || list.length === 0) break
      for (const p of list) {
        products.push({
          productKey: p.productKey,
          name: p.name ?? '',
          amount: p.amount ?? 0,
          url: p.url ?? null,
        })
      }
      if (list.length < 50) break
    }

    return json({ products })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : '알 수 없는 오류' }, 500)
  }
})
