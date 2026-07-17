export const AGING_DAYS_THRESHOLD = 60

export function isAgingStock(part, threshold = AGING_DAYS_THRESHOLD) {
  if (!part || part.status !== 'in_stock') {
    return false
  }

  const sourceDate = part.date_added || part.created_at

  if (!sourceDate) {
    return false
  }

  const timestamp = new Date(sourceDate).getTime()

  if (Number.isNaN(timestamp)) {
    return false
  }

  const now = Date.now()
  const ageInDays = (now - timestamp) / (1000 * 60 * 60 * 24)

  return ageInDays >= threshold
}
