// 템플릿 변수명 분석 — {#이름#}, {#모임명#} 등 임의 변수를 canonical 키로 매핑 제안
// OpenAI gpt-5.4-mini 사용 (저장 시점에 1회 호출, 발송 시 LLM 호출 없음)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// 하드코딩 딕셔너리가 이미 커버하는 변수들 (LLM 호출 불필요)
// webhookService.buildDataDict + webhook-schedule-runner.data 와 동기화 필수
const KNOWN_VARS = new Set([
  // 기본
  'event',
  // 타이틀/아이템 (디비카트 스타일)
  'TITLE', 'title', 'ITEM1', 'ITEM2', 'ITEM2_NOH', 'DBNO', 'MOBILE', 'IP', 'AGENT', 'REFERER',
  // 현재 시각
  'DATE', 'TIME', 'TIMES', 'date', 'time', 'times', 'timestamp',
  // 수업 진행 일시 (schedules.scheduled_at 기반)
  'SCHEDULED_AT', 'SCHEDULED_DATE', 'SCHEDULED_TIME', 'SCHEDULED_DATETIME',
  'scheduled_date', 'scheduled_time', 'scheduled_datetime',
  // 강의 오픈/마감일시 (courses)
  'ENROLLMENT_START', 'ENROLLMENT_START_DATE', 'ENROLLMENT_START_TIME', 'enrollment_start_datetime',
  'ENROLLMENT_DEADLINE', 'ENROLLMENT_DEADLINE_DATE', 'ENROLLMENT_DEADLINE_TIME', 'enrollment_deadline_datetime',
  // 사용자
  'name', 'user_name', 'phone', 'user_phone', 'email', 'user_email',
  'gender', 'address', 'birth_date', 'provider', 'GROUP', 'NICK',
  // 강의/전자책
  'instructor', 'instructor_name', 'course_url', 'course_link', 'URL', 'price', 'type',
  // 쿠폰/포인트
  'coupon_name', 'coupon_value', 'expires_at', 'point_amount', 'point_balance',
  // UTM
  'U_SO', 'U_ME', 'U_CA', 'U_CO', 'U_TE',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
  // 한글 — 사용자
  '이름', '고객명', '회원명', '성함',
  '연락처', '전화번호', '핸드폰번호',
  '이메일',
  // 한글 — 강사/상품
  '강사명', '강사', '선생님',
  '강의명', '강의제목', '모임명', '모임', '수업명', '상품명', '서비스명', '클래스명',
  // 한글 — 수업 진행 일시
  '일시', '모임일시', '강의일시', '수업일시', '예정일시',
  '날짜', '시간',
  '강의날짜', '강의시간', '수업날짜', '수업시간', '예정일', '예정시간',
  // 한글 — 오픈/마감일시
  '오픈일시', '오픈날짜', '오픈시간',
  '마감일시', '마감일', '마감시간',
  // 한글 — 기타
  '링크', 'URL주소',
  '가격', '금액', '포인트', '잔액', '쿠폰명', '쿠폰값', '유효기간',
])

