import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

describe("GBP reference rate", () => {
  beforeEach(() => { vi.resetModules() })
  afterEach(() => { vi.unstubAllGlobals() })

  it("converts positive, zero and negative balances without altering USD", async () => {
    const { formatBalance, parseGbpQuote } = await import("./gbp-rate")
    const quote = parseGbpQuote({ base: "USD", quote: "GBP", date: "2026-10-16", rate: 0.75 }, Date.now())
    expect(formatBalance(20, quote)).toBe("≈ £15.00")
    expect(formatBalance(0, quote)).toBe("≈ £0.00")
    expect(formatBalance(-2, quote)).toBe("≈ -£1.50")
    expect(formatBalance(20, null)).toBe("$20.00")
  })

  it.each([null, {}, { base: "GBP", quote: "USD", date: "2026-10-16", rate: 1.3 },
    { base: "USD", quote: "GBP", date: "2026-10-16", rate: 0 },
    { base: "USD", quote: "GBP", date: "2026-10-16", rate: "0.75" },
    { base: "USD", quote: "GBP", date: "invalid", rate: 0.75 }])("rejects malformed or inverted rates: %j", async (value) => {
    const { parseGbpQuote } = await import("./gbp-rate")
    expect(() => parseGbpQuote(value, Date.now())).toThrow()
  })

  it("shares and caches one anonymous request across providers", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ base: "USD", quote: "GBP", date: "2026-10-16", rate: 0.75 }) })
    vi.stubGlobal("fetch", fetchMock)
    const { refreshGbpRate, GBP_RATE_URL, useGbpRateStore } = await import("./gbp-rate")
    await Promise.all([refreshGbpRate(), refreshGbpRate()])
    await refreshGbpRate()
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledWith(GBP_RATE_URL, { signal: expect.any(AbortSignal), credentials: "omit" })
    expect(useGbpRateStore.getState().quote?.rate).toBe(0.75)
  })

  it("keeps a known rate with an explicit failure state if refreshing fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")))
    const { refreshGbpRate, useGbpRateStore } = await import("./gbp-rate")
    const quote = { rate: 0.75, date: "2026-10-16", fetchedAt: Date.now() - 7 * 60 * 60 * 1000 }
    useGbpRateStore.setState({ quote })
    await refreshGbpRate()
    expect(useGbpRateStore.getState()).toMatchObject({ quote, failed: true, loading: false })
  })

  it("does not invent a rate when the service returns an error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }))
    const { refreshGbpRate, useGbpRateStore } = await import("./gbp-rate")
    await refreshGbpRate()
    expect(useGbpRateStore.getState()).toMatchObject({ quote: null, failed: true, loading: false })
  })
})
