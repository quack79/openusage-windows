# OpenRouter and CheaperInference balances

Build and run this version of OpenUsage, enable the providers in Settings, then
select each provider in the sidebar and save its API key. Saving or removing a
key refreshes the provider automatically. Normal background refresh also applies.

Keys are stored in Windows Credential Manager (or macOS Keychain), outside the
project and the app's JSON settings. The password field clears after saving;
the frontend can check whether a key exists but cannot retrieve it. Each plugin's
`ctx.host.credentials.getApiKey()` reads only its own provider's saved key.
Other operating systems report unsupported storage instead of using a mock store.

## OpenRouter

- For the **account balance**, save an OpenRouter **management key**. The plugin
  reads `GET https://openrouter.ai/api/v1/credits` and displays
  `data.total_credits - data.total_usage` in USD.
- An ordinary API key can read `GET https://openrouter.ai/api/v1/key`. The plugin
  shows `data.limit_remaining` as **Key remaining**, when set. This is the key's
  spending allowance, also subject to the account's funds. It uses the API's
  reported remainder so resets and BYOK accounting are respected.
- If the credits endpoint returns 403, the plugin keeps the key allowance and
  explains that the account balance needs a management key. A key with no spending
  limit is labelled accordingly; it is never presented as unlimited funds.

References: [current key](https://openrouter.ai/docs/api/api-reference/api-keys/get-current-api-key),
[account credits](https://openrouter.ai/docs/api/api-reference/credits/get-remaining-credits).

## CheaperInference

Save an API key with **`account:read`** access. The plugin reads
`GET https://api.cheaperinference.com/v1/account/balance` and shows **Available
balance** from `available_usd`, the amount available after reservations for
requests in flight. The details also show `balance_usd`, `reserved_usd`, and
auto-recharge state when provided. This is the account/workspace wallet accessible
through the key, rather than a separate balance assigned to an individual key.

## Larger balances and GBP display

Both providers show primary balance amounts in larger, high-contrast text.
In Settings, choose **Balance currency → GBP** to display an estimate in pounds.
USD is the default and remains the actual provider currency. GBP display also
shows the original USD amount and the reference-rate date. Wallet, reserved funds
and key-usage amounts use the same selected currency.

The app fetches the daily ECB USD/GBP reference rate from
`https://api.frankfurter.dev/v2/providers/ecb/rate/USD/GBP` and caches it in memory
for six hours. Only the currency pair is sent; balances and keys stay local.
Rates can be from the previous business day on weekends or holidays. If no rate
is available, the UI explicitly shows USD; if refreshing a cached rate fails, it
labels the cached rate and offers a retry.

## Keep the window open

On Windows, click the **pin** in the top bar to keep the window open when it loses
focus. The choice is saved across restarts. Click the **minus** to minimise to
the system tray, including while pinned. The tray icon and global shortcut can
reopen the window. Escape and manual tray toggles still dismiss it.

Reference: [API reference](https://platform.cheaperinference.com/api-reference).

## Build and verification

These plugins need the updated app host for API key entry and storage; copying
the plugin folders into an older installed release is insufficient.

```powershell
npm ci
npm test -- --run
npm run build
npm run bundle:plugins
cargo test --manifest-path src-tauri/Cargo.toml -- --test-threads=1
npm run tauri dev
```

Run `npm run build:release` for the Windows installer. The repository's normal
Windows build prerequisites still apply (Node.js, Rust MSVC toolchain and Visual
Studio C++ Build Tools).

The JS tests mock responses and require no real keys. On Windows, verify the
credential store integration by saving a key in the app, restarting, refreshing
the balance and removing the key. No live-provider test can run without a key.
