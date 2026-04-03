/**
 * Promise에 타임아웃을 추가합니다.
 * 지정 시간 내 응답이 없으면 reject됩니다.
 */
export function withTimeout<T>(promise: PromiseLike<T>, ms = 15000): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('요청 시간이 초과되었습니다. 새로고침 해주세요.')), ms)
    }),
  ]).finally(() => clearTimeout(timeoutId))
}
