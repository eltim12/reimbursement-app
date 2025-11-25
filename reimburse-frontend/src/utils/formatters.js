// Format IDR currency
export function formatIDR(amount) {
  if (amount === 0) return 'FREE'
  const num = parseFloat(amount.toString().replace(/,/g, ''))
  return `Rp ${num.toFixed().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`
}

// Parse amount from input
export function parseAmount(value) {
  if (!value) return NaN
  const normalized = value.replace(/[.,]/g, '')
  const num = parseFloat(normalized)
  return isNaN(num) ? NaN : num
}

