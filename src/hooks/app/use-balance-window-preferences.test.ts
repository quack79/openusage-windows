import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { loadBalanceCurrency, loadKeepWindowOpen } from "@/lib/settings"
import { useAppPreferencesStore } from "@/stores/app-preferences-store"
import { useBalanceWindowPreferences } from "./use-balance-window-preferences"

vi.mock("@/lib/settings", async (original) => ({ ...await original<typeof import("@/lib/settings")>(),
  loadBalanceCurrency: vi.fn(), loadKeepWindowOpen: vi.fn(),
}))

describe("balance and window preference startup", () => {
  beforeEach(() => useAppPreferencesStore.getState().resetState())
  it("restores saved GBP and pin state on startup", async () => {
    vi.mocked(loadBalanceCurrency).mockResolvedValue("GBP")
    vi.mocked(loadKeepWindowOpen).mockResolvedValue(true)
    renderHook(() => useBalanceWindowPreferences())
    await waitFor(() => expect(useAppPreferencesStore.getState()).toMatchObject({ balanceCurrency: "GBP", keepWindowOpen: true }))
  })
  it("still restores pin state if reading the currency preference fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    vi.mocked(loadBalanceCurrency).mockRejectedValue(new Error("unavailable"))
    vi.mocked(loadKeepWindowOpen).mockResolvedValue(true)
    renderHook(() => useBalanceWindowPreferences())
    await waitFor(() => expect(useAppPreferencesStore.getState().keepWindowOpen).toBe(true))
    expect(useAppPreferencesStore.getState().balanceCurrency).toBe("USD")
  })
})
