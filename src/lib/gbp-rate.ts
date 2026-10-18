import { useEffect } from "react"
import { create } from "zustand"

export type GbpQuote = { rate: number; date: string; fetchedAt: number }
type RateState = { quote: GbpQuote | null; loading: boolean; failed: boolean }
const RATE_CACHE_MS = 6 * 60 * 60 * 1000
export const GBP_RATE_URL = "https://api.frankfurter.dev/v2/providers/ecb/rate/USD/GBP"
export const useGbpRateStore = create<RateState>(() => ({ quote: null, loading: false, failed: false }))
let pending: Promise<void> | null = null
let lastAttemptAt = 0

export function parseGbpQuote(value: unknown, now: number): GbpQuote {
  const data = value as Record<string, unknown> | null
  if (!data || data.base !== "USD" || data.quote !== "GBP" ||
      typeof data.rate !== "number" || !Number.isFinite(data.rate) || data.rate <= 0 ||
      typeof data.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(data.date) ||
      !Number.isFinite(Date.parse(data.date))) {
    throw new Error("Invalid USD/GBP exchange rate")
  }
  return { rate: data.rate, date: data.date, fetchedAt: now }
}

export function refreshGbpRate(force = false): Promise<void> {
  if (pending) return pending
  const now = Date.now()
  const { quote } = useGbpRateStore.getState()
  if (!force && ((quote && now - quote.fetchedAt < RATE_CACHE_MS) || now - lastAttemptAt < 60_000)) {
    return Promise.resolve()
  }
  lastAttemptAt = now
  useGbpRateStore.setState({ loading: true, failed: false })
  pending = Promise.resolve().then(async () => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10_000)
    try {
      // Only the currency pair is sent; provider keys and balances stay local.
      const response = await fetch(GBP_RATE_URL, { signal: controller.signal, credentials: "omit" })
      if (!response.ok) throw new Error("Exchange rate unavailable")
      const next = parseGbpQuote(await response.json(), Date.now())
      useGbpRateStore.setState({ quote: next, failed: false })
    } catch {
      useGbpRateStore.setState({ failed: true })
    } finally {
      clearTimeout(timer)
      useGbpRateStore.setState({ loading: false })
      pending = null
    }
  })
  return pending
}

export function useGbpRate(enabled: boolean) {
  const state = useGbpRateStore()
  useEffect(() => {
    if (!enabled) return
    const refresh = () => { void refreshGbpRate() }
    refresh()
    const timer = setInterval(refresh, 60 * 60 * 1000)
    window.addEventListener("focus", refresh)
    return () => {
      clearInterval(timer)
      window.removeEventListener("focus", refresh)
    }
  }, [enabled])
  return state
}

export function formatBalance(amountUsd: number, quote: GbpQuote | null): string {
  return quote
    ? "≈ " + new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(amountUsd * quote.rate)
    : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amountUsd)
}
