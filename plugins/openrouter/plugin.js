(function () {
  function isMoney(value) {
    return typeof value === "number" && Number.isFinite(value);
  }

  function request(ctx, key, path) {
    var resp;
    try {
      resp = ctx.host.http.request({
        method: "GET",
        url: "https://openrouter.ai/api/v1/" + path,
        headers: { Authorization: "Bearer " + key, Accept: "application/json" },
        timeoutMs: 10000,
      });
    } catch (e) {
      throw "Could not connect to OpenRouter. Check your connection and try again.";
    }
    if (resp.status === 401) throw "API key invalid or expired. Update your OpenRouter API key.";
    if (resp.status === 429) throw "OpenRouter rate limit reached. Try again later.";
    return resp;
  }

  function probe(ctx) {
    var key = ctx.host.credentials.getApiKey();
    if (!key) throw "API key required. Open OpenRouter and save your API key.";
    var keyResp = request(ctx, key, "key");
    if (keyResp.status !== 200) throw "OpenRouter key request failed (HTTP " + keyResp.status + "). Try again later.";
    var keyJson = ctx.util.tryParseJson(keyResp.bodyText);
    var data = keyJson && keyJson.data;
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw "OpenRouter returned invalid key data. Try again later.";
    }

    var lines = [];
    var creditsResp = request(ctx, key, "credits");
    if (creditsResp.status === 403) {
      lines.push(ctx.line.text({
        label: "Account balance",
        value: "Management key required",
        subtitle: "A regular API key reports its allowance, not your account balance.",
      }));
    } else {
      if (creditsResp.status !== 200) throw "OpenRouter balance request failed (HTTP " + creditsResp.status + "). Try again later.";
      var creditsJson = ctx.util.tryParseJson(creditsResp.bodyText);
      var credits = creditsJson && creditsJson.data;
      if (!credits || !isMoney(credits.total_credits) || !isMoney(credits.total_usage)) {
        throw "OpenRouter returned invalid balance data. Try again later.";
      }
      lines.push(ctx.line.text({
        label: "Account balance",
        value: "$" + (credits.total_credits - credits.total_usage).toFixed(2),
        amountUsd: credits.total_credits - credits.total_usage,
        subtitle: "Prepaid account credits remaining",
      }));
    }
    if (isMoney(data.limit_remaining)) {
      lines.push(ctx.line.text({
        label: "Key remaining",
        value: "$" + data.limit_remaining.toFixed(2),
        amountUsd: data.limit_remaining,
        subtitle: "Key spending allowance; also subject to your account balance",
      }));
    } else if (data.limit === null) {
      lines.push(ctx.line.text({ label: "Key limit", value: "No key spending limit" }));
    } else if (creditsResp.status === 403) {
      throw "OpenRouter did not return a remaining key allowance. Use a management key to read the account balance.";
    }
    var fields = [
      ["usage", "Key usage"],
      ["usage_daily", "Today"],
      ["usage_monthly", "This month"],
    ];
    for (var i = 0; i < fields.length; i++) {
      if (isMoney(data[fields[i][0]])) {
        lines.push(ctx.line.text({ label: fields[i][1], value: "$" + data[fields[i][0]].toFixed(2), amountUsd: data[fields[i][0]] }));
      }
    }
    return { lines: lines };
  }

  globalThis.__openusage_plugin = { id: "openrouter", probe: probe };
})();
