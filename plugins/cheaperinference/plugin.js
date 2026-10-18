(function () {
  function isMoney(value) {
    return typeof value === "number" && Number.isFinite(value);
  }

  function probe(ctx) {
    var key = ctx.host.credentials.getApiKey();
    if (!key) throw "API key required. Open CheaperInference and save a key with account:read access.";

    var resp;
    try {
      resp = ctx.host.http.request({
        method: "GET",
        url: "https://api.cheaperinference.com/v1/account/balance",
        headers: { Authorization: "Bearer " + key, Accept: "application/json" },
        timeoutMs: 10000,
      });
    } catch (e) {
      throw "Could not connect to CheaperInference. Check your connection and try again.";
    }
    if (resp.status === 401) throw "API key invalid or expired. Update your CheaperInference API key.";
    if (resp.status === 403) throw "This key needs account:read access. Enable that scope in CheaperInference and try again.";
    if (resp.status === 429) throw "CheaperInference rate limit reached. Try again later.";
    if (resp.status !== 200) throw "CheaperInference balance request failed (HTTP " + resp.status + "). Try again later.";

    var data = ctx.util.tryParseJson(resp.bodyText);
    if (!data || data.currency !== "USD" || !isMoney(data.available_usd)) {
      throw "CheaperInference returned invalid balance data. Try again later.";
    }
    var lines = [ctx.line.text({
      label: "Available balance",
      value: "$" + data.available_usd.toFixed(2),
      amountUsd: data.available_usd,
      subtitle: "Available after reservations for requests in flight",
    })];
    if (isMoney(data.balance_usd)) {
      lines.push(ctx.line.text({ label: "Wallet balance", value: "$" + data.balance_usd.toFixed(2), amountUsd: data.balance_usd }));
    }
    if (isMoney(data.reserved_usd)) {
      lines.push(ctx.line.text({ label: "Reserved", value: "$" + data.reserved_usd.toFixed(2), amountUsd: data.reserved_usd }));
    }
    if (typeof data.auto_recharge_enabled === "boolean") {
      lines.push(ctx.line.badge({ label: "Auto recharge", text: data.auto_recharge_enabled ? "On" : "Off" }));
    }
    return { lines: lines };
  }

  globalThis.__openusage_plugin = { id: "cheaperinference", probe: probe };
})();
