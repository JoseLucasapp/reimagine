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
      internalLink: `/brands/${b.id}/deals`,
      franchisorLink: b.corporateLink,
      mapLink: `/map?brand=${b.id}`,
    } satisfies BrandDetail;
  });

  brandDetails.splice(0, brandDetails.length, ...details);
  brandCategories.splice(0, brandCategories.length, ...new Set(details.map((b) => b.category).filter(Boolean)));
}
