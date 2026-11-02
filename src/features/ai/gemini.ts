import "server-only";
import { GoogleGenAI, type Content, type GenerateContentParameters, type GenerateContentResponse } from "@google/genai";
import type { z } from "zod";
import {
  alternativesResultSchema,
  dayResultSchema,
  formatZodError,
  ideasResultSchema,
  jsonSchemaFor,
  outlineResultSchema,
  type ResultKind,
} from "@/lib/schemas/itinerary";
import { AiError, type ItineraryGenerator, type OnAiCall } from "./generator";
import {
  buildAlternativesPrompt,
  buildDayPrompt,
  buildIdeasPrompt,
  buildOutlinePrompt,
  buildRetryMessage,
  type Prompt,
} from "./prompts";
import type { DayRequest, SlotRequest, TripContext } from "./types";

export type GeminiModels = { generateContent(p: GenerateContentParameters): Promise<GenerateContentResponse> };

export type GeminiOptions = {
  model: string;
  onCall: OnAiCall;
  apiKey?: string;
  /** Untuk test: ganti `ai.models`. */
  client?: GeminiModels;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
};

const RATE_LIMIT_BACKOFF_MS = [2000, 4000, 8000];
const BLOCK_REASONS = new Set(["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "RECITATION"]);

// Subset JSON Schema yang didukung `responseJsonSchema` (lihat GenerateContentConfig di @google/genai).
const GEMINI_SCHEMA_KEYS = new Set([
  "$id", "$defs", "$ref", "$anchor", "type", "format", "title", "description", "enum", "items",
  "prefixItems", "minItems", "maxItems", "minimum", "maximum", "anyOf", "oneOf", "properties",
  "additionalProperties", "required", "propertyOrdering",
]);

/** Buang keyword yang tidak didukung Gemini (pattern, minLength, $schema, ...). Validasi tetap oleh zod. */
export function toGeminiSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(toGeminiSchema);
  if (!node || typeof node !== "object") return node;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node)) {
    if (!GEMINI_SCHEMA_KEYS.has(k)) continue;
    out[k] =
      k === "properties" || k === "$defs"
        ? Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([p, s]) => [p, toGeminiSchema(s)]))
        : typeof v === "object"
          ? toGeminiSchema(v)
          : v;
  }
  return out;
}

const statusOf = (e: unknown) =>
  typeof (e as { status?: unknown })?.status === "number" ? (e as { status: number }).status : undefined;
const short = (s: string) => s.slice(0, 300);

export class GeminiGenerator implements ItineraryGenerator {
  private readonly models: GeminiModels;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(private readonly opts: GeminiOptions) {
    // Tanpa retryOptions: SDK tidak me-retry sendiri, sehingga setiap panggilan tercatat lewat onCall.
    this.models = opts.client ?? new GoogleGenAI({ apiKey: opts.apiKey }).models;
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  outline(ctx: TripContext) {
    return this.run("outline", buildOutlinePrompt(ctx), outlineResultSchema);
  }
  day(ctx: TripContext, day: DayRequest) {
    return this.run("day", buildDayPrompt(ctx, day), dayResultSchema);
  }
  ideas(ctx: TripContext, existing: string[]) {
    return this.run("ideas", buildIdeasPrompt(ctx, existing), ideasResultSchema);
  }
  alternatives(ctx: TripContext, slot: SlotRequest) {
    return this.run("alternatives", buildAlternativesPrompt(ctx, slot), alternativesResultSchema);
  }

  private async run<S extends z.ZodType>(kind: ResultKind, prompt: Prompt, schema: S): Promise<z.output<S>> {
    const { model, onCall } = this.opts;
    const contents: Content[] = [{ role: "user", parts: [{ text: prompt.user }] }];
    const responseJsonSchema = toGeminiSchema(jsonSchemaFor(kind));
    let attempts = 0;
    let rateRetries = 0;
    let transientRetries = 0;
    let invalidRetries = 0;

    for (;;) {
      attempts++;
      const started = Date.now();
      const record = (ok: boolean, error: string | null, res?: GenerateContentResponse) =>
        onCall({
          ok,
          error,
          model,
          durationMs: Date.now() - started,
          inputTokens: res?.usageMetadata?.promptTokenCount ?? null,
          outputTokens: res?.usageMetadata?.candidatesTokenCount ?? null,
        });

      let res: GenerateContentResponse;
      try {
        res = await this.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction: prompt.system,
            responseMimeType: "application/json",
            responseJsonSchema,
            temperature: 0.7,
            httpOptions: { timeout: this.opts.timeoutMs ?? 40_000 },
          },
        });
      } catch (e) {
        const status = statusOf(e);
        const msg = short(`${status ?? "network"}: ${e instanceof Error ? e.message : String(e)}`);
        await record(false, msg);
        if (status === 429) {
          if (rateRetries < RATE_LIMIT_BACKOFF_MS.length) {
            await this.sleep(RATE_LIMIT_BACKOFF_MS[rateRetries++]);
            continue;
          }
          throw new AiError("rate_limited", attempts, msg);
        }
        // Timeout/jaringan (tanpa status), 408, 5xx → retry 1x. 4xx lain (kunci salah, request invalid) → gagal.
        if ((status === undefined || status === 408 || status >= 500) && transientRetries < 1) {
          transientRetries++;
          continue;
        }
        throw new AiError("upstream", attempts, msg);
      }

      const blockReason =
        res.promptFeedback?.blockReason ??
        (BLOCK_REASONS.has(String(res.candidates?.[0]?.finishReason)) ? res.candidates?.[0]?.finishReason : undefined);
      if (blockReason) {
        const msg = `blocked: ${blockReason}`;
        await record(false, msg, res);
        throw new AiError("blocked", attempts, msg);
      }

      const text = res.text ?? "";
      let errors: string;
      try {
        const parsed = schema.safeParse(JSON.parse(text));
        if (parsed.success) {
          await record(true, null, res);
          return parsed.data;
        }
        errors = formatZodError(parsed.error);
      } catch {
        errors = "- (dokumen): bukan JSON yang valid";
      }
      await record(false, short(`invalid_output:\n${errors}`), res);
      if (invalidRetries++ >= 1) throw new AiError("invalid_output", attempts, errors);
      contents.push({ role: "model", parts: [{ text }] }, { role: "user", parts: [{ text: buildRetryMessage(errors) }] });
    }
  }
}
