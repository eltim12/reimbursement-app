// Format currency (IDR or RMB)
export function formatCurrency(amount, currency = "IDR") {
  // if (amount === 0) return 'FREE'

  if (currency === "RMB" || currency === "CNY") {
    // RMB: uses commas for thousands, 2 decimal places if needed
    // Assuming amount is a number
    const num = parseFloat(amount);
    if (isNaN(num)) return "¥ 0";
    // Format to 2 decimal places if not integer, or always? standard is usually 2 decimals for prices
    // But for reimbursement sometimes people just want int.
    // Let's safe default to 2 decimals if it has decimals, or just use standard locale string
    // 'zh-CN' uses commas and usually 2 decimals.
    return new Intl.NumberFormat("zh-CN", {
      style: "currency",
      currency: "CNY",
    }).format(num);
  } else {
    // IDR: uses dots for thousands, no decimals usually
    const num = parseFloat(amount.toString().replace(/,/g, ""));
    return `Rp ${num.toFixed().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
  }
}

// Backward compatibility
export function formatIDR(amount) {
  return formatCurrency(amount, "IDR");
}

// Parse amount based on currency
export function parseCurrencyAmount(value, currency = "IDR") {
  if (!value) return NaN;

  if (currency === "RMB" || currency === "CNY") {
    // RMB input might have commas as thousands separators, and a dot for decimal
    // We want to remove commas, keep dot
    const normalized = value.toString().replace(/,/g, "");
    const num = parseFloat(normalized);
    return isNaN(num) ? NaN : num;
  } else {
    // IDR input uses dots as thousands separators.
    // We remove dots. If they used comma for decimal (rare in this app context but possible), strip it too based on old logic
    // Old logic: value.replace(/[.,]/g, '')
    const normalized = value.toString().replace(/[.,]/g, "");
    const num = parseFloat(normalized);
    return isNaN(num) ? NaN : num;
  }
}

// Backward compatibility
export function parseAmount(value) {
  return parseCurrencyAmount(value, "IDR");
}
