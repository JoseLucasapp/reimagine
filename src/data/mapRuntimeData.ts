// Compatibility layer for legacy map screens that were originally built against a standalone data module.
// The arrays below are populated from Supabase through AppDataProvider; no static rows are shipped.

export type DealStage = "Prospecting" | "LOI" | "Lease" | "Open" | "Closed";

export interface Brand {
  id: string;
  name: string;
  logoColor: string;
}

export interface Site {
  id: string;
  dealId: string;
  address: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  stage: DealStage;
  notes: string;
  files: { name: string; type: string }[];
}

export interface Deal {
  id: string;
  name: string;
  brandId: string;
  market: string;
  stage: DealStage;
  assignedBroker: string;
  franchiseeName: string;
  sites: Site[];
  notes: string;
  createdAt: string;
}

export const brands: Brand[] = [];
export const deals: Deal[] = [];
export const brokers: string[] = [];
export const markets: string[] = [];

export function replaceMapRuntimeData(input: { brands: Brand[]; deals: Deal[] }): void {
  brands.splice(0, brands.length, ...input.brands);
  deals.splice(0, deals.length, ...input.deals);
  brokers.splice(0, brokers.length, ...new Set(input.deals.map((d) => d.assignedBroker).filter(Boolean)));
  markets.splice(0, markets.length, ...new Set(input.deals.map((d) => d.market).filter(Boolean)));
}

export function getBrandById(id: string): Brand | undefined {
  return brands.find((b) => b.id === id);
}

export function getDealById(id: string): Deal | undefined {
  return deals.find((d) => d.id === id);
}

export function getDealsByBrand(brandId: string): Deal[] {
  return deals.filter((d) => d.brandId === brandId);
}

export function getAllSites(): Site[] {
  return deals.flatMap((d) => d.sites);
}

export function getSitesByDeal(dealId: string): Site[] {
  const deal = getDealById(dealId);
  return deal?.sites ?? [];
}

export const stageColors: Record<DealStage, string> = {
  Prospecting: "bg-stage-prospecting",
  LOI: "bg-stage-loi",
  Lease: "bg-stage-lease",
  Open: "bg-stage-open",
  Closed: "bg-stage-closed",
};

export const stageTextColors: Record<DealStage, string> = {
  Prospecting: "text-stage-prospecting",
  LOI: "text-stage-loi",
  Lease: "text-stage-lease",
  Open: "text-stage-open",
  Closed: "text-stage-closed",
};
