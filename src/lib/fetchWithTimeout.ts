/**
 * Promise에 타임아웃을 추가합니다.
 * 지정 시간 내 응답이 없으면 reject됩니다.
 */
export function withTimeout<T>(promise: Promise<T>, ms = 10000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('요청 시간이 초과되었습니다. 새로고침 해주세요.')), ms)
    ),
  ])
}
