import { supabase } from '../lib/supabase'

// 랜딩 '자료로 초안 만들기' — 서버 함수(/api/landing-agent) 호출과, 강의별 자료 보관(course_landing_materials).

export interface LibraryImage { label: string; url: string }
export interface RefFile { name: string; media_type: string; data: string }
export interface AgentUsage { cost_usd: number; input_tokens: number; output_tokens: number; model: string }

export interface AgentRequest {
  type: 'free' | 'paid'
  spec: string
  facts: unknown
  sections: unknown
  notes: string
  library: LibraryImage[]
  refs: RefFile[]
  /** 다시 만들 범위를 설명하는 글 (비우면 전체) */
  scope: string
  instruction: string
}

export const landingAgentService = {
  /** 초안을 만든다. 진행 상황은 onProgress 로, 결과(JSON)와 사용량은 반환값으로. 실패하면 한국어 메시지로 throw. */
  async generate(req: AgentRequest, onProgress: (message: string) => void): Promise<{ result: unknown; usage: AgentUsage | null }> {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/landing-agent', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${session?.access_token ?? ''}` },
      body: JSON.stringify(req),
    })
    if (!res.ok || !res.body) {
      const body = await res.json().catch(() => ({})) as { error?: string }
      throw new Error(body.error || (res.status === 413 ? '자료가 너무 큽니다. 참고 자료 수를 줄여 주세요.' : `요청 실패 (HTTP ${res.status})`))
    }

    // 한 줄에 JSON 하나씩 흘러온다
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let result: unknown = undefined
    let usage: AgentUsage | null = null
    let error: string | null = null
    const handle = (line: string) => {
      if (!line.trim()) return
      let ev: Record<string, unknown>
      try { ev = JSON.parse(line) as Record<string, unknown> } catch { return }
      if (ev.type === 'status' && typeof ev.message === 'string') onProgress(ev.message)
      else if (ev.type === 'progress' && typeof ev.chars === 'number') onProgress(`초안을 쓰고 있습니다… (${ev.chars.toLocaleString('ko-KR')}자)`)
      else if (ev.type === 'result') result = ev.result
      else if (ev.type === 'error' && typeof ev.message === 'string') error = ev.message
      else if (ev.type === 'done') {
        const u = (ev.usage ?? {}) as Record<string, unknown>
        usage = { cost_usd: Number(ev.cost_usd ?? 0), input_tokens: Number(u.input_tokens ?? 0) + Number(u.cache_read_input_tokens ?? 0) + Number(u.cache_creation_input_tokens ?? 0), output_tokens: Number(u.output_tokens ?? 0), model: String(ev.model ?? '') }
      }
    }
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      lines.forEach(handle)
    }
    handle(buffer)
    if (error) throw new Error(error)
    if (result === undefined) throw new Error('결과를 받지 못했습니다. 다시 시도해 주세요.')
    return { result, usage }
  },

  /** 보관해 둔 자료(메모·랜딩에 쓸 그림). 표가 없거나 권한이 없으면 null. */
  async loadMaterials(courseId: number): Promise<{ notes: string; images: LibraryImage[] } | null> {
    const { data, error } = await supabase.from('course_landing_materials' as never).select('notes, images').eq('course_id', courseId).maybeSingle()
    if (error || !data) return null
    const row = data as { notes?: unknown; images?: unknown }
    const images = (Array.isArray(row.images) ? row.images : [])
      .filter((x): x is LibraryImage => !!x && typeof x === 'object' && typeof (x as LibraryImage).url === 'string')
      .map((x) => ({ label: String(x.label ?? ''), url: x.url }))
    return { notes: typeof row.notes === 'string' ? row.notes : '', images }
  },

  /** 자료 보관. 실패 여부를 돌려준다(보관이 안 돼도 초안 만들기는 계속할 수 있다). */
  async saveMaterials(courseId: number, notes: string, images: LibraryImage[]): Promise<boolean> {
    const { error } = await supabase.from('course_landing_materials' as never)
      .upsert({ course_id: courseId, notes, images, updated_at: new Date().toISOString() } as never, { onConflict: 'course_id' })
    return !error
  },
}
