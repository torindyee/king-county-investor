const KEY = "kc_investor_favorites_v1"

export function getFavorites(): number[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.filter((x) => typeof x === "number")
    return []
  } catch {
    return []
  }
}

export function setFavorites(ids: number[]) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(KEY, JSON.stringify(ids))
}

export function toggleFavorite(id: number): number[] {
  const current = getFavorites()
  const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
  setFavorites(next)
  return next
}
