import { z } from "zod";
import { CATEGORIES, MAX_TRIP_DAYS, type Category } from "./trip";

z.config(z.locales.id());

export const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

// Kategori tak dikenal dari AI/import tidak menggagalkan output: jatuh ke "lainnya".
const categorySchema = z.preprocess((v) => {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  return (CATEGORIES as readonly string[]).includes(s) ? (s as Category) : "lainnya";
}, z.enum(CATEGORIES));

const title = z.string().trim().min(1, "Judul wajib diisi").max(120, "Judul maksimal 120 karakter");
const why = z.string().trim().max(200, "Alasan (why) maksimal 200 karakter");
const searchQuery = z
  .string()
  .trim()
  .min(1, "searchQuery wajib diisi")
  .max(200, "searchQuery maksimal 200 karakter");

export const activityItemSchema = z.object({
  title,
  category: categorySchema,
  startTime: z.string().regex(HHMM, 'Jam mulai harus format "HH:MM" (00:00–23:59) atau null').nullable(),
  durationMin: z
    .number()
    .int("Durasi harus bilangan bulat (menit)")
    .min(15, "Durasi minimal 15 menit")
    .max(600, "Durasi maksimal 600 menit"),
  why,
  searchQuery,
});

export const ideaItemSchema = z.object({ title, category: categorySchema, why, searchQuery });

const dayIndex = z.number().int("dayIndex harus bilangan bulat").min(0, "dayIndex mulai dari 0");
const theme = z.string().trim().min(1, "Tema hari wajib diisi").max(100, "Tema maksimal 100 karakter");
const city = z.string().trim().min(1, "Kota wajib diisi").max(100, "Nama kota maksimal 100 karakter");

export const outlineResultSchema = z.object({
  days: z
    .array(z.object({ dayIndex, theme, city }))
    .min(1, "Outline minimal 1 hari")
    .max(MAX_TRIP_DAYS, `Outline maksimal ${MAX_TRIP_DAYS} hari`),
});

export const dayResultSchema = z.object({
  dayIndex,
  theme,
  city,
  activities: z
    .array(activityItemSchema)
    .min(1, "Minimal 1 aktivitas per hari")
    .max(8, "Maksimal 8 aktivitas per hari"),
});

export const ideasResultSchema = z.object({
  ideas: z.array(ideaItemSchema).min(8, "Minimal 8 ide").max(15, "Maksimal 15 ide"),
});

export const alternativesResultSchema = z.object({
  alternatives: z.array(activityItemSchema).length(3, "Harus tepat 3 alternatif"),
});

export const importPayloadSchema = z
  .object({
    days: z
      .array(dayResultSchema)
      .min(1, "Minimal 1 hari")
      .max(MAX_TRIP_DAYS, `Maksimal ${MAX_TRIP_DAYS} hari`),
    ideas: z.array(ideaItemSchema).max(15, "Maksimal 15 ide").optional(),
  })
  .superRefine((v, ctx) => {
    const seen = new Set<number>();
    v.days.forEach((d, i) => {
      if (seen.has(d.dayIndex)) {
        ctx.addIssue({ code: "custom", path: ["days", i, "dayIndex"], message: `dayIndex ${d.dayIndex} muncul dua kali` });
      }
      seen.add(d.dayIndex);
    });
  });

export type ActivityItem = z.infer<typeof activityItemSchema>;
export type IdeaItem = z.infer<typeof ideaItemSchema>;
export type OutlineResult = z.infer<typeof outlineResultSchema>;
export type DayResult = z.infer<typeof dayResultSchema>;
export type IdeasResult = z.infer<typeof ideasResultSchema>;
export type AlternativesResult = z.infer<typeof alternativesResultSchema>;
export type ImportPayload = z.infer<typeof importPayloadSchema>;

export const resultSchemas = {
  outline: outlineResultSchema,
  day: dayResultSchema,
  ideas: ideasResultSchema,
  alternatives: alternativesResultSchema,
  import: importPayloadSchema,
} as const;
export type ResultKind = keyof typeof resultSchemas;

/** JSON Schema (draft 2020-12) dari schema zod — untuk prompt import & structured output. */
export function jsonSchemaFor(kind: ResultKind): Record<string, unknown> {
  return z.toJSONSchema(resultSchemas[kind]) as Record<string, unknown>;
}

function formatPath(path: PropertyKey[]): string {
  if (path.length === 0) return "(dokumen)";
  return path.reduce<string>(
    (acc, p) => (typeof p === "number" ? `${acc}[${p}]` : acc ? `${acc}.${String(p)}` : String(p)),
    "",
  );
}

/** Daftar error singkat yang bisa dibaca manusia (UI import & pesan retry AI). */
export function formatZodError(err: z.ZodError, max = 10): string {
  const lines = err.issues.slice(0, max).map((i) => `- ${formatPath(i.path)}: ${i.message}`);
  const rest = err.issues.length - max;
  if (rest > 0) lines.push(`- …dan ${rest} kesalahan lain`);
  return lines.join("\n");
}
