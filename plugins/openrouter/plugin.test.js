import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeCtx } from "../test-helpers.js";

function context(keyData = { limit: 100, limit_remaining: 74.5, usage: 25.5 }) {
  const ctx = makeCtx();
  ctx.host.credentials = { getApiKey: vi.fn(() => "example-test-key") };
  ctx.host.http.request.mockImplementation(({ url }) => url.endsWith("/key")
    ? { status: 200, bodyText: JSON.stringify({ data: keyData }) }
    : { status: 200, bodyText: JSON.stringify({ data: { total_credits: 100.5, total_usage: 25.75 } }) });
  return ctx;
}

describe("OpenRouter balance plugin", () => {
  let plugin;
  beforeEach(async () => {
    vi.resetModules();
    await import("./plugin.js");
    plugin = globalThis.__openusage_plugin;
  });

  it("keeps account credits and key allowance separate and sends read-only authenticated requests", () => {
    const ctx = context();
    const { lines } = plugin.probe(ctx);
    expect(lines).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Account balance", value: "$74.75", amountUsd: 74.75 }),
      expect.objectContaining({ label: "Key remaining", value: "$74.50", amountUsd: 74.5 }),
    ]));
    expect(ctx.host.http.request.mock.calls.map(([request]) => request.url)).toEqual([
      "https://openrouter.ai/api/v1/key", "https://openrouter.ai/api/v1/credits",
    ]);
    for (const [request] of ctx.host.http.request.mock.calls) {
      expect(request.method).toBe("GET");
      expect(request.headers.Authorization).toBe("Bearer example-test-key");
      expect(request.bodyText).toBeUndefined();
    }
  });

  it("shows zero allowance with a regular key when account credits require management access", () => {
    const ctx = context({ limit: 10, limit_remaining: 0, usage: 10 });
    ctx.host.http.request.mockReturnValueOnce({ status: 200, bodyText: JSON.stringify({ data: { limit_remaining: 0 } }) })
      .mockReturnValueOnce({ status: 403, bodyText: "Forbidden" });
    expect(plugin.probe(ctx).lines).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Key remaining", value: "$0.00" }),
      expect.objectContaining({ label: "Account balance", value: "Management key required" }),
    ]));
  });

  it("does not present an unlimited key as unlimited account funds", () => {
    const ctx = context({ limit: null, limit_remaining: null, usage: 0 });
    ctx.host.http.request.mockImplementation(({ url }) => url.endsWith("/key")
      ? { status: 200, bodyText: JSON.stringify({ data: { limit: null, limit_remaining: null } }) }
      : { status: 403, bodyText: "" });
    const { lines } = plugin.probe(ctx);
    expect(lines).toContainEqual(expect.objectContaining({ label: "Key limit", value: "No key spending limit" }));
    expect(lines.some((line) => line.label === "Key remaining")).toBe(false);
  });

  it("uses reported remaining allowance, independently of lifetime usage and reset period", () => {
    const ctx = context({ limit: 10, limit_remaining: 8, limit_reset: "daily", usage: 200, usage_daily: 2 });
    expect(plugin.probe(ctx).lines).toContainEqual(expect.objectContaining({ label: "Key remaining", value: "$8.00" }));
  });

  it("preserves a negative account balance", () => {
    const ctx = context();
    ctx.host.http.request.mockReturnValueOnce({ status: 200, bodyText: '{"data":{"limit":null}}' })
      .mockReturnValueOnce({ status: 200, bodyText: '{"data":{"total_credits":10,"total_usage":11.25}}' });
    expect(plugin.probe(ctx).lines).toContainEqual(expect.objectContaining({ label: "Account balance", value: "$-1.25" }));
  });

  it("does not call the API without a saved key", () => {
    const ctx = context();
    ctx.host.credentials.getApiKey.mockReturnValue(null);
    expect(() => plugin.probe(ctx)).toThrow("API key required");
    expect(ctx.host.http.request).not.toHaveBeenCalled();
  });

  it.each([[401, "invalid or expired"], [429, "rate limit"], [500, "HTTP 500"]])("handles HTTP %i without echoing the response", (status, message) => {
    const ctx = context();
    ctx.host.http.request.mockReturnValue({ status, bodyText: "sensitive upstream error" });
    expect(() => plugin.probe(ctx)).toThrow(message);
  });

  it.each(["not JSON", '{"data":null}', '{"data":[]}'])("rejects malformed key data: %s", (bodyText) => {
    const ctx = context();
    ctx.host.http.request.mockReturnValue({ status: 200, bodyText });
    expect(() => plugin.probe(ctx)).toThrow("invalid key data");
  });

  it.each([null, "", "100", false])("does not coerce invalid credit values (%s) to a balance", (total_credits) => {
    const ctx = context();
    ctx.host.http.request.mockReturnValueOnce({ status: 200, bodyText: '{"data":{"limit":null}}' })
      .mockReturnValueOnce({ status: 200, bodyText: JSON.stringify({ data: { total_credits, total_usage: 0 } }) });
    expect(() => plugin.probe(ctx)).toThrow("invalid balance data");
  });

  it("handles transport failures without echoing the thrown error", () => {
    const ctx = context();
    ctx.host.http.request.mockImplementation(() => { throw new Error("sensitive upstream error"); });
    expect(() => plugin.probe(ctx)).toThrow("Could not connect to OpenRouter");
  });
});
