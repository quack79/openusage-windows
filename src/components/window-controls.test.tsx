import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { invoke } from "@tauri-apps/api/core"
import { saveKeepWindowOpen } from "@/lib/settings"
import { useAppPreferencesStore } from "@/stores/app-preferences-store"
import { WindowControls } from "./window-controls"

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }))
vi.mock("@/lib/settings", async (original) => ({ ...await original<typeof import("@/lib/settings")>(), saveKeepWindowOpen: vi.fn() }))

describe("WindowControls", () => {
  beforeEach(() => {
    useAppPreferencesStore.getState().resetState()
    vi.mocked(saveKeepWindowOpen).mockResolvedValue(undefined)
    vi.mocked(invoke).mockResolvedValue(undefined)
  })

  it("saves the pin preference and reflects its state", async () => {
    render(<WindowControls />)
    fireEvent.click(screen.getByRole("button", { name: "Keep window open" }))
    await waitFor(() => expect(screen.getByRole("button", { name: "Keep window open" })).toHaveAttribute("aria-pressed", "true"))
    expect(saveKeepWindowOpen).toHaveBeenCalledWith(true)
    fireEvent.click(screen.getByRole("button", { name: "Keep window open" }))
    await waitFor(() => expect(saveKeepWindowOpen).toHaveBeenLastCalledWith(false))
  })

  it("minimises to tray even when pinned", async () => {
    useAppPreferencesStore.setState({ keepWindowOpen: true })
    render(<WindowControls />)
    fireEvent.click(screen.getByRole("button", { name: "Minimise to tray" }))
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("hide_panel"))
    expect(useAppPreferencesStore.getState().keepWindowOpen).toBe(true)
  })

  it("does not report a new pin state when saving fails", async () => {
    vi.mocked(saveKeepWindowOpen).mockRejectedValue(new Error("storage error"))
    render(<WindowControls />)
    fireEvent.click(screen.getByRole("button", { name: "Keep window open" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not save keep-open setting.")
    expect(useAppPreferencesStore.getState().keepWindowOpen).toBe(false)
  })
})