// canonical 키 목록 (LLM이 매핑 대상으로 선택할 수 있는 키)
const CANONICAL_KEYS = [
  { key: 'TITLE', desc: '강의/전자책/쿠폰 제목' },
  { key: 'instructor_name', desc: '강사 이름' },
  { key: 'course_url', desc: '강의/전자책 페이지 URL' },
  { key: 'price', desc: '가격' },
  { key: 'user_name', desc: '구매자 이름' },
  { key: 'user_phone', desc: '구매자 전화번호 (하이픈 포함)' },
  { key: 'ITEM2_NOH', desc: '전화번호 (하이픈 제거, 01012345678)' },
  { key: 'user_email', desc: '이메일' },
  { key: 'ENROLLMENT_START', desc: '강의 오픈일시 (courses.enrollment_start)' },
  { key: 'ENROLLMENT_DEADLINE', desc: '강의 마감일시 (courses.enrollment_deadline)' },
  { key: 'SCHEDULED_DATETIME', desc: '수업 진행 일시 — 전체 (2026년 4월 24일 19:30)' },
  { key: 'SCHEDULED_DATE', desc: '수업 진행 날짜 (2026.04.24)' },
  { key: 'SCHEDULED_TIME', desc: '수업 진행 시간 (19:30)' },
  { key: 'coupon_name', desc: '쿠폰 이름' },
  { key: 'coupon_value', desc: '쿠폰 할인값' },
  { key: 'expires_at', desc: '쿠폰/상품 만료일' },
  { key: 'point_amount', desc: '포인트 충전 금액' },
  { key: 'point_balance', desc: '포인트 잔액' },
  { key: 'DBNO', desc: '발송 고유번호' },
]

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { template } = await req.json() as { template: string }
    if (!template || typeof template !== 'string') {
      return new Response(JSON.stringify({ unknown_vars: [], suggested_aliases: {}, empty_slots: [], suggested_slot_fills: {} }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    // 관리자 인증 (service_role 토큰 또는 admin 사용자)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const token = authHeader.replace('Bearer ', '')
    let isServiceRole = token === serviceKey
    if (!isServiceRole) {
      try {
        const probeRes = await fetch(`${supabaseUrl}/auth/v1/admin/users?page=1&per_page=1`, {
          headers: { 'Authorization': `Bearer ${token}`, 'apikey': token },
        })
        if (probeRes.ok) isServiceRole = true
      } catch { /* ignore */ }
    }
    if (!isServiceRole) {
      try {
        const userClient = createClient(supabaseUrl, anonKey)
        const { data: { user } } = await userClient.auth.getUser(token)
        if (!user) {
          return new Response(JSON.stringify({ error: 'Invalid auth' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }
        const admin = createClient(supabaseUrl, serviceKey)
        const { data: prof } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle()
        if ((prof as { role?: string } | null)?.role !== 'admin') {
          return new Response(JSON.stringify({ error: 'Admin only' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }
      } catch (authErr) {
        return new Response(JSON.stringify({ error: 'Auth error: ' + (authErr instanceof Error ? authErr.message : String(authErr)) }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // 1) 템플릿에서 {#...#} 변수 전부 추출 (한글 포함)
    const foundVars = new Set<string>()
    const re = /\{#([^#\s]+)#\}/g
    let m: RegExpExecArray | null
    while ((m = re.exec(template)) !== null) {
      foundVars.add(m[1])
    }
    // 기본 딕셔너리에 이미 있는 변수는 제외
    const unknownVars = Array.from(foundVars).filter((v) => !KNOWN_VARS.has(v))

    // 2) 빈 "variables.X" 슬롯 감지 (shoong JSON에서 값이 ""인 것)
    //    예: "variables.고객명":"" → 고객명 key를 의미 기반으로 자동 채움 제안
    const emptySlots: string[] = []
    const emptyRe = /"variables\.([^"]+)"\s*:\s*""/g
    let em: RegExpExecArray | null
    while ((em = emptyRe.exec(template)) !== null) {
      emptySlots.push(em[1])
    }

    // 주의: custom canonical 필터링은 뒤에서 adminClient로 DB 조회 후 수행

    // DB에서 활성 키 풀 로드 (라운드로빈용) — service_role로 검증된 토큰 사용
    const adminClient = createClient(supabaseUrl, isServiceRole ? token : serviceKey)
    const { data: keyRows } = await adminClient
      .from('openai_api_keys')
      .select('id, api_key, use_count')
      .eq('enabled', true)
      .order('use_count', { ascending: true })  // 사용 횟수 적은 키부터
      .order('last_used_at', { ascending: true, nullsFirst: true })
    const keyPool = (keyRows as Array<{ id: number; api_key: string; use_count: number }> | null) ?? []

    // 사용자 정의 canonical 변수 — GPT 매핑 후보 + KNOWN_VARS에 포함
    let customCanonicals: Array<{ key: string; value: string; description: string }> = []
    try {
      const { data: cvs } = await adminClient.from('custom_canonical_vars').select('key, value, description')
      customCanonicals = (cvs as Array<{ key: string; value: string; description: string }> | null) ?? []
    } catch { /* noop */ }
    // 이미 custom 변수로 등록된 키가 템플릿에 {#key#}로 쓰였다면 unknownVars에서 제외
    const customKeySet = new Set(customCanonicals.map((c) => c.key))
    const filteredUnknownVars = unknownVars.filter((v) => !customKeySet.has(v))

    // 필터링 후 분석할 게 하나도 없으면 조기 반환
    if (filteredUnknownVars.length === 0 && emptySlots.length === 0) {
      return new Response(JSON.stringify({ unknown_vars: [], suggested_aliases: {}, empty_slots: [], suggested_slot_fills: {} }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    // DB에 없으면 환경변수 fallback
    const envKey = Deno.env.get('OPENAI_API_KEY')
    if (keyPool.length === 0 && !envKey) {
      return new Response(JSON.stringify({
        unknown_vars: filteredUnknownVars,
        suggested_aliases: {},
        empty_slots: emptySlots,
        suggested_slot_fills: {},
        warning: 'OpenAI API 키가 등록되지 않았습니다. 어드민 → 웹훅 → GPT 키 관리에서 추가해주세요.',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // GPT-5.4-mini 호출 (structured output)
    // 빌트인 + 사용자 정의 canonical 키를 GPT에 함께 제공
    const allCanonicalKeys = [
      ...CANONICAL_KEYS.map((c) => ({ key: c.key, desc: c.desc })),
      ...customCanonicals.map((c) => ({
        key: c.key,
        desc: c.description || `사용자 정의: ${c.value.slice(0, 60)}`,
      })),
    ]
    const canonicalKeyEnum = [...allCanonicalKeys.map((c) => c.key), null]

    const systemPrompt = `당신은 한국어 카카오 알림톡 템플릿 분석 도우미입니다. 두 가지 작업을 수행합니다:

1. 미확인 변수({#X#} 형태)를 canonical 키로 매핑: 사용자가 쓴 임의 변수명(예: {#모임명#})을 아래 canonical 키 목록의 적절한 키로 매핑.

2. 빈 variables.X 슬롯 채움 제안: shoong 템플릿의 "variables.고객명":"" 같이 값이 비어있는 것을 의미 기반으로 canonical 키 참조(예: {#user_name#})로 채움 제안.

명확한 매핑이 없으면 null 반환 (절대 추측 금지).

Canonical 키 목록:
${allCanonicalKeys.map((c) => `- ${c.key}: ${c.desc}`).join('\n')}`

    const userPrompt = `미확인 변수: ${JSON.stringify(filteredUnknownVars)}
빈 슬롯 (variables.X 형태, X가 key): ${JSON.stringify(emptySlots)}

각각에 대해 가장 적합한 canonical 키를 반환해주세요.`

    const requestBody = JSON.stringify({
      model: 'gpt-5.4-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'template_analysis',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              alias_mappings: {
                type: 'array',
                description: '미확인 {#X#} 변수 → canonical 키 매핑',
                items: {
                  type: 'object',
                  properties: {
                    variable: { type: 'string' },
                    canonical: { type: ['string', 'null'], enum: canonicalKeyEnum },
                    reason: { type: 'string' },
                  },
                  required: ['variable', 'canonical', 'reason'],
                  additionalProperties: false,
                },
              },
              slot_fills: {
                type: 'array',
                description: '빈 "variables.X":"" 슬롯에 채울 canonical 키',
                items: {
                  type: 'object',
                  properties: {
                    slot: { type: 'string' },
                    canonical: { type: ['string', 'null'], enum: canonicalKeyEnum },
                    reason: { type: 'string' },
                  },
                  required: ['slot', 'canonical', 'reason'],
                  additionalProperties: false,
                },
              },
            },
            required: ['alias_mappings', 'slot_fills'],
            additionalProperties: false,
          },
        },
      },
    })

    // 풀의 키를 순회하며 첫 성공 응답 사용
    const tryKeys: Array<{ id: number | null; key: string }> = keyPool.map((k) => ({ id: k.id, key: k.api_key }))
    if (envKey) tryKeys.push({ id: null, key: envKey })  // env fallback

    let res: Response | null = null
    let lastErrText = ''
    let usedKeyId: number | null = null
    for (const k of tryKeys) {
      try {
        const r = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${k.key}`,
            'Content-Type': 'application/json',
          },
          body: requestBody,
        })
        if (r.ok) {
          res = r
          usedKeyId = k.id
          break
        }
        // 429/401/403 등은 다음 키로 폴백
        lastErrText = await r.text().catch(() => `HTTP ${r.status}`)
        if (k.id !== null) {
          try {
            await adminClient.from('openai_api_keys').update({
              last_error_at: new Date().toISOString(),
              last_error_message: `HTTP ${r.status}: ${lastErrText.slice(0, 300)}`,
            } as never).eq('id', k.id)
            await adminClient.rpc('increment_openai_key_error', { p_id: k.id } as never)
          } catch { /* noop */ }
        }
      } catch (e) {
        lastErrText = e instanceof Error ? e.message : String(e)
      }
    }

    if (!res) {
      return new Response(JSON.stringify({
        unknown_vars: unknownVars,
        suggested_aliases: {},
        empty_slots: emptySlots,
        suggested_slot_fills: {},
        warning: `OpenAI API 호출 실패 (모든 키 시도함): ${lastErrText.slice(0, 200)}`,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 성공한 키의 사용 횟수 업데이트
    if (usedKeyId !== null) {
      try { await adminClient.rpc('increment_openai_key_use', { p_id: usedKeyId } as never) } catch { /* noop */ }
    }

    const data = await res.json()
    const content = data?.choices?.[0]?.message?.content ?? '{}'
    let parsed: {
      alias_mappings: Array<{ variable: string; canonical: string | null; reason: string }>
      slot_fills: Array<{ slot: string; canonical: string | null; reason: string }>
    }
    try {
      parsed = JSON.parse(content)
    } catch {
      parsed = { alias_mappings: [], slot_fills: [] }
    }

    const suggestedAliases: Record<string, { canonical: string; reason: string }> = {}
    for (const m of parsed.alias_mappings ?? []) {
      if (m.canonical) {
        suggestedAliases[m.variable] = { canonical: m.canonical, reason: m.reason }
      }
    }
    const suggestedSlotFills: Record<string, { canonical: string; reason: string }> = {}
    for (const s of parsed.slot_fills ?? []) {
      if (s.canonical) {
        suggestedSlotFills[s.slot] = { canonical: s.canonical, reason: s.reason }
      }
    }

    return new Response(JSON.stringify({
      unknown_vars: filteredUnknownVars,
      suggested_aliases: suggestedAliases,
      empty_slots: emptySlots,
      suggested_slot_fills: suggestedSlotFills,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    // 예외가 터져도 저장 흐름은 막지 않도록 200 + warning 반환
    const msg = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err)
    console.error('webhook-template-analyze error:', msg)
    return new Response(JSON.stringify({
      unknown_vars: [],
      suggested_aliases: {},
      empty_slots: [],
      suggested_slot_fills: {},
      warning: `분석 실패: ${msg.slice(0, 300)}`,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
