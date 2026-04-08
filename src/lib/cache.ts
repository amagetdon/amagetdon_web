const store = new Map<string, { data: unknown; ts: number }>()
const DEFAULT_TTL = 60_000 // 1분

export function getCached<T>(key: string): T | null {
  const entry = store.get(key)
  if (!entry) return null
  if (Date.now() - entry.ts > DEFAULT_TTL) {
    store.delete(key)
    return null
  }
  return entry.data as T
}

export function setCache<T>(key: string, data: T): T {
  store.set(key, { data, ts: Date.now() })
  return data
}

export function clearCache(prefix?: string) {
  if (!prefix) {
    store.clear()
    return
  }
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key)
  }
}
