import { render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { BalanceAmount } from "./balance-amount"
import { useAppPreferencesStore } from "@/stores/app-preferences-store"
import { useGbpRateStore } from "@/lib/gbp-rate"

describe("BalanceAmount", () => {
  beforeEach(() => {
    useAppPreferencesStore.getState().resetState()
    useGbpRateStore.setState({ quote: null, loading: false, failed: false })
  })
  afterEach(() => vi.unstubAllGlobals())

  it("shows a prominent USD balance by default without requesting conversion", () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    render(<BalanceAmount label="Available balance" amountUsd={20.77} />)
    expect(screen.getByText("$20.77")).toHaveClass("text-2xl", "text-foreground")
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("shows estimated GBP alongside the original USD and reference date", () => {
    useAppPreferencesStore.setState({ balanceCurrency: "GBP" })
    useGbpRateStore.setState({ quote: { rate: 0.75, date: "2026-10-16", fetchedAt: Date.now() } })
    render(<BalanceAmount label="Account balance" amountUsd={20} />)
    expect(screen.getByText("≈ £15.00")).toBeInTheDocument()
    expect(screen.getByText(/\$20.00 USD · ECB rate 2026-10-16/)).toBeInTheDocument()
  })

  it("shows USD explicitly when GBP is selected but the rate cannot be loaded", async () => {
    useAppPreferencesStore.setState({ balanceCurrency: "GBP" })
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")))
    render(<BalanceAmount label="Available balance" amountUsd={0} />)
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("GBP conversion unavailable; showing USD."))
    expect(screen.getByText("$0.00")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Retry GBP rate" })).toBeInTheDocument()
  })
})
