import { useEffect, useId, useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { Button } from "@/components/ui/button"

interface ProviderApiKeyProps {
  providerId: string
  disabled?: boolean
  onChanged?: () => void
}

export function ProviderApiKey({ providerId, disabled = false, onChanged }: ProviderApiKeyProps) {
  const inputId = useId()
  const [apiKey, setApiKey] = useState("")
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState("")

  useEffect(() => {
    let cancelled = false
    invoke<boolean>("has_provider_api_key", { providerId })
      .then((value) => { if (!cancelled) setSaved(value) })
      .catch(() => { if (!cancelled) setError("Could not access the system credential store.") })
      .finally(() => { if (!cancelled) setBusy(false) })
    return () => { cancelled = true }
  }, [providerId])

  async function updateKey(remove: boolean) {
    setBusy(true)
    setError(null)
    setMessage("")
    try {
      if (remove) {
        await invoke("delete_provider_api_key", { providerId })
      } else {
        await invoke("set_provider_api_key", { providerId, apiKey: apiKey.trim() })
      }
      setApiKey("")
      setSaved(!remove)
      setMessage(remove ? "API key removed." : "API key saved.")
      onChanged?.()
    } catch {
      setError(remove ? "Could not remove the API key. Try again." : "Could not save the API key. Check the key and try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="space-y-2 border-t border-border pt-3 mt-4" onSubmit={(event) => {
      event.preventDefault()
      if (!busy && !disabled && apiKey.trim()) void updateKey(false)
    }}>
      <label htmlFor={inputId} className="text-xs font-medium">API key</label>
      <p className="text-xs text-muted-foreground">
        {providerId === "openrouter"
          ? "Use a management key to see your account balance. A regular key shows its remaining spending allowance."
          : "Use an API key with account:read access to see your available wallet balance."}
      </p>
      <input
        id={inputId}
        type="password"
        value={apiKey}
        onChange={(event) => setApiKey(event.target.value)}
        placeholder={saved ? "Key saved — enter a replacement" : "Paste your API key"}
        autoComplete="off"
        spellCheck={false}
        disabled={busy || disabled}
        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm focus-visible:outline-ring"
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={busy || disabled || !apiKey.trim()}>Save key</Button>
        {saved && <Button type="button" size="sm" variant="outline" disabled={busy || disabled} onClick={() => void updateKey(true)}>Remove key</Button>}
      </div>
      <p className="text-xs text-muted-foreground">Saved in your system credential store.</p>
      {message && <p role="status" className="text-xs text-muted-foreground">{message}</p>}
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </form>
  )
}
