// Compatibility layer for legacy map screens that were originally built against a standalone data module.
// These arrays are populated from Supabase by AppDataProvider. No static placeholder rows are shipped.

export type DealStage = "Prospecting" | "LOI" | "Lease" | "Open" | "Closed";

export interface Brand {
  id: string;
  name: string;
  logoColor: string;
}

export interface SiteFile {
  name: string;
  type: string;
  url: string;
}

export interface SiteLoiTerms {
  baseRent: string;
  nnn: string;
  grossMonthlyRent: string;
  leaseTerm: string;
  commencementDate: string;
  tiAllowance: string;
  notes: string;
}

export interface Site {
  id: string;
  dealId: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  lat: number;
  lng: number;
  stage: DealStage;
  statusLabel: string;
  notes: string;
  squareFootage: string;
  spaceType: string;
  propertyType: string;
  landlord: string;
  landlordContact: string;
  leaseTerm: string;
  possessionDate: string;
  tourTime: string;
  brokerName: string;
  brokerPhone: string;
  photoUrls: string[];
  brochureUrl: string;
  floorPlanUrl: string;
  loiUrl: string;
  leaseUrl: string;
  files: SiteFile[];
  loiTerms: SiteLoiTerms;
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

export function getSiteById(siteId: string): Site | undefined {
  return getAllSites().find((site) => site.id === siteId);
}

export function getSitesByDeal(dealId: string): Site[] {
  const deal = getDealById(dealId);
  return deal?.sites ?? [];
}

export function replaceMapDealRuntime(deal: Deal): void {
  const existing = deals.find((item) => item.id === deal.id);
  const preservedSites = existing?.sites ?? deal.sites;
  const nextDeal = { ...deal, sites: preservedSites };
  const index = deals.findIndex((item) => item.id === deal.id);
  if (index >= 0) {
    deals.splice(index, 1, nextDeal);
    return;
  }
  deals.unshift(nextDeal);
}

export function replaceSiteRuntime(site: Site): boolean {
  const deal = deals.find((item) => item.id === site.dealId);
  if (!deal) return false;
  const exists = deal.sites.some((current) => current.id === site.id);
  deal.sites = exists
    ? deal.sites.map((current) => (current.id === site.id ? site : current))
    : [site, ...deal.sites];
  return true;
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
