export function toLocalDateStr(date: Date): string {
  const yr = date.getFullYear()
  const mo = String(date.getMonth() + 1).padStart(2, '0')
  const dy = String(date.getDate()).padStart(2, '0')
  return `${yr}-${mo}-${dy}`
}

export function toLocalMonthStr(date: Date): string {
  const yr = date.getFullYear()
  const mo = String(date.getMonth() + 1).padStart(2, '0')
  return `${yr}-${mo}`
}
