// Client-safe. Dipakai halaman trip (W2-ITIN) untuk mode offline read-only (F10).
export { saveTripSnapshot, loadTripSnapshot, clearOfflineData, MAX_SNAPSHOTS, type TripSnapshot } from "./storage";
export { useOnline } from "./use-online";
