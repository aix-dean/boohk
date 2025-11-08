export function uid(prefix = "id"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function parseNumber(value: unknown): number {
  if (value === null || value === undefined) return 0
  if (typeof value === "number" && !Number.isNaN(value)) return value
  const str = String(value).replace(/,/g, "").trim()
  if (!str) return 0
  const n = Number(str)
  return Number.isFinite(n) ? n : 0
}

export function sumBy<T>(arr: T[], sel: (item: T) => number): number {
  return arr.reduce((acc, item) => acc + (Number.isFinite(sel(item)) ? sel(item) : 0), 0)
}

export function includesAny<T extends Record<string, any>>(row: T, query: string): boolean {
  if (!query) return true
  const q = query.toLowerCase()
  for (const key of Object.keys(row)) {
    const val = row[key]
    if (val === null || val === undefined) continue
    const s =
      typeof val === "number"
        ? String(val)
        : typeof val === "object"
          ? JSON.stringify(val)
          : String(val)
    if (s.toLowerCase().includes(q)) return true
  }
  return false
}

export function formatCurrency(n: number, currency: string = "PHP", locale: string = "en-PH"): string {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 }).format(n || 0)
  } catch {
    return `₱${(n || 0).toFixed(2)}`
  }
}
