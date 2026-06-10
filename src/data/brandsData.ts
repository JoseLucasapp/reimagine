import { dealRecords, dealBrands } from "./dealsData";

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

export const brandDetails: BrandDetail[] = dealBrands.map((b) => {
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
  };
});

export const brandCategories = [...new Set(brandDetails.map((b) => b.category))];
