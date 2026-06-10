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

export const brands: Brand[] = [
  { id: "b1", name: "QuickBite", logoColor: "#E07830" },
  { id: "b2", name: "FreshFit", logoColor: "#3B9B6E" },
  { id: "b3", name: "UrbanGrind", logoColor: "#4A90C4" },
];

export const deals: Deal[] = [
  {
    id: "d1", name: "QuickBite — Dallas Expansion", brandId: "b1", market: "Dallas, TX",
    stage: "LOI", assignedBroker: "Sarah Mitchell", franchiseeName: "James Thornton",
    notes: "Three locations under review in the DFW metro.", createdAt: "2025-11-15",
    sites: [
      { id: "s1", dealId: "d1", address: "4521 McKinney Ave", city: "Dallas", state: "TX", lat: 32.8058, lng: -96.7984, stage: "LOI", notes: "High foot traffic corner lot.", files: [{ name: "Flyer_McKinney.pdf", type: "Flyer" }, { name: "FloorPlan_McKinney.pdf", type: "Floor Plan" }] },
      { id: "s2", dealId: "d1", address: "1200 Greenville Ave", city: "Dallas", state: "TX", lat: 32.8245, lng: -96.7700, stage: "Prospecting", notes: "Needs zoning confirmation.", files: [{ name: "MarketReport_Greenville.pdf", type: "Market Report" }] },
      { id: "s3", dealId: "d1", address: "8900 Preston Rd", city: "Dallas", state: "TX", lat: 32.8690, lng: -96.8020, stage: "LOI", notes: "Landlord responsive, good terms.", files: [] },
    ],
  },
  {
    id: "d2", name: "QuickBite — Austin Launch", brandId: "b1", market: "Austin, TX",
    stage: "Prospecting", assignedBroker: "Michael Chen", franchiseeName: "Lisa Park",
    notes: "Initial market survey complete.", createdAt: "2026-01-03",
    sites: [
      { id: "s4", dealId: "d2", address: "600 Congress Ave", city: "Austin", state: "TX", lat: 30.2672, lng: -97.7431, stage: "Prospecting", notes: "Downtown core, high rent.", files: [] },
      { id: "s5", dealId: "d2", address: "2400 S Lamar Blvd", city: "Austin", state: "TX", lat: 30.2470, lng: -97.7730, stage: "Prospecting", notes: "Growing corridor.", files: [{ name: "Flyer_SLamar.pdf", type: "Flyer" }] },
    ],
  },
  {
    id: "d3", name: "FreshFit — Denver Roll-out", brandId: "b2", market: "Denver, CO",
    stage: "Lease", assignedBroker: "Sarah Mitchell", franchiseeName: "Robert Garcia",
    notes: "Two sites under lease negotiation.", createdAt: "2025-09-20",
    sites: [
      { id: "s6", dealId: "d3", address: "1550 Blake St", city: "Denver", state: "CO", lat: 39.7530, lng: -104.9962, stage: "Lease", notes: "Near Coors Field, strong demographics.", files: [{ name: "FloorPlan_Blake.pdf", type: "Floor Plan" }, { name: "MarketReport_Denver.pdf", type: "Market Report" }] },
      { id: "s7", dealId: "d3", address: "3200 E Colfax Ave", city: "Denver", state: "CO", lat: 39.7400, lng: -104.9540, stage: "LOI", notes: "Competitive area, needs follow-up.", files: [] },
    ],
  },
  {
    id: "d4", name: "FreshFit — Phoenix Entry", brandId: "b2", market: "Phoenix, AZ",
    stage: "Open", assignedBroker: "Michael Chen", franchiseeName: "Amanda Hughes",
    notes: "First location now open.", createdAt: "2025-06-10",
    sites: [
      { id: "s8", dealId: "d4", address: "4700 N Central Ave", city: "Phoenix", state: "AZ", lat: 33.5070, lng: -112.0740, stage: "Open", notes: "Grand opening completed. Strong first month.", files: [{ name: "Flyer_Central.pdf", type: "Flyer" }] },
    ],
  },
  {
    id: "d5", name: "UrbanGrind — Chicago Midwest", brandId: "b3", market: "Chicago, IL",
    stage: "Prospecting", assignedBroker: "Sarah Mitchell", franchiseeName: "Kevin Walsh",
    notes: "Scouting the Loop and River North.", createdAt: "2026-01-28",
    sites: [
      { id: "s9", dealId: "d5", address: "200 N Michigan Ave", city: "Chicago", state: "IL", lat: 41.8862, lng: -87.6246, stage: "Prospecting", notes: "Prime Mag Mile adjacent.", files: [] },
      { id: "s10", dealId: "d5", address: "400 N Clark St", city: "Chicago", state: "IL", lat: 41.8895, lng: -87.6310, stage: "Prospecting", notes: "River North foot traffic.", files: [{ name: "MarketReport_Chicago.pdf", type: "Market Report" }] },
    ],
  },
  {
    id: "d6", name: "UrbanGrind — Nashville Entry", brandId: "b3", market: "Nashville, TN",
    stage: "Lease", assignedBroker: "Michael Chen", franchiseeName: "Danielle Brooks",
    notes: "Single location lease in progress.", createdAt: "2025-10-05",
    sites: [
      { id: "s11", dealId: "d6", address: "1900 Broadway", city: "Nashville", state: "TN", lat: 36.1530, lng: -86.7950, stage: "Lease", notes: "Midtown, strong evening traffic.", files: [{ name: "Flyer_Broadway.pdf", type: "Flyer" }, { name: "FloorPlan_Broadway.pdf", type: "Floor Plan" }] },
    ],
  },
];

export const brokers = ["Sarah Mitchell", "Michael Chen"];
export const markets = [...new Set(deals.map((d) => d.market))];

export function getBrandById(id: string) {
  return brands.find((b) => b.id === id);
}

export function getDealById(id: string) {
  return deals.find((d) => d.id === id);
}

export function getDealsByBrand(brandId: string) {
  return deals.filter((d) => d.brandId === brandId);
}

export function getAllSites() {
  return deals.flatMap((d) => d.sites);
}

export function getSitesByDeal(dealId: string) {
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
