import { useEffect } from "react"
import { loadBalanceCurrency, loadKeepWindowOpen } from "@/lib/settings"
import { useAppPreferencesStore } from "@/stores/app-preferences-store"

export function useBalanceWindowPreferences() {
  useEffect(() => {
    let cancelled = false
    void Promise.allSettled([loadBalanceCurrency(), loadKeepWindowOpen()]).then(([currency, keepOpen]) => {
      if (cancelled) return
      if (currency.status === "fulfilled") useAppPreferencesStore.getState().setBalanceCurrency(currency.value)
      if (keepOpen.status === "fulfilled") useAppPreferencesStore.getState().setKeepWindowOpen(keepOpen.value)
      if (currency.status === "rejected" || keepOpen.status === "rejected") {
        console.error("Could not load balance and window preferences.")
      }
    })
    return () => { cancelled = true }
  }, [])
}
