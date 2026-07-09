import type { DealRecord } from "@/data/dealsData";
import type { Site } from "@/data/mapRuntimeData";

export type CoordinatePrecision = "site" | "city" | "state";

export type Coordinates = {
  lat: number;
  lng: number;
  precision: CoordinatePrecision;
};

type CoordinateInput = {
  city: string | null | undefined;
  state: string | null | undefined;
  sites?: Site[];
};

export type DealCoordinateResult = {
  deal: DealRecord;
  coordinates: Coordinates | null;
  cityKey: string | null;
  label: string;
};

const CITY_COORDINATES: Record<string, Omit<Coordinates, "precision">> = {
  "atlanta|GA": { lat: 33.749, lng: -84.388 },
  "austin|TX": { lat: 30.2672, lng: -97.7431 },
  "birmingham|AL": { lat: 33.5186, lng: -86.8104 },
  "boston|MA": { lat: 42.3601, lng: -71.0589 },
  "charlotte|NC": { lat: 35.2271, lng: -80.8431 },
  "chicago|IL": { lat: 41.8781, lng: -87.6298 },
  "cincinnati|OH": { lat: 39.1031, lng: -84.512 },
  "cleveland|OH": { lat: 41.4993, lng: -81.6944 },
  "columbia|SC": { lat: 34.0007, lng: -81.0348 },
  "columbus|OH": { lat: 39.9612, lng: -82.9988 },
  "dallas|TX": { lat: 32.7767, lng: -96.797 },
  "denver|CO": { lat: 39.7392, lng: -104.9903 },
  "detroit|MI": { lat: 42.3314, lng: -83.0458 },
  "fort worth|TX": { lat: 32.7555, lng: -97.3308 },
  "greenville|SC": { lat: 34.8526, lng: -82.394 },
  "houston|TX": { lat: 29.7604, lng: -95.3698 },
  "indianapolis|IN": { lat: 39.7684, lng: -86.1581 },
  "jacksonville|FL": { lat: 30.3322, lng: -81.6557 },
  "kansas city|MO": { lat: 39.0997, lng: -94.5786 },
  "knoxville|TN": { lat: 35.9606, lng: -83.9207 },
  "las vegas|NV": { lat: 36.1716, lng: -115.1391 },
  "los angeles|CA": { lat: 34.0522, lng: -118.2437 },
  "miami|FL": { lat: 25.7617, lng: -80.1918 },
  "milwaukee|WI": { lat: 43.0389, lng: -87.9065 },
  "minneapolis|MN": { lat: 44.9778, lng: -93.265 },
  "nashville|TN": { lat: 36.1627, lng: -86.7816 },
  "new orleans|LA": { lat: 29.9511, lng: -90.0715 },
  "new york|NY": { lat: 40.7128, lng: -74.006 },
  "omaha|NE": { lat: 41.2565, lng: -95.9345 },
  "orlando|FL": { lat: 28.5383, lng: -81.3792 },
  "philadelphia|PA": { lat: 39.9526, lng: -75.1652 },
  "phoenix|AZ": { lat: 33.4484, lng: -112.074 },
  "portland|OR": { lat: 45.5152, lng: -122.6784 },
  "raleigh|NC": { lat: 35.7796, lng: -78.6382 },
  "richmond|VA": { lat: 37.5407, lng: -77.436 },
  "salt lake city|UT": { lat: 40.7608, lng: -111.891 },
  "san antonio|TX": { lat: 29.4241, lng: -98.4936 },
  "san diego|CA": { lat: 32.7157, lng: -117.1611 },
  "san francisco|CA": { lat: 37.7749, lng: -122.4194 },
  "san jose|CA": { lat: 37.3382, lng: -121.8863 },
  "savannah|GA": { lat: 32.0809, lng: -81.0912 },
  "seattle|WA": { lat: 47.6062, lng: -122.3321 },
  "southlake|TX": { lat: 32.9412, lng: -97.1342 },
  "st. louis|MO": { lat: 38.627, lng: -90.1994 },
  "tampa|FL": { lat: 27.9506, lng: -82.4572 },
  "washington|DC": { lat: 38.9072, lng: -77.0369 },
};

