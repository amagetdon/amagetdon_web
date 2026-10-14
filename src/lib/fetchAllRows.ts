// Supabase(PostgREST)는 한 요청에 최대 1,000행만 돌려준다(프로젝트 max_rows). 조건 없이 select 하면
// 1,000행에서 잘려 합계·통계가 조용히 틀어진다(2026-10-14 관리자 대시보드 총 매출이 1억대로 줄어든 원인).
// 범위를 1,000행씩 나눠 끝까지 모은다. build 는 같은 정렬(order)을 가진 쿼리에 range 를 붙여 돌려줘야
// 페이지 사이에 행이 겹치거나 빠지지 않는다.
// 속도: 첫 페이지가 꽉 차면 다음 페이지들은 BATCH 개씩 동시에 받는다(한 장씩 차례로 받으면 6천 행에 7번 왕복).
const PAGE = 1000
const BATCH = 8

type PageResult<T> = PromiseLike<{ data: T[] | null; error: unknown }>

export async function fetchAllRows<T>(build: (from: number, to: number) => PageResult<T>): Promise<{ data: T[]; error: unknown }> {
  const first = await build(0, PAGE - 1)
  if (first.error) return { data: [], error: first.error }
  const rows: T[] = [...(first.data ?? [])]
  if (rows.length < PAGE) return { data: rows, error: null }

  for (let page = 1; ; page += BATCH) {
    const results = await Promise.all(
      Array.from({ length: BATCH }, (_, i) => {
        const from = (page + i) * PAGE
        return build(from, from + PAGE - 1)
      }),
    )
    // 앞 페이지부터 순서대로 붙이고, 덜 찬 페이지가 나오면 거기서 끝 (그 뒤 페이지는 비어 있음)
    for (const { data, error } of results) {
      if (error) return { data: rows, error }
      const chunk = data ?? []
      rows.push(...chunk)
      if (chunk.length < PAGE) return { data: rows, error: null }
    }
  }
}
