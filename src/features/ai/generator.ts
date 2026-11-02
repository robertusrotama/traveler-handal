import type {
  AlternativesResult,
  DayRequest,
  DayResult,
  IdeasResult,
  OutlineResult,
  SlotRequest,
  TripContext,
} from "./types";

/** Antarmuka provider AI (ADR-0005) — disengaja agar provider bisa diganti via config. */
export interface ItineraryGenerator {
  outline(ctx: TripContext): Promise<OutlineResult>;
  day(ctx: TripContext, day: DayRequest): Promise<DayResult>;
  ideas(ctx: TripContext, existing: string[]): Promise<IdeasResult>;
  alternatives(ctx: TripContext, slot: SlotRequest): Promise<AlternativesResult>;
}

export type AiErrorCode = "invalid_output" | "rate_limited" | "blocked" | "upstream";

const MESSAGES: Record<AiErrorCode, string> = {
  invalid_output: "AI memberi jawaban yang tidak sesuai format. Coba lagi.",
  rate_limited: "Layanan AI sedang sibuk atau kuotanya habis. Coba lagi nanti atau pakai mode import.",
  blocked: "Permintaan ini tidak bisa diproses oleh AI. Coba ubah instruksi atau pakai mode import.",
  upstream: "Layanan AI sedang bermasalah. Coba lagi.",
};

/** Error bertipe dari generator. `message` aman ditampilkan ke user; `detail` untuk log (tanpa data pribadi). */
export class AiError extends Error {
  constructor(
    readonly code: AiErrorCode,
    readonly attempts: number,
    readonly detail?: string,
  ) {
    super(MESSAGES[code]);
    this.name = "AiError";
  }
}

/** Satu panggilan ke provider (termasuk retry & gagal) → satu baris `ai_generations`. */
export type AiCallRecord = {
  ok: boolean;
  durationMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  error: string | null;
  model: string;
};
export type OnAiCall = (call: AiCallRecord) => void | Promise<void>;