const STATE_CENTROIDS: Record<string, Omit<Coordinates, "precision">> = {
  AL: { lat: 32.8067, lng: -86.7911 },
  AK: { lat: 61.3707, lng: -152.4044 },
  AZ: { lat: 33.7298, lng: -111.4312 },
  AR: { lat: 34.9697, lng: -92.3731 },
  CA: { lat: 36.1162, lng: -119.6816 },
  CO: { lat: 39.0598, lng: -105.3111 },
  CT: { lat: 41.5978, lng: -72.7554 },
  DE: { lat: 39.3185, lng: -75.5071 },
  DC: { lat: 38.9072, lng: -77.0369 },
  FL: { lat: 27.7663, lng: -81.6868 },
  GA: { lat: 33.0406, lng: -83.6431 },
  HI: { lat: 21.0943, lng: -157.4983 },
  ID: { lat: 44.2405, lng: -114.4788 },
  IL: { lat: 40.3495, lng: -88.9861 },
  IN: { lat: 39.8494, lng: -86.2583 },
  IA: { lat: 42.0115, lng: -93.2105 },
  KS: { lat: 38.5266, lng: -96.7265 },
  KY: { lat: 37.6681, lng: -84.6701 },
  LA: { lat: 31.1695, lng: -91.8678 },
  ME: { lat: 44.6939, lng: -69.3819 },
  MD: { lat: 39.0639, lng: -76.8021 },
  MA: { lat: 42.2302, lng: -71.5301 },
  MI: { lat: 43.3266, lng: -84.5361 },
  MN: { lat: 45.6945, lng: -93.9002 },
  MS: { lat: 32.7416, lng: -89.6787 },
  MO: { lat: 38.4561, lng: -92.2884 },
  MT: { lat: 46.9219, lng: -110.4544 },
  NE: { lat: 41.1254, lng: -98.2681 },
  NV: { lat: 38.3135, lng: -117.0554 },
  NH: { lat: 43.4525, lng: -71.5639 },
  NJ: { lat: 40.2989, lng: -74.521 },
  NM: { lat: 34.8405, lng: -106.2485 },
  NY: { lat: 42.1657, lng: -74.9481 },
  NC: { lat: 35.6301, lng: -79.8064 },
  ND: { lat: 47.5289, lng: -99.784 },
  OH: { lat: 40.3888, lng: -82.7649 },
  OK: { lat: 35.5653, lng: -96.9289 },
  OR: { lat: 44.572, lng: -122.0709 },
  PA: { lat: 40.5908, lng: -77.2098 },
  RI: { lat: 41.6809, lng: -71.5118 },
  SC: { lat: 33.8569, lng: -80.945 },
  SD: { lat: 44.2998, lng: -99.4388 },
  TN: { lat: 35.7478, lng: -86.6923 },
  TX: { lat: 31.0545, lng: -97.5635 },
  UT: { lat: 40.15, lng: -111.8624 },
  VT: { lat: 44.0459, lng: -72.7107 },
  VA: { lat: 37.7693, lng: -78.17 },
  WA: { lat: 47.4009, lng: -121.4905 },
  WV: { lat: 38.4912, lng: -80.9545 },
  WI: { lat: 44.2685, lng: -89.6165 },
  WY: { lat: 42.756, lng: -107.3025 },
};

const STATE_NAMES: Record<string, string> = {
  alabama: "AL",
  alaska: "AK",
  arizona: "AZ",
  arkansas: "AR",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  delaware: "DE",
  florida: "FL",
  georgia: "GA",
  hawaii: "HI",
  idaho: "ID",
  illinois: "IL",
  indiana: "IN",
  iowa: "IA",
  kansas: "KS",
  kentucky: "KY",
  louisiana: "LA",
  maine: "ME",
  maryland: "MD",
  massachusetts: "MA",
  michigan: "MI",
  minnesota: "MN",
  mississippi: "MS",
  missouri: "MO",
  montana: "MT",
  nebraska: "NE",
  nevada: "NV",
  "new hampshire": "NH",
  "new jersey": "NJ",
  "new mexico": "NM",
  "new york": "NY",
  "north carolina": "NC",
  "north dakota": "ND",
  ohio: "OH",
  oklahoma: "OK",
  oregon: "OR",
  pennsylvania: "PA",
  "rhode island": "RI",
  "south carolina": "SC",
  "south dakota": "SD",
  tennessee: "TN",
  texas: "TX",
  utah: "UT",
  vermont: "VT",
  virginia: "VA",
  washington: "WA",
  "west virginia": "WV",
  wisconsin: "WI",
  wyoming: "WY",
};

function normalizeCity(city: string | null | undefined): string {
  return (city ?? "").trim().replace(/\s+/g, " ");
}

export function normalizeState(state: string | null | undefined): string {
  const value = (state ?? "").trim();
  if (!value) return "";
  if (value.length === 2) return value.toUpperCase();
  return STATE_NAMES[value.toLowerCase()] ?? value.toUpperCase();
}

function normalizeStoredCoordinate(
  lat: number | null | undefined,
  lng: number | null | undefined,
): Omit<Coordinates, "precision"> | null {
  if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  let normalizedLat = lat;
  let normalizedLng = lng;
  const looksLikeSwappedUsCoordinate = normalizedLat < -60 && normalizedLat > -130 && normalizedLng > 15 && normalizedLng < 55;
  const latOutOfRange = Math.abs(normalizedLat) > 90;
  const lngCouldBeLatitude = Math.abs(normalizedLng) <= 90;

  if ((latOutOfRange && lngCouldBeLatitude) || looksLikeSwappedUsCoordinate) {
    normalizedLat = lng;
    normalizedLng = lat;
  }

  const valid =
    Math.abs(normalizedLat) <= 90 &&
    Math.abs(normalizedLng) <= 180 &&
    !(normalizedLat === 0 && normalizedLng === 0);

  return valid ? { lat: normalizedLat, lng: normalizedLng } : null;
}

export function resolveCoordinates(input: CoordinateInput): Coordinates | null {
  for (const candidate of input.sites ?? []) {
    const normalized = normalizeStoredCoordinate(candidate.lat, candidate.lng);
    if (normalized) {
      return { ...normalized, precision: "site" };
    }
  }

  const city = normalizeCity(input.city);
  const state = normalizeState(input.state);
  if (!city || !state) return null;

  const cityCoordinates = CITY_COORDINATES[`${city.toLowerCase()}|${state}`];
  if (cityCoordinates) return { ...cityCoordinates, precision: "city" };

  const stateCoordinates = STATE_CENTROIDS[state];
  if (stateCoordinates) return { ...stateCoordinates, precision: "state" };

  return null;
}

export function resolveDealCoordinates(deal: DealRecord, sites: Site[]): DealCoordinateResult {
  const city = normalizeCity(deal.city);
  const state = normalizeState(deal.state);
  const label = [city, state].filter(Boolean).join(", ");
  return {
    deal,
    coordinates: resolveCoordinates({ city, state, sites }),
    cityKey: city && state ? `${city.toLowerCase()}|${state}` : null,
    label: label || "Unknown location",
  };
}
