export function paginationPageCount(value) {
  const count = Number(value)
  return Number.isSafeInteger(count) && count > 0 ? count : 1
}

export function compactPaginationItems(max) {
  const count = paginationPageCount(max)
  if (count <= 4) return Array.from({ length: count }, (_, index) => index + 1)
  return [1, 2, 'ellipsis', count - 1, count]
}

export function parsePaginationPage(value, max) {
  const text = String(value ?? '')
  if (!/^\d+$/.test(text)) return null
  const page = Number(text)
  return Number.isSafeInteger(page) && page >= 1 && page <= paginationPageCount(max)
    ? page
    : null
}
