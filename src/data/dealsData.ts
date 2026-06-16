// ===== DEAL TRACKING ENGINE RUNTIME DATA =====
// Runtime arrays are intentionally empty at startup and are populated from Supabase by AppDataProvider.
// They are kept as mutable exported arrays so the approved Lovable UI can keep its existing imports while using real database rows.

export type DealStatusNew =
  | "Signed"
  | "Lease Negotiations"
  | "LOI Negotiations"
  | "First LOI(s) Submitted"
  | "Site Tours"
  | "Market Study"
  | "Kick Off"
  | "On Hold";

export const DEAL_STATUS_ORDER: DealStatusNew[] = [
  "Kick Off",
  "Market Study",
  "Site Tours",
  "First LOI(s) Submitted",
  "LOI Negotiations",
  "Lease Negotiations",
  "Signed",
  "On Hold",
];

export const KANBAN_COLUMNS: DealStatusNew[] = [
  "Kick Off",
  "Market Study",
  "Site Tours",
  "First LOI(s) Submitted",
  "LOI Negotiations",
  "Lease Negotiations",
  "Signed",
  "On Hold",
];

export interface DealNote {
  date: string;
  text: string;
  author?: string;
}

export interface DealDocuments {
  engagementLetter: string | null;
  cobrokerAgreement: string | null;
  flyer: string | null;
  demo: string | null;
  signedLOI: string | null;
  floorPlan: string | null;
  approvalPackage: string | null;
  commissionAgreement: string | null;
  signedLease: string | null;
}

export interface DealRecord {
  id: string;
  brandId: string;
  /** Exact deal name imported from the source spreadsheet, when available. */
  name?: string | null;
  /** Original spreadsheet status before enum normalization. */
  sourceStatusLabel?: string | null;
  sourceKey?: string | null;
  sourceSheet?: string | null;
  sourceRow?: number | null;
  broker: string;
  associate: string;
  franchisee: string;
  cellPhone: string;
  city: string;
  state: string;
  storesBought: number;
  storeCount: number;
  dateIntroCall: string | null;
  dateLeaseSigned: string | null;
  territoryMapLink: string | null;
  marketStudyLink: string | null;
  mapLink: string | null;
  tourBookLink: string | null;
  cobroker: string;
  cobrokerPercent: string;
  estimatedCommission: number;
  status: DealStatusNew;
  notes: DealNote[];
  documents: DealDocuments;
  isOneOff: boolean;
  corporate: boolean;
  corporateComments: string;
}

export interface DealBrand {
  id: string;
  name: string;
  logoColor: string;
  category: string;
  corporateLink: string;
  internalLink?: string | null;
  franchisorLink?: string | null;
  franchisorMapLink?: string | null;
  sourceKey?: string | null;
  sourceSheet?: string | null;
  sourceRow?: number | null;
}

export const emptyDealDocuments: DealDocuments = {
  engagementLetter: null,
  cobrokerAgreement: null,
  flyer: null,
  demo: null,
  signedLOI: null,
  floorPlan: null,
  approvalPackage: null,
  commissionAgreement: null,
  signedLease: null,
};

export const dealBrands: DealBrand[] = [];
export const dealRecords: DealRecord[] = [];

export function replaceDealRuntimeData(input: { brands: DealBrand[]; deals: DealRecord[] }): void {
  dealBrands.splice(0, dealBrands.length, ...input.brands);
  dealRecords.splice(0, dealRecords.length, ...input.deals);
}

export function getDealBrandById(id: string): DealBrand | undefined {
  return dealBrands.find((b) => b.id === id);
}

export function getDealRecordById(id: string): DealRecord | undefined {
  return dealRecords.find((d) => d.id === id);
}

export function getDealRecordsByBrand(brandId: string): DealRecord[] {
  return dealRecords.filter((d) => d.brandId === brandId);
}

export function getUniqueBrokers(): string[] {
  return [...new Set(dealRecords.map((d) => d.broker).filter(Boolean))].sort();
}

export function getUniqueStates(): string[] {
  return [...new Set(dealRecords.map((d) => d.state).filter(Boolean))].sort();
}

export function daysToSign(d: DealRecord): number | null {
  if (!d.dateIntroCall || !d.dateLeaseSigned) return null;
  const diff = new Date(d.dateLeaseSigned).getTime() - new Date(d.dateIntroCall).getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

export function daysActive(d: DealRecord): number {
  const start = d.dateIntroCall ? new Date(d.dateIntroCall) : new Date();
  return Math.round((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24));
}

export const dealStatusColors: Record<DealStatusNew, { bg: string; text: string; dot: string }> = {
  Signed: { bg: "bg-emerald-500/15", text: "text-emerald-700", dot: "bg-emerald-500" },
  "Lease Negotiations": { bg: "bg-blue-500/15", text: "text-blue-700", dot: "bg-blue-500" },
  "LOI Negotiations": { bg: "bg-indigo-500/15", text: "text-indigo-700", dot: "bg-indigo-500" },
  "First LOI(s) Submitted": { bg: "bg-sky-400/15", text: "text-sky-700", dot: "bg-sky-500" },
  "Site Tours": { bg: "bg-teal-500/15", text: "text-teal-700", dot: "bg-teal-500" },
  "Market Study": { bg: "bg-purple-500/15", text: "text-purple-700", dot: "bg-purple-500" },
  "Kick Off": { bg: "bg-gray-400/15", text: "text-gray-600", dot: "bg-gray-400" },
  "On Hold": { bg: "bg-amber-500/15", text: "text-amber-700", dot: "bg-amber-500" },
};

export function getRowTint(status: DealStatusNew): string {
  if (status === "Signed") return "bg-emerald-50/60";
  if (status === "On Hold") return "bg-red-50/50";
  return "";
}
