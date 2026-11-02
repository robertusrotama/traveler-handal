import type { ActivityItem } from "@/lib/schemas/itinerary";
import type { Budget, Category, Interest, Pace } from "@/lib/schemas/trip";
export type {
  ActivityItem,
  AlternativesResult,
  DayResult,
  IdeaItem,
  IdeasResult,
  ImportPayload,
  OutlineResult,
} from "@/lib/schemas/itinerary";

/** Satu-satunya data yang boleh dikirim ke provider AI (ADR-0005). Tanpa data pribadi. */
export type TripContext = {
  countryCode: string;
  cities: string[];
  startDate: string; // YYYY-MM-DD
  endDate: string;
  durationDays: number;
  travelersCount: number;
  interests: Interest[];
  interestsNote: string | null;
  pace: Pace;
  budgetLevel: Budget;
  /** Judul aktivitas/tempat yang sudah ada (hindari duplikat). */
  existingPlaces: string[];
  /** Instruksi bebas user (regenerate), ≤ 500 karakter. */
  instruction: string | null;
};

export type DayRequest = {
  dayIndex: number; // 0-based
  date: string; // YYYY-MM-DD
  city: string | null;
  theme: string | null;
};

export type SlotRequest = DayRequest & {
  current: Pick<ActivityItem, "title" | "startTime" | "durationMin"> & { category: Category | string };
};
