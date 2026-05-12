// 관리자가 회원을 즉시 생성. auth.admin.createUser 로 email_confirm 을 true 처리하여
// 이메일 인증 단계를 건너뛰고, profiles 의 이름/전화/추가 정보도 함께 저장한다.
//
// POST 본문:
//   { email, password, name, phone?, gender?, birth_date?, address? }
//
// 인증: service_role 또는 admin 사용자 JWT.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { verifyToken } from '../_shared/auth.ts'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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

    const body = await req.json().catch(() => ({})) as {
      email?: string
      password?: string
      name?: string
      phone?: string
      gender?: string
      birth_date?: string
      address?: string
    }

    const email = (body.email ?? '').trim().toLowerCase()
    const password = body.password ?? ''
    const name = (body.name ?? '').trim()
    const phone = (body.phone ?? '').trim()
    const gender = (body.gender ?? '').trim() || null
    const birthDate = (body.birth_date ?? '').trim() || null
    const address = (body.address ?? '').trim() || null

    if (!email || !EMAIL_RE.test(email)) return json({ error: '이메일 형식이 올바르지 않습니다.' }, 400)
    if (!password || password.length < 6) return json({ error: '비밀번호는 6자 이상이어야 합니다.' }, 400)
    if (!name) return json({ error: '이름을 입력해주세요.' }, 400)
    if (phone) {
      const digits = phone.replace(/\D/g, '')
      if (digits.length < 10 || digits.length > 11) return json({ error: '전화번호 형식이 올바르지 않습니다.' }, 400)
    }

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        phone: phone || null,
        provider: 'email',
      },
    })

    if (createErr) {
      const msg = createErr.message || ''
      if (/already|registered|exists|duplicate/i.test(msg)) {
        return json({ error: '이미 가입된 이메일입니다.' }, 409)
      }
      return json({ error: msg }, 500)
    }

    const userId = created.user?.id
    if (!userId) return json({ error: 'createUser 가 user 를 반환하지 않았습니다.' }, 500)

    // profiles 명시 저장 — 트리거가 row 를 만들었더라도 이름/전화 같은 부가 정보는 update 로 확실히 채움.
    await admin.from('profiles').update({
      name,
      phone: phone || null,
      gender,
      birth_date: birthDate,
      address,
      provider: 'email',
    } as never).eq('id', userId)

    return json({ user_id: userId, email })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})
