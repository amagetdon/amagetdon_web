const UMAMI_URL = import.meta.env.VITE_UMAMI_URL as string
const WEBSITE_ID = import.meta.env.VITE_UMAMI_WEBSITE_ID as string
const USERNAME = import.meta.env.VITE_UMAMI_USERNAME as string
const PASSWORD = import.meta.env.VITE_UMAMI_PASSWORD as string

let cachedToken: string | null = null

interface StatsResponse {
  pageviews: { value: number; prev: number }
  visitors: { value: number; prev: number }
  visits: { value: number; prev: number }
  bounces: { value: number; prev: number }
  totaltime: { value: number; prev: number }
}

interface PageviewEntry {
  x: string
  y: number
}

interface PageviewsResponse {
  pageviews: PageviewEntry[]
  sessions: PageviewEntry[]
}

interface MetricEntry {
  x: string
  y: number
}

interface ActiveResponse {
  x: number
}

async function login(): Promise<string> {
  const res = await fetch(`${UMAMI_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  })
  if (!res.ok) throw new Error('Umami login failed')
  const data = await res.json()
  cachedToken = data.token as string
  return cachedToken
}

async function getToken(): Promise<string> {
  if (cachedToken) return cachedToken
  return login()
}

async function apiFetch<T>(path: string, retry = true): Promise<T> {
  const token = await getToken()
  const res = await fetch(`${UMAMI_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    if (retry) {
      cachedToken = null
      await login()
      return apiFetch<T>(path, false)
    }
    throw new Error(`Umami API error: ${res.status}`)
  }
  return res.json()
}

export const analyticsService = {
  async getStats(startAt: number, endAt: number): Promise<StatsResponse> {
    return apiFetch<StatsResponse>(
      `/api/websites/${WEBSITE_ID}/stats?startAt=${startAt}&endAt=${endAt}`
    )
  },

  async getPageviews(startAt: number, endAt: number, unit: string = 'day'): Promise<PageviewsResponse> {
    return apiFetch<PageviewsResponse>(
      `/api/websites/${WEBSITE_ID}/pageviews?startAt=${startAt}&endAt=${endAt}&unit=${unit}`
    )
  },

  async getMetrics(startAt: number, endAt: number, type: string): Promise<MetricEntry[]> {
    return apiFetch<MetricEntry[]>(
      `/api/websites/${WEBSITE_ID}/metrics?startAt=${startAt}&endAt=${endAt}&type=${type}`
    )
  },

  async getActive(): Promise<ActiveResponse> {
    return apiFetch<ActiveResponse>(`/api/websites/${WEBSITE_ID}/active`)
  },
}
