import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { GenerateContentParameters, GenerateContentResponse } from "@google/genai";
import { buildTripContext } from "./context";
import { GeminiGenerator, toGeminiSchema, type GeminiModels } from "./gemini";
import type { AiCallRecord } from "./generator";
import { AiError } from "./generator";

const ctx = buildTripContext({
  country_code: "JP",
  cities: ["Kyoto"],
  start_date: "2026-12-01",
  end_date: "2026-12-02",
  travelers_count: 2,
  interests: [],
  interests_note: null,
  pace: "santai",
  budget_level: "sedang",
});
const validOutline = { days: [{ dayIndex: 0, theme: "Kuil", city: "Kyoto" }, { dayIndex: 1, theme: "Alam", city: "Kyoto" }] };

const ok = (body: unknown) =>
  ({ text: JSON.stringify(body), usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50 } }) as unknown as GenerateContentResponse;
const httpError = (status: number) => Object.assign(new Error(`HTTP ${status}`), { status });

type Step = GenerateContentResponse | Error;
function setup(steps: Step[], useRealSleep = false) {
  const calls: GenerateContentParameters[] = [];
  const client: GeminiModels = {
    generateContent: vi.fn(async (p: GenerateContentParameters) => {
      calls.push(structuredClone(p));
      const s = steps.shift();
      if (!s) throw new Error("no more steps");
      if (s instanceof Error) throw s;
      return s;
    }),
  };
  const records: AiCallRecord[] = [];
  const sleeps: number[] = [];
  const gen = new GeminiGenerator({
    model: "gemini-test",
    client,
    onCall: (r) => void records.push(r),
    sleep: useRealSleep ? undefined : async (ms) => void sleeps.push(ms),
  });
  return { gen, calls, records, sleeps };
}

afterEach(() => vi.useRealTimers());

describe("GeminiGenerator", () => {
  it("sukses: structured output JSON + 1 record dengan token", async () => {
    const { gen, calls, records } = setup([ok(validOutline)]);
    await expect(gen.outline(ctx)).resolves.toEqual(validOutline);
    expect(calls[0].config).toMatchObject({ responseMimeType: "application/json", systemInstruction: expect.stringContaining("Bahasa Indonesia") });
    expect(JSON.stringify(calls[0].config?.responseJsonSchema)).not.toMatch(/"pattern"|"minLength"|"\$schema"/);
    expect(records).toEqual([{ ok: true, error: null, model: "gemini-test", durationMs: expect.any(Number), inputTokens: 100, outputTokens: 50 }]);
  });

  it("output invalid → retry 1x dengan pesan validasi, lalu sukses", async () => {
    const { gen, calls, records } = setup([ok({ days: [] }), ok(validOutline)]);
    await expect(gen.outline(ctx)).resolves.toEqual(validOutline);
    expect(records.map((r) => r.ok)).toEqual([false, true]);
    const contents = calls[1].contents as { role: string; parts: { text: string }[] }[];
    expect(contents).toHaveLength(3);
    expect(contents[1].role).toBe("model");
    expect(contents[2].parts[0].text).toMatch(/Output sebelumnya tidak valid:\n- days: Outline minimal 1 hari/);
  });

  it("output invalid 2x → AiError invalid_output, 2 record", async () => {
    const { gen, records } = setup([ok({ days: [] }), { text: "bukan json" } as unknown as GenerateContentResponse]);
    const err = await gen.outline(ctx).catch((e) => e);
    expect(err).toBeInstanceOf(AiError);
    expect(err).toMatchObject({ code: "invalid_output", attempts: 2 });
    expect(records).toHaveLength(2);
  });

  it("429 → backoff 2s/4s/8s lalu sukses; setiap percobaan tercatat", async () => {
    const { gen, records, sleeps } = setup([httpError(429), httpError(429), httpError(429), ok(validOutline)]);
    await gen.outline(ctx);
    expect(sleeps).toEqual([2000, 4000, 8000]);
    expect(records.map((r) => r.ok)).toEqual([false, false, false, true]);
    expect(records[0].error).toMatch(/^429/);
  });

  it("429 terus → rate_limited setelah 4 percobaan", async () => {
    const { gen, records } = setup(Array.from({ length: 5 }, () => httpError(429)));
    await expect(gen.outline(ctx)).rejects.toMatchObject({ code: "rate_limited", attempts: 4 });
    expect(records).toHaveLength(4);
  });

  it("backoff memakai timer nyata (fake timers)", async () => {
    vi.useFakeTimers();
    const { gen } = setup([httpError(429), ok(validOutline)], true);
    let done = false;
    const p = gen.outline(ctx).then(() => (done = true));
    await vi.advanceTimersByTimeAsync(1999);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await p;
    expect(done).toBe(true);
  });

  it("5xx / timeout → retry 1x; gagal lagi → upstream", async () => {
    const a = setup([httpError(503), ok(validOutline)]);
    await expect(a.gen.outline(ctx)).resolves.toEqual(validOutline);
    expect(a.sleeps).toEqual([]);

    const b = setup([new Error("The operation was aborted due to timeout"), httpError(500)]);
    await expect(b.gen.outline(ctx)).rejects.toMatchObject({ code: "upstream", attempts: 2 });
    expect(b.records.map((r) => r.ok)).toEqual([false, false]);
  });

  it("4xx lain (mis. 400/403) → upstream tanpa retry", async () => {
    const { gen, records } = setup([httpError(403)]);
    await expect(gen.outline(ctx)).rejects.toMatchObject({ code: "upstream", attempts: 1 });
    expect(records).toHaveLength(1);
  });

  it("diblokir safety → blocked tanpa retry", async () => {
    const a = setup([{ promptFeedback: { blockReason: "SAFETY" } } as unknown as GenerateContentResponse]);
    await expect(a.gen.outline(ctx)).rejects.toMatchObject({ code: "blocked", attempts: 1 });
    const b = setup([{ candidates: [{ finishReason: "PROHIBITED_CONTENT" }] } as unknown as GenerateContentResponse]);
    await expect(b.gen.outline(ctx)).rejects.toMatchObject({ code: "blocked" });
    expect(b.records[0]).toMatchObject({ ok: false, error: "blocked: PROHIBITED_CONTENT" });
  });

  it("pesan AiError aman untuk user (Indonesia)", () => {
    expect(new AiError("rate_limited", 1).message).toMatch(/mode import/);
  });
});

describe("toGeminiSchema", () => {
  it("membuang keyword tak didukung tapi mempertahankan nama properti", () => {
    expect(
      toGeminiSchema({
        $schema: "x",
        type: "object",
        properties: { pattern: { type: "string", pattern: "^a$", minLength: 1 }, t: { anyOf: [{ type: "string" }, { type: "null" }] } },
        required: ["pattern"],
        additionalProperties: false,
      }),
    ).toEqual({
      type: "object",
      properties: { pattern: { type: "string" }, t: { anyOf: [{ type: "string" }, { type: "null" }] } },
      required: ["pattern"],
      additionalProperties: false,
    });
  });
});
