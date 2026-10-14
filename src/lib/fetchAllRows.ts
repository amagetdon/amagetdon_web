// Supabase(PostgREST)는 한 요청에 최대 1,000행만 돌려준다(프로젝트 max_rows). 조건 없이 select 하면
// 1,000행에서 잘려 합계·통계가 조용히 틀어진다(2026-10-14 관리자 대시보드 총 매출이 1억대로 줄어든 원인).
// 범위를 1,000행씩 나눠 끝까지 모은다. build 는 같은 정렬(order)을 가진 쿼리에 range 를 붙여 돌려줘야
// 페이지 사이에 행이 겹치거나 빠지지 않는다.
const PAGE = 1000

type PageResult<T> = PromiseLike<{ data: T[] | null; error: unknown }>

export async function fetchAllRows<T>(build: (from: number, to: number) => PageResult<T>): Promise<{ data: T[]; error: unknown }> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1)
    if (error) return { data: rows, error }
    const page = data ?? []
    rows.push(...page)
    if (page.length < PAGE) return { data: rows, error: null }
  }
}
