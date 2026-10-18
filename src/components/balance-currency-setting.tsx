import { useState } from "react"
import { Button } from "@/components/ui/button"
import { saveBalanceCurrency, type BalanceCurrency } from "@/lib/settings"
import { useAppPreferencesStore } from "@/stores/app-preferences-store"

export function BalanceCurrencySetting() {
  const currency = useAppPreferencesStore((state) => state.balanceCurrency)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)
  async function change(value: BalanceCurrency) {
    setSaving(true)
    setError(false)
    try {
      await saveBalanceCurrency(value)
      useAppPreferencesStore.getState().setBalanceCurrency(value)
    } catch { setError(true) }
    finally { setSaving(false) }
  }
  return <section>
    <h3 className="text-lg font-semibold">Balance currency</h3>
    <p className="text-sm text-muted-foreground mb-2">OpenRouter and CheaperInference balances. GBP is an estimate using the daily ECB rate.</p>
    <div role="group" aria-label="Balance currency" className="flex gap-1">
      {(["USD", "GBP"] as const).map((value) => <Button key={value} type="button" size="sm"
        variant={currency === value ? "default" : "outline"} aria-pressed={currency === value}
        disabled={saving} onClick={() => void change(value)}>{value}</Button>)}
    </div>
    {error && <p role="alert" className="text-xs text-destructive">Could not save balance currency. Try again.</p>}
  </section>
}
