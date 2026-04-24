// 비회원 구매용 간소 가입 — Supabase Admin API 로 email_confirm 을 즉시 true 처리하여
// 일반 signUp 에서 요구되는 이메일 인증 단계를 건너뛴다.
// 이후 클라이언트에서 signInWithPassword 로 바로 로그인되도록 한다.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json() as {
      email: string
      password: string
      name: string
      phone: string
      signup_referrer?: string
    }

    const { email, password, name, phone, signup_referrer } = body

    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'email and password required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(supabaseUrl, serviceKey)

    // 1) 유저 생성 — email_confirm: true 로 인증 단계 skip
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        phone,
        provider: 'guest',
        signup_referrer: signup_referrer ?? null,
      },
    })

    if (createErr) {
      const msg = createErr.message || ''
      if (/already|registered|exists|duplicate|registered/i.test(msg)) {
        return new Response(JSON.stringify({ error: 'ALREADY_REGISTERED' }), {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      return new Response(JSON.stringify({ error: msg }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userId = created.user?.id
    if (!userId) {
      return new Response(JSON.stringify({ error: 'createUser returned no user' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2) profiles 에 provider='guest' 및 name/phone 명시적 저장
    //    (handle_new_user 트리거가 메타데이터에서 이미 name/phone 은 복사해도 provider 는 별도)
    try {
      await admin.from('profiles').update({
        name,
        phone,
        provider: 'guest',
        signup_referrer: signup_referrer ?? null,
      } as never).eq('id', userId)
    } catch { /* 트리거가 아직 안 돌았다면 업데이트가 insert 되지 않을 수 있음 — 무시 */ }

    return new Response(JSON.stringify({ user_id: userId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
