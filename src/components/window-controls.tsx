import { useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { Minus, Pin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { saveKeepWindowOpen } from "@/lib/settings"
import { useAppPreferencesStore } from "@/stores/app-preferences-store"

export function WindowControls() {
  const keepOpen = useAppPreferencesStore((state) => state.keepWindowOpen)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  async function togglePin() {
    setSaving(true)
    setError("")
    try {
      await saveKeepWindowOpen(!keepOpen)
      useAppPreferencesStore.getState().setKeepWindowOpen(!keepOpen)
    } catch { setError("Could not save keep-open setting.") }
    finally { setSaving(false) }
  }
  async function minimise() {
    setError("")
    try { await invoke("hide_panel") }
    catch { setError("Could not minimise to tray. Try again.") }
  }
  return <div className="flex items-center gap-1" onMouseDown={(event) => event.stopPropagation()}>
    {error && <span role="alert" className="text-xs text-destructive">{error}</span>}
    <Button type="button" variant={keepOpen ? "secondary" : "ghost"} size="icon-xs"
      aria-label="Keep window open" aria-pressed={keepOpen} disabled={saving}
      title={keepOpen ? "Keep window open is on — click to unpin" : "Keep window open when switching apps"}
      onClick={() => void togglePin()}><Pin /></Button>
    <Button type="button" variant="ghost" size="icon-xs" aria-label="Minimise to tray" title="Minimise to tray"
      onClick={() => void minimise()}><Minus /></Button>
  </div>
}
