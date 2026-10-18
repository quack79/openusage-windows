import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { invoke } from "@tauri-apps/api/core"
import { ProviderApiKey } from "@/components/provider-api-key"

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }))

describe("ProviderApiKey", () => {
  beforeEach(() => { vi.mocked(invoke).mockResolvedValue(false) })

  it("saves a key, clears the password field and refreshes after saving succeeds", async () => {
    const onChanged = vi.fn()
    render(<ProviderApiKey providerId="openrouter" onChanged={onChanged} />)
    const input = screen.getByLabelText("API key")
    await waitFor(() => expect(input).not.toBeDisabled())
    expect(input).toHaveAttribute("type", "password")
    fireEvent.change(input, { target: { value: " example-test-key " } })
    fireEvent.click(screen.getByRole("button", { name: "Save key" }))
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("API key saved."))
    expect(invoke).toHaveBeenCalledWith("set_provider_api_key", { providerId: "openrouter", apiKey: "example-test-key" })
    expect(input).toHaveValue("")
    expect(onChanged).toHaveBeenCalledOnce()
  })

  it("checks only whether a saved key exists and supports removing it", async () => {
    vi.mocked(invoke).mockResolvedValue(true)
    const onChanged = vi.fn()
    render(<ProviderApiKey providerId="cheaperinference" onChanged={onChanged} />)
    const remove = await screen.findByRole("button", { name: "Remove key" })
    await waitFor(() => expect(remove).not.toBeDisabled())
    expect(invoke).toHaveBeenCalledWith("has_provider_api_key", { providerId: "cheaperinference" })
    expect(screen.getByLabelText("API key")).toHaveValue("")
    fireEvent.click(remove)
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("API key removed."))
    expect(invoke).toHaveBeenCalledWith("delete_provider_api_key", { providerId: "cheaperinference" })
    expect(screen.queryByRole("button", { name: "Remove key" })).not.toBeInTheDocument()
    expect(onChanged).toHaveBeenCalledOnce()
  })

  it("does not report success or refresh when saving fails, and hides raw backend errors", async () => {
    const onChanged = vi.fn()
    render(<ProviderApiKey providerId="openrouter" onChanged={onChanged} />)
    const input = screen.getByLabelText("API key")
    await waitFor(() => expect(input).not.toBeDisabled())
    vi.mocked(invoke).mockRejectedValue(new Error("sensitive backend error"))
    fireEvent.change(input, { target: { value: "example-test-key" } })
    fireEvent.click(screen.getByRole("button", { name: "Save key" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not save the API key")
    expect(screen.queryByText("sensitive backend error")).not.toBeInTheDocument()
    expect(onChanged).not.toHaveBeenCalled()
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
  })

  it("disables edits while a balance probe is running", async () => {
    render(<ProviderApiKey providerId="cheaperinference" disabled />)
    await waitFor(() => expect(invoke).toHaveBeenCalled())
    expect(screen.getByLabelText("API key")).toBeDisabled()
    expect(screen.getByRole("button", { name: "Save key" })).toBeDisabled()
  })
})
