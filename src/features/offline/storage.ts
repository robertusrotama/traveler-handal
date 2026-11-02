// Snapshot trip untuk mode offline read-only (F10). Client-only saat dipanggil; aman diimpor di server.
// IndexedDB mentah; fallback localStorage bila IDB tidak tersedia/gagal. Tidak pernah melempar error.

export type TripSnapshot<T = unknown> = { data: T; savedAt: number };
type Entry = { tripId: string; data: unknown; savedAt: number };

export const MAX_SNAPSHOTS = 5;
const DB_NAME = "traveler-handal-offline";
const STORE = "trips";
const LS_PREFIX = "th-trip:";

/** tripId yang harus dihapus agar hanya `max` snapshot terbaru yang tersisa. */
export function snapshotsToEvict(entries: { tripId: string; savedAt: number }[], max = MAX_SNAPSHOTS): string[] {
  return [...entries]
    .sort((a, b) => b.savedAt - a.savedAt)
    .slice(max)
    .map((e) => e.tripId);
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "tripId" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idb<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => {
      db.close();
      resolve(req ? req.result : undefined);
    };
    tx.onerror = tx.onabort = () => {
      db.close();
      reject(tx.error);
    };
  });
}

function lsEntries(): Entry[] {
  const keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i));
  const out: Entry[] = [];
  for (const key of keys) {
    if (!key?.startsWith(LS_PREFIX)) continue;
    try {
      out.push(JSON.parse(localStorage.getItem(key)!) as Entry);
    } catch {
      localStorage.removeItem(key);
    }
  }
  return out;
}

export async function saveTripSnapshot<T>(tripId: string, data: T): Promise<void> {
  const entry: Entry = { tripId, data, savedAt: Date.now() };
  try {
    if (typeof indexedDB === "undefined") throw new Error("no idb");
    await idb("readwrite", (s) => s.put(entry));
    const all = (await idb<Entry[]>("readonly", (s) => s.getAll())) ?? [];
    const evict = snapshotsToEvict(all);
    if (evict.length) await idb("readwrite", (s) => evict.forEach((id) => s.delete(id)));
    return;
  } catch {
    // lanjut ke localStorage
  }
  try {
    localStorage.setItem(LS_PREFIX + tripId, JSON.stringify(entry));
    snapshotsToEvict(lsEntries()).forEach((id) => localStorage.removeItem(LS_PREFIX + id));
  } catch {
    // kuota penuh / storage diblokir → offline tidak tersedia, app tetap jalan
  }
}

export async function loadTripSnapshot<T = unknown>(tripId: string): Promise<TripSnapshot<T> | null> {
  try {
    if (typeof indexedDB === "undefined") throw new Error("no idb");
    const e = await idb<Entry | undefined>("readonly", (s) => s.get(tripId));
    return e ? { data: e.data as T, savedAt: e.savedAt } : null;
  } catch {
    // lanjut ke localStorage
  }
  try {
    const raw = localStorage.getItem(LS_PREFIX + tripId);
    if (!raw) return null;
    const e = JSON.parse(raw) as Entry;
    return { data: e.data as T, savedAt: e.savedAt };
  } catch {
    return null;
  }
}

/** Hapus semua data offline di perangkat (panggil saat logout): snapshot IDB/localStorage + halaman cache SW. */
export async function clearOfflineData(): Promise<void> {
  try {
    if (typeof indexedDB !== "undefined") await idb("readwrite", (s) => s.clear());
  } catch {}
  try {
    lsEntries().forEach((e) => localStorage.removeItem(LS_PREFIX + e.tripId));
  } catch {}
  try {
    // halaman trip yang di-cache public/sw.js; /offline.html dipertahankan
    for (const name of await caches.keys()) {
      if (!name.startsWith("th-pages-")) continue;
      const cache = await caches.open(name);
      for (const req of await cache.keys()) {
        if (new URL(req.url).pathname !== "/offline.html") await cache.delete(req);
      }
    }
  } catch {}
}
