import { formatBalance, refreshGbpRate, useGbpRate } from "@/lib/gbp-rate"
import { useAppPreferencesStore } from "@/stores/app-preferences-store"

export function BalanceAmount({ label, amountUsd, subtitle, color }: {
  label: string; amountUsd: number; subtitle?: string; color?: string
}) {
  const currency = useAppPreferencesStore((state) => state.balanceCurrency)
  const { quote, loading, failed } = useGbpRate(currency === "GBP")
  const conversion = currency === "GBP" ? quote : null
  const primary = ["Account balance", "Available balance", "Key remaining"].includes(label)

  return (
    <div className={primary ? "py-1 space-y-1" : "space-y-0.5"}>
      <div className="flex flex-wrap justify-between items-baseline gap-x-3 gap-y-1">
        <span className="text-sm text-foreground">{label}</span>
        <span className={primary ? "text-2xl font-semibold tabular-nums text-foreground" : "text-base font-medium tabular-nums text-foreground"}
          style={color ? { color } : undefined}>
          {formatBalance(amountUsd, conversion)}
        </span>
      </div>
      {conversion && <p className="text-xs text-muted-foreground">
        {formatBalance(amountUsd, null)} USD · ECB rate {conversion.date}{failed ? " (cached)" : ""}
      </p>}
      {subtitle && <p className="text-xs leading-relaxed text-muted-foreground">{subtitle}</p>}
      {currency === "GBP" && !conversion && <p className="text-xs text-muted-foreground" role="status">
        {loading ? "Loading GBP rate; showing USD." : "GBP conversion unavailable; showing USD."}
      </p>}
      {currency === "GBP" && failed && <button type="button" className="text-xs underline text-muted-foreground"
        disabled={loading} onClick={() => void refreshGbpRate(true)}>Retry GBP rate</button>}
    </div>
  )
}
