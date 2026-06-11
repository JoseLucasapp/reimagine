export type GeocodeResult = {
  lat: number;
  lng: number;
};

type NominatimRow = {
  lat?: unknown;
  lon?: unknown;
};

function parseCoordinate(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeRows(payload: unknown): NominatimRow[] {
  if (!Array.isArray(payload)) return [];
  return payload.filter((row): row is NominatimRow => typeof row === "object" && row !== null);
}

export function buildAddressQuery(parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(", ");
}

export async function geocodeAddress(query: string): Promise<GeocodeResult | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const params = new URLSearchParams({
    q: trimmed,
    format: "jsonv2",
    limit: "1",
  });

  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;

    const rows = normalizeRows(await response.json());
    const first = rows[0];
    const lat = parseCoordinate(first?.lat);
    const lng = parseCoordinate(first?.lon);
    if (lat === null || lng === null) return null;

    return { lat, lng };
  } catch {
    return null;
  }
}
