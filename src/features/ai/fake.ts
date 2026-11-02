import {
  alternativesResultSchema,
  dayResultSchema,
  ideasResultSchema,
  outlineResultSchema,
  type ActivityItem,
} from "@/lib/schemas/itinerary";
import type { Category } from "@/lib/schemas/trip";
import { AiError, type ItineraryGenerator, type OnAiCall } from "./generator";
import { PACE_TARGET } from "./prompts";
import type { DayRequest, SlotRequest, TripContext } from "./types";

const SPOTS: { name: string; category: Category }[] = [
  { name: "Pasar Pagi", category: "kuliner" },
  { name: "Taman Kota", category: "alam" },
  { name: "Museum Sejarah", category: "sejarah_budaya" },
  { name: "Galeri Seni", category: "seni_museum" },
  { name: "Pusat Belanja", category: "belanja" },
  { name: "Kafe Lokal", category: "kuliner" },
  { name: "Spa Tradisional", category: "santai_spa" },
  { name: "Bukit Pandang", category: "outdoor" },
  { name: "Distrik Malam", category: "hiburan_malam" },
  { name: "Kuil Tua", category: "sejarah_budaya" },
  { name: "Danau Biru", category: "alam" },
  { name: "Warung Legendaris", category: "kuliner" },
];

/** Penanda di instruksi user untuk mensimulasikan kegagalan provider (E2E "Coba lagi"). */
export const FAKE_FAIL_MARKER = "paksa-gagal";

/** Generator deterministik tanpa jaringan untuk test & E2E (`AI_PROVIDER=fake`). */
export class FakeGenerator implements ItineraryGenerator {
  constructor(private readonly onCall: OnAiCall = () => {}) {}

  private async call<T>(ctx: TripContext, fn: () => T): Promise<T> {
    if (ctx.instruction?.includes(FAKE_FAIL_MARKER)) {
      await this.onCall({ ok: false, durationMs: 1, inputTokens: null, outputTokens: null, error: "fake failure", model: "fake" });
      throw new AiError("upstream", 1, "fake failure");
    }
    const out = fn();
    await this.onCall({ ok: true, durationMs: 1, inputTokens: 0, outputTokens: 0, error: null, model: "fake" });
    return out;
  }

  private activity(city: string, k: number, hour: number): ActivityItem {
    const s = SPOTS[k % SPOTS.length];
    const title = `${s.name} ${city}`;
    return {
      title,
      category: s.category,
      startTime: `${String(hour).padStart(2, "0")}:00`,
      durationMin: 90,
      why: `Contoh aktivitas ${s.name.toLowerCase()} di ${city}.`,
      searchQuery: `${title}, ${city}`,
    };
  }

  outline(ctx: TripContext) {
    return this.call(ctx, () =>
      outlineResultSchema.parse({
        days: Array.from({ length: ctx.durationDays }, (_, i) => {
          const city = ctx.cities[Math.floor((i * ctx.cities.length) / ctx.durationDays)];
          return { dayIndex: i, theme: `Jelajah ${city} hari ${i + 1}`, city };
        }),
      }),
    );
  }

  day(ctx: TripContext, day: DayRequest) {
    const city = day.city ?? ctx.cities[0];
    const n = PACE_TARGET[ctx.pace];
    return this.call(ctx, () =>
      dayResultSchema.parse({
        dayIndex: day.dayIndex,
        theme: day.theme ?? `Jelajah ${city}`,
        city,
        activities: Array.from({ length: n }, (_, k) => this.activity(city, day.dayIndex * n + k, 9 + k * 2)),
      }),
    );
  }

  ideas(ctx: TripContext, existing: string[]) {
    void existing; // judul ide selalu unik ("Ide n: ..."), jadi tidak bentrok dengan yang ada
    const ideas = Array.from({ length: 10 }, (_, k) => {
      const city = ctx.cities[k % ctx.cities.length];
      const { title, category, why, searchQuery } = this.activity(city, k, 10);
      return { title: `Ide ${k + 1}: ${title}`, category, why, searchQuery };
    });
    return this.call(ctx, () => ideasResultSchema.parse({ ideas }));
  }

  alternatives(ctx: TripContext, slot: SlotRequest) {
    const city = slot.city ?? ctx.cities[0];
    const hour = Number(slot.current.startTime?.slice(0, 2)) || 10;
    return this.call(ctx, () =>
      alternativesResultSchema.parse({
        alternatives: [1, 2, 3].map((k) => {
          const a = this.activity(city, slot.dayIndex + k * 3, hour);
          return { ...a, title: `Alternatif ${k}: ${a.title}` };
        }),
      }),
    );
  }
}
