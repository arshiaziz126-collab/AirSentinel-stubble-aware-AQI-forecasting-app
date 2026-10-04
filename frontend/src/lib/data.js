// ---------- API ----------
const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

async function get(path) {
  let res
  try {
    res = await fetch(BASE + path)
  } catch {
    throw new Error("Can't reach the AirSentinel API. Start the backend (run.bat), then refresh this page.")
  }
  if (!res.ok) {
    let msg = `The API answered with an error (${res.status}).`
    try { const j = await res.json(); if (j.detail) msg = j.detail } catch { /* keep default */ }
    throw new Error(msg)
  }
  return res.json()
}

const qs = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v)).toString()

export const getDashboard = (asOf, profile) => get(`/api/dashboard?${qs({ as_of: asOf, profile })}`)
export const getAdvice = (profile, asOf) => get(`/api/advice?${qs({ profile, as_of: asOf })}`)

// ---------- formatting ----------
const toDate = (s) => new Date(`${s}T00:00:00`)

export const weekday = (s) => toDate(s).toLocaleDateString('en-GB', { weekday: 'long' })
export const shortDay = (s) => toDate(s).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
export const longDate = (s) => toDate(s).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
export const dayMonth = (s) => toDate(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
export const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString('en-IN'))

export function heroHeadline(data) {
  const today = data.today.category
  const peak = data.forecast.reduce((a, b) => (b.aqi > a.aqi ? b : a))
  const low = data.forecast.reduce((a, b) => (b.aqi < a.aqi ? b : a))
  const start = `The air today is ${today.label.toLowerCase()}`
  if (peak.category.level > today.level) return `${start}, and ${weekday(peak.date)} looks worse.`
  if (low.category.level < today.level) return `${start}, but it should ease by ${weekday(low.date)}.`
  return `${start}, and it stays that way for days.`
}

// ---------- colour palettes the page moves through as you scroll ----------
export const PALETTES = {
  white: {
    '--bg': 'rgba(251,248,246,1)', '--ink': 'rgba(30,20,22,1)', '--soft': 'rgba(107,94,92,1)', '--mute': 'rgba(154,140,137,1)',
    '--line': 'rgba(30,20,22,.09)', '--card': 'rgba(255,255,255,1)', '--cardline': 'rgba(30,20,22,.08)',
    '--accent': 'rgba(192,37,47,1)', '--accent-ink': 'rgba(255,255,255,1)', '--hdr': 'rgba(251,248,246,.72)',
  },
  blush: {
    '--bg': 'rgba(246,236,234,1)', '--ink': 'rgba(30,20,22,1)', '--soft': 'rgba(107,94,92,1)', '--mute': 'rgba(154,140,137,1)',
    '--line': 'rgba(30,20,22,.08)', '--card': 'rgba(255,255,255,1)', '--cardline': 'rgba(30,20,22,.07)',
    '--accent': 'rgba(192,37,47,1)', '--accent-ink': 'rgba(255,255,255,1)', '--hdr': 'rgba(246,236,234,.74)',
  },
  crimson: {
    '--bg': 'rgba(163,32,44,1)', '--ink': 'rgba(255,245,243,1)', '--soft': 'rgba(246,207,205,1)', '--mute': 'rgba(226,163,163,1)',
    '--line': 'rgba(255,255,255,.16)', '--card': 'rgba(255,255,255,.07)', '--cardline': 'rgba(255,255,255,.16)',
    '--accent': 'rgba(255,255,255,1)', '--accent-ink': 'rgba(163,32,44,1)', '--hdr': 'rgba(163,32,44,.72)',
  },
  wine: {
    '--bg': 'rgba(94,15,27,1)', '--ink': 'rgba(255,245,243,1)', '--soft': 'rgba(235,194,194,1)', '--mute': 'rgba(201,143,147,1)',
    '--line': 'rgba(255,255,255,.14)', '--card': 'rgba(255,255,255,.06)', '--cardline': 'rgba(255,255,255,.14)',
    '--accent': 'rgba(255,215,212,1)', '--accent-ink': 'rgba(94,15,27,1)', '--hdr': 'rgba(94,15,27,.72)',
  },
}
