import { useState, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import AdminLayout from '../../components/admin/AdminLayout'
import { webhookService, type WebhookConfig } from '../../services/webhookService'

const SIGNUP_VARS = [
  { name: '이름', var: '{#name#}', desc: '회원 이름' },
  { name: '이메일', var: '{#email#}', desc: '회원 이메일' },
  { name: '전화번호', var: '{#phone#}', desc: '전화번호 (010-xxxx-xxxx)' },
  { name: '성별', var: '{#gender#}', desc: 'male 또는 female' },
  { name: '주소', var: '{#address#}', desc: '우편번호|주소|상세주소' },
  { name: '생년월일', var: '{#birth_date#}', desc: 'YYYY-MM-DD' },
  { name: '가입방법', var: '{#provider#}', desc: 'email / kakao / google' },
  { name: '날짜', var: '{#date#}', desc: '가입 날짜 (yyyy.mm.dd)' },
  { name: '시간', var: '{#time#}', desc: '가입 시간 (hh:mm)' },
  { name: '타임스탬프', var: '{#timestamp#}', desc: 'ISO 8601 형식' },
]

const UTM_VARS = [
  { name: 'utm_source', var: '{#utm_source#}', desc: '유입 소스' },
  { name: 'utm_medium', var: '{#utm_medium#}', desc: '매체/방식' },
  { name: 'utm_campaign', var: '{#utm_campaign#}', desc: '캠페인명' },
  { name: 'utm_content', var: '{#utm_content#}', desc: '콘텐츠 구분' },
  { name: 'utm_term', var: '{#utm_term#}', desc: '키워드' },
]

const PURCHASE_VARS = [
  { name: '구매자 이메일', var: '{#user_email#}', desc: '구매자 이메일' },
  { name: '구매자 이름', var: '{#user_name#}', desc: '구매자 이름' },
  { name: '구매자 전화번호', var: '{#user_phone#}', desc: '구매자 전화번호' },
  { name: '상품명', var: '{#title#}', desc: '강의/전자책 제목' },
  { name: '결제 금액', var: '{#price#}', desc: '포인트 금액' },
  { name: '상품 유형', var: '{#type#}', desc: 'course 또는 ebook' },
  { name: '날짜', var: '{#date#}', desc: '구매 날짜' },
  { name: '시간', var: '{#time#}', desc: '구매 시간' },
  { name: '타임스탬프', var: '{#timestamp#}', desc: 'ISO 8601 형식' },
]

export default function AdminWebhook() {
  const [config, setConfig] = useState<WebhookConfig>({
    enabled: false,
    url: '',
    method: 'POST',
    events: { signup: true, purchase: true },
    headers: {},
    useTemplate: false,
    signupTemplate: '',
    purchaseTemplate: '',
  })
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [testing, setTesting] = useState(false)
  const [headerKey, setHeaderKey] = useState('')
  const [headerValue, setHeaderValue] = useState('')
  const [templateTab, setTemplateTab] = useState<'signup' | 'purchase'>('signup')
  const signupRef = useRef<HTMLTextAreaElement>(null)
  const purchaseRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    webhookService.getConfig().then((c) => {
      setConfig(c)
      setLoading(false)
    })
  }, [])

  const handleSave = async () => {
    if (config.enabled && !config.url) {
      toast.error('수신 URL을 입력해주세요.')
      return
    }
    setSaving(true)
    try {
      await webhookService.saveConfig(config)
      toast.success('웹훅 설정이 저장되었습니다.')
    } catch {
      toast.error('저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    if (!config.url) { toast.error('수신 URL을 입력해주세요.'); return }
    setTesting(true)
    try {
      const testPayload = {
        event: 'test',
        name: '테스트 유저',
        email: 'test@example.com',
        phone: '010-1234-5678',
        gender: 'male',
        provider: 'email',
        timestamp: new Date().toISOString(),
        date: new Date().toLocaleDateString('ko-KR'),
        time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      }
      const headers: Record<string, string> = { 'Content-Type': 'application/json', ...config.headers }

      if (config.method === 'POST') {
        await fetch(config.url, { method: 'POST', headers, body: JSON.stringify(testPayload), mode: 'no-cors' })
      } else {
        const params = new URLSearchParams(Object.entries(testPayload))
        await fetch(`${config.url}?${params}`, { mode: 'no-cors' })
      }
      toast.success('테스트 전송 완료')
    } catch {
      toast.error('전송에 실패했습니다.')
    } finally {
      setTesting(false)
    }
  }

  const insertVar = (v: string) => {
    const ref = templateTab === 'signup' ? signupRef.current : purchaseRef.current
    const key = templateTab === 'signup' ? 'signupTemplate' : 'purchaseTemplate'
    if (ref) {
      const start = ref.selectionStart
      const end = ref.selectionEnd
      const current = config[key]
      const newVal = current.slice(0, start) + v + current.slice(end)
      setConfig((c) => ({ ...c, [key]: newVal }))
      setTimeout(() => {
        ref.focus()
        ref.selectionStart = ref.selectionEnd = start + v.length
      }, 0)
    } else {
      setConfig((c) => ({ ...c, [key]: c[key] + v }))
    }
  }

  const addHeader = () => {
    if (!headerKey.trim()) return
    setConfig((c) => ({ ...c, headers: { ...c.headers, [headerKey.trim()]: headerValue } }))
    setHeaderKey('')
    setHeaderValue('')
  }

  const removeHeader = (key: string) => {
    setConfig((c) => {
      const h = { ...c.headers }
      delete h[key]
      return { ...c, headers: h }
    })
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <div className="relative mb-6">
            <div className="w-16 h-16 border-4 border-gray-200 rounded-full" />
            <div className="absolute inset-0 w-16 h-16 border-4 border-[#2ED573] border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="text-sm font-bold text-gray-900">설정을 불러오는 중...</p>
        </div>
      </AdminLayout>
    )
  }

  const currentVars = templateTab === 'signup' ? [...SIGNUP_VARS, ...UTM_VARS] : PURCHASE_VARS

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">웹훅 (CRM 연동)</h1>
        <p className="text-sm text-gray-500 mt-1">회원가입, 구매 시 외부 CRM으로 데이터를 자동 전송합니다.</p>
      </div>

      <div className="space-y-5">
        {/* 기본 설정 */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-bold text-gray-900">기본 설정</h2>
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-xs text-gray-500">{config.enabled ? '활성화' : '비활성화'}</span>
              <button
                type="button"
                onClick={() => setConfig((c) => ({ ...c, enabled: !c.enabled }))}
                className={`w-10 h-5 rounded-full relative transition-colors cursor-pointer border-none ${config.enabled ? 'bg-[#2ED573]' : 'bg-gray-300'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform shadow ${config.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </label>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-bold text-gray-700 block mb-1.5">수신 URL</label>
              <input
                value={config.url}
                onChange={(e) => setConfig((c) => ({ ...c, url: e.target.value }))}
                placeholder="https://crm-back.coredev.co.kr/external/schedule/ama"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] font-mono"
              />
            </div>
            <div>
              <label className="text-sm font-bold text-gray-700 block mb-1.5">전송 방식</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setConfig((c) => ({ ...c, method: 'POST' }))}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium border cursor-pointer transition-colors ${config.method === 'POST' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200'}`}>
                  POST
                </button>
                <button type="button" onClick={() => setConfig((c) => ({ ...c, method: 'GET' }))}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium border cursor-pointer transition-colors ${config.method === 'GET' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200'}`}>
                  GET
                </button>
              </div>
            </div>
            <div>
              <label className="text-sm font-bold text-gray-700 block mb-1.5">이벤트 트리거</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={config.events.signup}
                    onChange={(e) => setConfig((c) => ({ ...c, events: { ...c.events, signup: e.target.checked } }))}
                    className="accent-[#2ED573]" />
                  <span className="text-sm text-gray-700">회원가입</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={config.events.purchase}
                    onChange={(e) => setConfig((c) => ({ ...c, events: { ...c.events, purchase: e.target.checked } }))}
                    className="accent-[#2ED573]" />
                  <span className="text-sm text-gray-700">구매</span>
                </label>
              </div>
            </div>
            <div>
              <label className="text-sm font-bold text-gray-700 block mb-1.5">데이터 형식</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setConfig((c) => ({ ...c, useTemplate: false }))}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium border cursor-pointer transition-colors ${!config.useTemplate ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200'}`}>
                  기본 (전체 JSON)
                </button>
                <button type="button" onClick={() => setConfig((c) => ({ ...c, useTemplate: true }))}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium border cursor-pointer transition-colors ${config.useTemplate ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200'}`}>
                  커스텀 템플릿
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 커스텀 헤더 */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-sm font-bold text-gray-900 mb-3">커스텀 헤더 (선택)</h2>
          <div className="flex gap-2 mb-3">
            <input value={headerKey} onChange={(e) => setHeaderKey(e.target.value)}
              placeholder="Header Key" className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2ED573]" />
            <input value={headerValue} onChange={(e) => setHeaderValue(e.target.value)}
              placeholder="Header Value" className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2ED573]" />
            <button onClick={addHeader} className="px-4 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg border-none cursor-pointer hover:bg-gray-200">추가</button>
          </div>
          {Object.entries(config.headers).length > 0 && (
            <div className="space-y-1.5">
              {Object.entries(config.headers).map(([k, v]) => (
                <div key={k} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                  <code className="text-xs text-gray-600 flex-1">{k}: {v}</code>
                  <button onClick={() => removeHeader(k)} className="text-gray-400 hover:text-red-500 bg-transparent border-none cursor-pointer">
                    <i className="ti ti-x text-xs" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 커스텀 템플릿 */}
        {config.useTemplate && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-sm font-bold text-gray-900 mb-1">전달 파라미터 템플릿</h2>
            <p className="text-xs text-gray-400 mb-4">예약어를 사용하여 전달할 데이터 형식을 설정합니다. JSON 또는 key=value&key=value 형식을 사용할 수 있습니다.</p>

            <div className="flex gap-2 mb-3">
              <button onClick={() => setTemplateTab('signup')}
                className={`px-4 py-1.5 rounded-full text-xs font-medium border cursor-pointer transition-colors ${templateTab === 'signup' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200'}`}>
                회원가입
              </button>
              <button onClick={() => setTemplateTab('purchase')}
                className={`px-4 py-1.5 rounded-full text-xs font-medium border cursor-pointer transition-colors ${templateTab === 'purchase' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200'}`}>
                구매
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* 템플릿 에디터 */}
              <div>
                <textarea
                  ref={templateTab === 'signup' ? signupRef : purchaseRef}
                  value={templateTab === 'signup' ? config.signupTemplate : config.purchaseTemplate}
                  onChange={(e) => setConfig((c) => ({ ...c, [templateTab === 'signup' ? 'signupTemplate' : 'purchaseTemplate']: e.target.value }))}
                  placeholder={templateTab === 'signup'
                    ? '예:\n{\n  "이름": "{#name#}",\n  "이메일": "{#email#}",\n  "연락처": "{#phone#}",\n  "유입소스": "{#utm_source#}"\n}'
                    : '예:\n{\n  "구매자": "{#user_name#}",\n  "상품": "{#title#}",\n  "금액": "{#price#}"\n}'}
                  rows={12}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#2ED573] font-mono resize-none"
                />
              </div>

              {/* 예약어 테이블 */}
              <div>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-bold text-gray-600">이름</th>
                        <th className="px-3 py-2 text-left font-bold text-gray-600">예약어</th>
                        <th className="px-3 py-2 text-left font-bold text-gray-600">설명</th>
                        <th className="px-3 py-2 text-center font-bold text-gray-600 w-14">추가</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {currentVars.map((v) => (
                        <tr key={v.var} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-700">{v.name}</td>
                          <td className="px-3 py-2">
                            <code className="text-[#2ED573] bg-green-50 px-1.5 py-0.5 rounded text-[11px]">{v.var}</code>
                          </td>
                          <td className="px-3 py-2 text-gray-400">{v.desc}</td>
                          <td className="px-3 py-2 text-center">
                            <button
                              onClick={() => insertVar(v.var)}
                              className="px-2 py-1 bg-[#2ED573] text-white text-[10px] font-bold rounded border-none cursor-pointer hover:bg-[#25B866] whitespace-nowrap"
                            >
                              추가
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 버튼 */}
        <div className="flex gap-3">
          <button onClick={handleSave} disabled={saving}
            className="bg-[#2ED573] text-white px-6 py-2.5 rounded-lg text-sm font-bold cursor-pointer border-none hover:bg-[#25B866] disabled:opacity-50">
            {saving ? '저장 중...' : '설정 저장'}
          </button>
          <button onClick={handleTest} disabled={testing || !config.url}
            className="bg-gray-900 text-white px-6 py-2.5 rounded-lg text-sm font-bold cursor-pointer border-none hover:bg-gray-800 disabled:opacity-50">
            {testing ? '전송 중...' : '테스트 전송'}
          </button>
        </div>
      </div>
    </AdminLayout>
  )
}
