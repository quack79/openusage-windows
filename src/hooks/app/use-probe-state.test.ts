import { renderHook, act } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { useProbeState } from "@/hooks/app/use-probe-state"

describe("useProbeState", () => {
  it("discards the old balance when credentials change, including when the next probe fails", () => {
    const { result } = renderHook(() => useProbeState({}))
    act(() => result.current.handleProbeResult({
      providerId: "openrouter", displayName: "OpenRouter", iconUrl: "",
      lines: [{ type: "text", label: "Account balance", value: "$50.00" }],
    }))
    expect(result.current.pluginStates.openrouter.data).not.toBeNull()
    act(() => result.current.setLoadingForPlugins(["openrouter"], true))
    act(() => result.current.handleProbeResult({
      providerId: "openrouter", displayName: "OpenRouter", iconUrl: "",
      lines: [{ type: "badge", label: "Error", text: "API key required" }],
    }))
    expect(result.current.pluginStates.openrouter.data).toBeNull()
    expect(result.current.pluginStates.openrouter.lastUpdatedAt).toBeNull()
    expect(result.current.pluginStates.openrouter.error).toBe("API key required")
  })

  it("updates pluginStatesRef synchronously when marking plugins loading", () => {
    const { result } = renderHook(() => useProbeState({}))

    let loadingImmediatelyAfterSet: boolean | undefined
    act(() => {
      result.current.setLoadingForPlugins(["codex"])
      loadingImmediatelyAfterSet =
        result.current.pluginStatesRef.current.codex?.loading
    })

    expect(loadingImmediatelyAfterSet).toBe(true)
    expect(result.current.pluginStates.codex?.loading).toBe(true)
  })
})
