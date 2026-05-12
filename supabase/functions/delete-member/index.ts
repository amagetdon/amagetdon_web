// 관리자 권한으로 회원을 완전 탈퇴 처리. auth.users 에서 사용자 삭제 →
// profiles 와 자식 테이블은 FK CASCADE 설정대로 정리된다.
//
// POST 본문:
//   { user_id: 'uuid' }
//
// 인증: service_role 키 또는 admin 사용자 JWT.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { verifyToken } from '../_shared/auth.ts'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Authorization header missing' }, 401)
    const token = authHeader.replace('Bearer ', '')

    const verified = await verifyToken(token, supabaseUrl, anonKey, serviceKey)
    if (!verified) return json({ error: 'invalid auth' }, 401)

    const admin = createClient(supabaseUrl, serviceKey)

    if (!verified.isServiceRole) {
      const { data: prof } = await admin
        .from('profiles')
        .select('role')
        .eq('id', verified.user!.id)
        .maybeSingle()
      if ((prof as { role?: string } | null)?.role !== 'admin') {
        return json({ error: 'admin only' }, 403)
      }
    }

    const body = await req.json().catch(() => ({})) as { user_id?: string }
    const targetId = body.user_id
    if (!targetId) return json({ error: 'user_id required' }, 400)

    // 자기 자신 삭제는 차단 — 관리자가 실수로 본인 계정을 날리는 사고 방지.
    if (!verified.isServiceRole && verified.user!.id === targetId) {
      return json({ error: '자기 자신은 탈퇴 처리할 수 없습니다.' }, 400)
    }

    const { error } = await admin.auth.admin.deleteUser(targetId)
    if (error) return json({ error: error.message }, 500)

    return json({ status: 'ok' })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})
