import { z } from "zod";

// Pesan bawaan zod (yang tidak di-override) dalam Bahasa Indonesia.
z.config(z.locales.id());

export const CATEGORIES = [
  "kuliner",
  "alam",
  "sejarah_budaya",
  "belanja",
  "seni_museum",
  "hiburan_malam",
  "santai_spa",
  "outdoor",
  "transportasi",
  "akomodasi",
  "lainnya",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  kuliner: "Kuliner",
  alam: "Alam",
  sejarah_budaya: "Sejarah & Budaya",
  belanja: "Belanja",
  seni_museum: "Seni & Museum",
  hiburan_malam: "Hiburan Malam",
  santai_spa: "Santai/Spa",
  outdoor: "Aktivitas Outdoor",
  transportasi: "Transportasi",
  akomodasi: "Akomodasi",
  lainnya: "Lainnya",
};

// Minat PRD F2 = 8 kategori pertama.
export const INTERESTS = [
  "kuliner",
  "alam",
  "sejarah_budaya",
  "belanja",
  "seni_museum",
  "hiburan_malam",
  "santai_spa",
  "outdoor",
] as const satisfies readonly Category[];
export type Interest = (typeof INTERESTS)[number];
export const INTEREST_LABELS: Record<Interest, string> = CATEGORY_LABELS;

export const PACES = ["santai", "sedang", "padat"] as const;
export type Pace = (typeof PACES)[number];
export const PACE_LABELS: Record<Pace, string> = { santai: "Santai", sedang: "Sedang", padat: "Padat" };

export const BUDGETS = ["hemat", "sedang", "mewah"] as const;
export type Budget = (typeof BUDGETS)[number];
export const BUDGET_LABELS: Record<Budget, string> = { hemat: "Hemat", sedang: "Sedang", mewah: "Mewah" };

export const MAX_TRIP_DAYS = 21;

/** Jumlah hari inklusif antara dua tanggal ISO (YYYY-MM-DD). */
export function tripDurationDays(startDate: string, endDate: string): number {
  return Math.round((Date.parse(endDate) - Date.parse(startDate)) / 86_400_000) + 1;
}

const isoDate = (label: string) => z.iso.date({ error: `${label} wajib diisi dengan format tanggal yang valid` });

export const tripFormSchema = z
  .object({
    title: z.string().trim().max(100, "Judul maksimal 100 karakter").optional(),
    country_code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2}$/, "Pilih negara (kode ISO 2 huruf)"),
    cities: z
      .array(z.string().trim().min(1, "Nama kota tidak boleh kosong").max(100, "Nama kota maksimal 100 karakter"))
      .min(1, "Minimal 1 kota")
      .max(10, "Maksimal 10 kota"),
    start_date: isoDate("Tanggal mulai"),
    end_date: isoDate("Tanggal selesai"),
    travelers_count: z
      .number({ error: "Jumlah orang wajib diisi" })
      .int("Jumlah orang harus bilangan bulat")
      .min(1, "Minimal 1 orang")
      .max(50, "Maksimal 50 orang"),
    interests: z.array(z.enum(INTERESTS, { error: "Minat tidak dikenal" })),
    interests_note: z.string().trim().max(300, "Catatan minat maksimal 300 karakter").optional(),
    pace: z.enum(PACES, { error: "Pilih tempo perjalanan" }),
    budget_level: z.enum(BUDGETS, { error: "Pilih level budget" }),
  })
  .superRefine((v, ctx) => {
    const days = tripDurationDays(v.start_date, v.end_date);
    if (days < 1) {
      ctx.addIssue({ code: "custom", path: ["end_date"], message: "Tanggal selesai tidak boleh sebelum tanggal mulai" });
    } else if (days > MAX_TRIP_DAYS) {
      ctx.addIssue({ code: "custom", path: ["end_date"], message: `Durasi trip maksimal ${MAX_TRIP_DAYS} hari` });
    }
  });

export type TripFormInput = z.input<typeof tripFormSchema>;
export type TripFormValues = z.output<typeof tripFormSchema>;

export function defaultTripTitle(v: Pick<TripFormValues, "title" | "cities">): string {
  return v.title?.trim() || `Trip ke ${v.cities[0]}`;
}
