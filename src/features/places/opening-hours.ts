export type OpeningCheck = "open" | "closed" | "unknown";

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const RULE = /^(?:([A-Z][a-z])(?:-([A-Z][a-z]))?\s+)?(\d{2}:\d{2}-\d{2}:\d{2}(?:\s*,\s*\d{2}:\d{2}-\d{2}:\d{2})*)$/;
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/**
 * Best effort: hanya format sederhana satu aturan, mis. "Mo-Su 09:00-17:00", "10:00-14:00, 17:00-22:00",
 * "Tu-Su 09:00-17:00" (butuh `date` untuk cek hari), atau "24/7". Selain itu → "unknown".
 */
export function checkOpeningHours(openingHours: string | null, startTime: string | null, date?: string): OpeningCheck {
  if (!openingHours || !startTime) return "unknown";
  const oh = openingHours.trim();
  if (oh === "24/7") return "open";
  const m = RULE.exec(oh);
  if (!m) return "unknown";
  const [, from, to, ranges] = m;

  if (from) {
    const a = DAYS.indexOf(from);
    const b = to ? DAYS.indexOf(to) : a;
    if (a < 0 || b < 0) return "unknown";
    const allWeek = (b - a + 7) % 7 === 6;
    if (!allWeek) {
      if (!date) return "unknown";
      const d = new Date(`${date}T00:00:00Z`).getUTCDay();
      if ((d - a + 7) % 7 > (b - a + 7) % 7) return "closed";
    }
  }

  const t = toMin(startTime);
  const open = ranges.split(",").some((r) => {
    const [s, e] = r.trim().split("-").map(toMin);
    return e > s ? t >= s && t < e : t >= s || t < e; // e ≤ s = lewat tengah malam
  });
  return open ? "open" : "closed";
}
