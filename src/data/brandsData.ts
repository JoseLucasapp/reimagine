import { dealBrands, dealRecords } from "./dealsData";

export interface BrandDetail {
  id: string;
  name: string;
  logoColor: string;
  category: string;
  activeDeals: number;
  signedDeals: number;
  internalLink: string;
  franchisorLink: string;
  mapLink: string;
}

export const brandDetails: BrandDetail[] = [];
export const brandCategories: string[] = [];

function brandDealsPath(id: string): string {
  return `/brands/${encodeURIComponent(id)}/deals`;
}

function safeBrandDealsPath(id: string, value: string | null | undefined): string {
  const fallback = brandDealsPath(id);
  if (!value) return fallback;
  return /^\/brands\/[^/]+\/deals(?:[?#].*)?$/.test(value) ? value : fallback;
}

function safeBrandMapPath(id: string, value: string | null | undefined): string {
  const fallback = `/map?brand=${encodeURIComponent(id)}`;
  if (!value) return fallback;
  return value.startsWith("/map") && !value.startsWith("//") ? value : fallback;
}

export function rebuildBrandRuntimeData(): void {
  const details = dealBrands.map((b) => {
    const deals = dealRecords.filter((d) => d.brandId === b.id && !d.isOneOff);
    return {
      id: b.id,
      name: b.name,
      logoColor: b.logoColor,
      category: b.category,
      activeDeals: deals.filter((d) => d.status !== "Signed").length,
      signedDeals: deals.filter((d) => d.status === "Signed").length,
      internalLink: safeBrandDealsPath(b.id, b.internalLink),
      franchisorLink: b.franchisorLink || b.corporateLink,
      mapLink: safeBrandMapPath(b.id, b.franchisorMapLink),
    } satisfies BrandDetail;
  });

  brandDetails.splice(0, brandDetails.length, ...details);
  brandCategories.splice(0, brandCategories.length, ...new Set(details.map((b) => b.category).filter(Boolean)));
}
