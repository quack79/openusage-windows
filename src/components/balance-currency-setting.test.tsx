import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { saveBalanceCurrency } from "@/lib/settings"
import { useAppPreferencesStore } from "@/stores/app-preferences-store"
import { BalanceCurrencySetting } from "./balance-currency-setting"

vi.mock("@/lib/settings", async (original) => ({ ...await original<typeof import("@/lib/settings")>(), saveBalanceCurrency: vi.fn() }))

describe("Balance currency setting", () => {
  beforeEach(() => {
    useAppPreferencesStore.getState().resetState()
    vi.mocked(saveBalanceCurrency).mockResolvedValue(undefined)
  })
  it("saves GBP and updates the preference shared by both providers", async () => {
    render(<BalanceCurrencySetting />)
    fireEvent.click(screen.getByRole("button", { name: "GBP" }))
    await waitFor(() => expect(screen.getByRole("button", { name: "GBP" })).toHaveAttribute("aria-pressed", "true"))
    expect(saveBalanceCurrency).toHaveBeenCalledWith("GBP")
    expect(useAppPreferencesStore.getState().balanceCurrency).toBe("GBP")
  })
  it("keeps USD selected if saving fails", async () => {
    vi.mocked(saveBalanceCurrency).mockRejectedValue(new Error("storage error"))
    render(<BalanceCurrencySetting />)
    fireEvent.click(screen.getByRole("button", { name: "GBP" }))
    expect(await screen.findByRole("alert")).toBeInTheDocument()
    expect(useAppPreferencesStore.getState().balanceCurrency).toBe("USD")
  })
})
