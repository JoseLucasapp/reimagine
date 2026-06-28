import { dealRecords, dealBrands, getDealBrandById, DealStatusNew, dealStatusColors } from "./dealsData";

export type DealStatus = DealStatusNew;

export const statusColors: Record<DealStatus, string> = Object.fromEntries(
  Object.entries(dealStatusColors).map(([k, v]) => [k, `${v.bg} ${v.text}`])
) as Record<DealStatus, string>;

export const statusDotColors: Record<DealStatus, string> = Object.fromEntries(
  Object.entries(dealStatusColors).map(([k, v]) => [k, v.dot])
) as Record<DealStatus, string>;

export interface RecentActivity {
  id: string;
  brandName: string;
  franchiseeName: string;
  location: string;
  status: DealStatus;
  lastNote: string;
  date: string;
}

export function getRecentActivity(): RecentActivity[] {
  return dealRecords
    .filter((d) => !d.isOneOff)
    .map((deal) => {
      const brand = getDealBrandById(deal.brandId);
      const lastNote = deal.notes[0];
      return {
        id: deal.id,
        brandName: brand?.name ?? "Unknown",
        franchiseeName: deal.franchisee,
        location: `${deal.city}, ${deal.state}`,
        status: deal.status,
        lastNote: lastNote?.text || "",
        date: lastNote?.date || deal.dateLeaseSigned || deal.dateIntroCall || "",
      };
    })
    .sort((a, b) => (new Date(b.date).getTime() || 0) - (new Date(a.date).getTime() || 0))
    .slice(0, 10);
}

export function getDealsByStatusCounts(): { status: DealStatus; count: number }[] {
  const counts: Record<string, number> = {};
  const statuses: DealStatus[] = ["Signed", "Lease Negotiations", "LOI Negotiations", "First LOI(s) Submitted", "Site Tours", "Market Study", "Kick Off", "On Hold"];
  statuses.forEach((s) => (counts[s] = 0));
  dealRecords.filter((d) => !d.isOneOff).forEach((d) => { counts[d.status] = (counts[d.status] || 0) + 1; });
  return statuses.map((s) => ({ status: s, count: counts[s] || 0 }));
}

export function getDashboardStats() {
  const active = dealRecords.filter((d) => !d.isOneOff);
  return {
    totalActiveBrands: dealBrands.length,
    totalDeals: active.length,
    dealsSigned: active.filter((d) => d.status === "Signed").length,
    dealsInProgress: active.filter((d) => d.status !== "Signed" && d.status !== "On Hold").length,
    dealsOnHold: active.filter((d) => d.status === "On Hold").length,
    totalCommission: active.reduce((a, d) => a + d.estimatedCommission, 0),
  };
}

export function getBrandSummaries() {
  return dealBrands.map((brand) => {
    const brandDeals = dealRecords.filter((d) => d.brandId === brand.id && !d.isOneOff);
    return {
      id: brand.id,
      name: brand.name,
      logoColor: brand.logoColor,
      activeDeals: brandDeals.length,
      totalSites: brandDeals.reduce((a, d) => a + d.storeCount, 0),
      stages: [...new Set(brandDeals.map((d) => d.status))],
    };
  });
}

export interface SearchResult {
  type: "Brand" | "Deal" | "Contact";
  id: string;
  title: string;
  subtitle: string;
  url: string;
}

export function globalSearch(query: string): SearchResult[] {
  if (!query || query.length < 2) return [];
  const q = query.toLowerCase();
  const results: SearchResult[] = [];

  dealBrands.forEach((b) => {
    if (b.name.toLowerCase().includes(q)) {
      results.push({ type: "Brand", id: b.id, title: b.name, subtitle: "Brand", url: `/brands/${b.id}/deals` });
    }
  });

  dealRecords.forEach((deal) => {
    const brand = getDealBrandById(deal.brandId);
    if (
      deal.franchisee.toLowerCase().includes(q) ||
      deal.city.toLowerCase().includes(q) ||
      deal.broker.toLowerCase().includes(q) ||
      brand?.name.toLowerCase().includes(q)
    ) {
      results.push({
        type: "Deal", id: deal.id,
        title: `${deal.franchisee} — ${deal.city}, ${deal.state}`,
        subtitle: `${brand?.name} · ${deal.status}`,
        url: `/deals/${deal.id}`,
      });
    }
  });

  const contactSet = new Set<string>();
  dealRecords.forEach((deal) => {
    if (deal.broker.toLowerCase().includes(q) && !contactSet.has(deal.broker)) {
      contactSet.add(deal.broker);
      results.push({ type: "Contact", id: deal.broker, title: deal.broker, subtitle: "Broker", url: `/deals` });
    }
    if (deal.franchisee.toLowerCase().includes(q) && !contactSet.has(deal.franchisee)) {
      contactSet.add(deal.franchisee);
      results.push({ type: "Contact", id: deal.franchisee, title: deal.franchisee, subtitle: "Franchisee", url: `/deals` });
    }
  });

  return results.slice(0, 15);
}
