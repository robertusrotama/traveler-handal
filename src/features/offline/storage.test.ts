import { afterEach, describe, expect, it, vi } from "vitest";
import { loadTripSnapshot, MAX_SNAPSHOTS, saveTripSnapshot, snapshotsToEvict } from "./storage";

describe("snapshotsToEvict", () => {
  it("menyisakan MAX_SNAPSHOTS terbaru", () => {
    const entries = Array.from({ length: 7 }, (_, i) => ({ tripId: `t${i}`, savedAt: i }));
    expect(snapshotsToEvict(entries)).toEqual(["t1", "t0"]);
    expect(MAX_SNAPSHOTS).toBe(5);
  });

  it("tidak menghapus apa pun bila belum melebihi batas", () => {
    expect(snapshotsToEvict([{ tripId: "a", savedAt: 1 }])).toEqual([]);
  });

  it("tidak bergantung urutan input", () => {
    const entries = [
      { tripId: "baru", savedAt: 30 },
      { tripId: "lama", savedAt: 10 },
      { tripId: "tengah", savedAt: 20 },
    ];
    expect(snapshotsToEvict(entries, 2)).toEqual(["lama"]);
  });
});

describe("fallback localStorage (tanpa IndexedDB)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("menyimpan, memuat, dan memangkas ke 5 trip", async () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      get length() {
        return store.size;
      },
      key: (i: number) => [...store.keys()][i] ?? null,
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
    const now = vi.spyOn(Date, "now");
    for (let i = 0; i < 7; i++) {
      now.mockReturnValue(1000 + i);
      await saveTripSnapshot(`t${i}`, { title: `Trip ${i}` });
    }
    now.mockRestore();

    expect(store.size).toBe(5);
    expect(await loadTripSnapshot("t0")).toBeNull();
    expect(await loadTripSnapshot("t6")).toEqual({ data: { title: "Trip 6" }, savedAt: 1006 });
    expect(await loadTripSnapshot("tidak-ada")).toBeNull();
  });
});
