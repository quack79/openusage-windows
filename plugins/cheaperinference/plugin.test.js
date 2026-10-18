import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeCtx } from "../test-helpers.js";

function context(data = { currency: "USD", balance_usd: 25, available_usd: 22.5, reserved_usd: 2.5, auto_recharge_enabled: false }) {
  const ctx = makeCtx();
  ctx.host.credentials = { getApiKey: vi.fn(() => "example-test-key") };
  ctx.host.http.request.mockReturnValue({ status: 200, bodyText: JSON.stringify(data) });
  return ctx;
}

describe("CheaperInference balance plugin", () => {
  let plugin;
  beforeEach(async () => {
    vi.resetModules();
    await import("./plugin.js");
    plugin = globalThis.__openusage_plugin;
  });

  it("reports available funds after reservations and keeps wallet balance separate", () => {
    const ctx = context();
    expect(plugin.probe(ctx).lines).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Available balance", value: "$22.50", amountUsd: 22.5 }),
      expect.objectContaining({ label: "Wallet balance", value: "$25.00", amountUsd: 25 }),
      expect.objectContaining({ label: "Reserved", value: "$2.50", amountUsd: 2.5 }),
      expect.objectContaining({ label: "Auto recharge", text: "Off" }),
    ]));
    expect(ctx.host.http.request).toHaveBeenCalledWith({
      method: "GET",
      url: "https://api.cheaperinference.com/v1/account/balance",
      headers: { Authorization: "Bearer example-test-key", Accept: "application/json" },
      timeoutMs: 10000,
    });
  });

  it.each([0, -1.25])("preserves an available balance of %s", (available_usd) => {
    expect(plugin.probe(context({ currency: "USD", available_usd })).lines).toContainEqual(
      expect.objectContaining({ label: "Available balance", value: "$" + available_usd.toFixed(2) }),
    );
  });

  it("requires a saved key before making requests", () => {
    const ctx = context();
    ctx.host.credentials.getApiKey.mockReturnValue(null);
    expect(() => plugin.probe(ctx)).toThrow("API key required");
    expect(ctx.host.http.request).not.toHaveBeenCalled();
  });

  it.each([[401, "invalid or expired"], [403, "account:read"], [429, "rate limit"], [500, "HTTP 500"]])("handles HTTP %i with actionable errors", (status, message) => {
    const ctx = context();
    ctx.host.http.request.mockReturnValue({ status, bodyText: "sensitive upstream error" });
    expect(() => plugin.probe(ctx)).toThrow(message);
  });

  it.each([null, {}, { balance_usd: 20 }, { currency: "EUR", available_usd: 20 }, { currency: "USD", available_usd: null }, { currency: "USD", available_usd: "20" }])("rejects missing or invalid available balance: %j", (data) => {
    expect(() => plugin.probe(context(data))).toThrow("invalid balance data");
  });

  it("handles malformed JSON", () => {
    const ctx = context();
    ctx.host.http.request.mockReturnValue({ status: 200, bodyText: "<html>Unavailable</html>" });
    expect(() => plugin.probe(ctx)).toThrow("invalid balance data");
  });

  it("handles transport failures without echoing the thrown error", () => {
    const ctx = context();
    ctx.host.http.request.mockImplementation(() => { throw new Error("sensitive upstream error"); });
    expect(() => plugin.probe(ctx)).toThrow("Could not connect to CheaperInference");
  });
});
