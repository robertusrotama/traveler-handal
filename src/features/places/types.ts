export type LatLng = { lat: number; lng: number };

export type PlaceMatch = LatLng & {
  provider: "osm";
  /** OSM: `{osm_type}{osm_id}`, mis. `node123456`. */
  providerPlaceId: string;
  name: string;
  address: string | null;
  /** OSM `category:type`, mis. `amenity:restaurant`. */
  category: string | null;
  /** Tag OSM `opening_hours` mentah. */
  openingHours: string | null;
  raw: Record<string, unknown>;
};
