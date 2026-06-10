// ===== DEAL TRACKING ENGINE DATA =====

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

export function daysToSign(d: DealRecord): number | null {
  if (!d.dateIntroCall || !d.dateLeaseSigned) return null;
  const diff = new Date(d.dateLeaseSigned).getTime() - new Date(d.dateIntroCall).getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

export function daysActive(d: DealRecord): number {
  const start = d.dateIntroCall ? new Date(d.dateIntroCall) : new Date();
  return Math.round((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24));
}

const emptyDocs: DealDocuments = {
  engagementLetter: null, cobrokerAgreement: null, flyer: null, demo: null,
  signedLOI: null, floorPlan: null, approvalPackage: null, commissionAgreement: null, signedLease: null,
};

// ===== BRAND DATA =====
export interface DealBrand {
  id: string;
  name: string;
  logoColor: string;
  category: string;
  corporateLink: string;
}

export const dealBrands: DealBrand[] = [
  { id: "br1", name: "Milkshake Factory", logoColor: "#E07830", category: "F&B", corporateLink: "https://milkshakefactory.com" },
  { id: "br2", name: "The Designery", logoColor: "#4A90C4", category: "Service", corporateLink: "https://thedesignery.com" },
  { id: "br3", name: "NextHealth", logoColor: "#3B9B6E", category: "Health & Wellness", corporateLink: "https://next-health.com" },
  { id: "br4", name: "GolfTRK", logoColor: "#2E6B4F", category: "Entertainment", corporateLink: "https://golftrk.com" },
  { id: "br5", name: "dermani MEDSPA", logoColor: "#C06090", category: "Medical", corporateLink: "https://dermani.com" },
];

export function getDealBrandById(id: string) {
  return dealBrands.find((b) => b.id === id);
}

// ===== MOCK DEALS =====
export const dealRecords: DealRecord[] = [
  // Milkshake Factory
  {
    id: "dl01", brandId: "br1", broker: "SM", associate: "JR", franchisee: "James Thornton",
    cellPhone: "214-555-1001", city: "Dallas", state: "TX", storesBought: 3, storeCount: 3,
    dateIntroCall: "2025-06-15", dateLeaseSigned: "2025-11-20",
    territoryMapLink: "#", marketStudyLink: "#", mapLink: "#", tourBookLink: "#",
    cobroker: "Tom Harris", cobrokerPercent: "25%", estimatedCommission: 45000,
    status: "Signed",
    notes: [
      { date: "2025-11-20", text: "All 3 leases fully executed. Congratulations!", author: "SM" },
      { date: "2025-10-12", text: "Final lease terms agreed — sending for signature.", author: "SM" },
      { date: "2025-08-01", text: "LOI accepted for McKinney Ave location.", author: "JR" },
      { date: "2025-06-15", text: "Intro call completed. Franchisee interested in 3 DFW locations.", author: "SM" },
    ],
    documents: { ...emptyDocs, engagementLetter: "#", signedLOI: "#", signedLease: "#", flyer: "#", floorPlan: "#", commissionAgreement: "#" },
    isOneOff: false, corporate: false, corporateComments: "",
  },
  {
    id: "dl02", brandId: "br1", broker: "MC", associate: "JR", franchisee: "Lisa Park",
    cellPhone: "512-555-2002", city: "Austin", state: "TX", storesBought: 0, storeCount: 2,
    dateIntroCall: "2025-09-03", dateLeaseSigned: null,
    territoryMapLink: "#", marketStudyLink: "#", mapLink: "#", tourBookLink: null,
    cobroker: "", cobrokerPercent: "", estimatedCommission: 28000,
    status: "Market Study",
    notes: [
      { date: "2025-12-01", text: "Market study underway for South Congress corridor.", author: "MC" },
      { date: "2025-09-03", text: "Intro call done — wants 2 locations in Austin metro.", author: "MC" },
    ],
    documents: { ...emptyDocs, engagementLetter: "#" },
    isOneOff: false, corporate: false, corporateComments: "",
  },
  {
    id: "dl03", brandId: "br1", broker: "SM", associate: "", franchisee: "Robert Chen",
    cellPhone: "713-555-3003", city: "Houston", state: "TX", storesBought: 0, storeCount: 1,
    dateIntroCall: "2025-11-01", dateLeaseSigned: null,
    territoryMapLink: null, marketStudyLink: null, mapLink: null, tourBookLink: null,
    cobroker: "", cobrokerPercent: "", estimatedCommission: 15000,
    status: "Kick Off",
    notes: [
      { date: "2025-11-01", text: "Initial intro call — exploring Galleria area.", author: "SM" },
    ],
    documents: emptyDocs,
    isOneOff: false, corporate: false, corporateComments: "",
  },
  {
    id: "dl04", brandId: "br1", broker: "MC", associate: "JR", franchisee: "Amanda Wilson",
    cellPhone: "602-555-4004", city: "Phoenix", state: "AZ", storesBought: 1, storeCount: 1,
    dateIntroCall: "2025-04-10", dateLeaseSigned: "2025-09-28",
    territoryMapLink: "#", marketStudyLink: "#", mapLink: "#", tourBookLink: "#",
    cobroker: "", cobrokerPercent: "", estimatedCommission: 18000,
    status: "Signed",
    notes: [
      { date: "2025-09-28", text: "Lease signed! Opening projected Q1 2026.", author: "MC" },
      { date: "2025-07-15", text: "LOI submitted for Scottsdale Rd property.", author: "MC" },
    ],
    documents: { ...emptyDocs, engagementLetter: "#", signedLOI: "#", signedLease: "#", commissionAgreement: "#" },
    isOneOff: false, corporate: false, corporateComments: "",
  },
  {
    id: "dl05", brandId: "br1", broker: "SM", associate: "", franchisee: "Kevin Walsh",
    cellPhone: "312-555-5005", city: "Chicago", state: "IL", storesBought: 0, storeCount: 2,
    dateIntroCall: "2025-10-20", dateLeaseSigned: null,
    territoryMapLink: "#", marketStudyLink: "#", mapLink: null, tourBookLink: null,
    cobroker: "Janet Lee", cobrokerPercent: "30%", estimatedCommission: 32000,
    status: "Site Tours",
    notes: [
      { date: "2026-01-10", text: "Toured 3 properties in River North. Franchisee liked 2.", author: "SM" },
      { date: "2025-11-15", text: "Market study complete — targeting Loop & River North.", author: "SM" },
    ],
    documents: { ...emptyDocs, engagementLetter: "#", flyer: "#" },
    isOneOff: false, corporate: false, corporateComments: "",
  },

  // The Designery
  {
    id: "dl06", brandId: "br2", broker: "MC", associate: "AL", franchisee: "Sarah Johnson & Mike Johnson",
    cellPhone: "305-555-6006", city: "Miami", state: "FL", storesBought: 0, storeCount: 1,
    dateIntroCall: "2025-08-12", dateLeaseSigned: null,
    territoryMapLink: "#", marketStudyLink: "#", mapLink: "#", tourBookLink: "#",
    cobroker: "", cobrokerPercent: "", estimatedCommission: 22000,
    status: "First LOI(s) Submitted",
    notes: [
      { date: "2026-01-05", text: "LOI submitted to landlord at Wynwood location.", author: "MC" },
      { date: "2025-11-20", text: "Property tour completed — Wynwood is top pick.", author: "AL" },
      { date: "2025-08-12", text: "Intro call done. Looking for creative studio space in Miami.", author: "MC" },
    ],
    documents: { ...emptyDocs, engagementLetter: "#", flyer: "#", signedLOI: "#" },
    isOneOff: false, corporate: false, corporateComments: "",
  },
  {
    id: "dl07", brandId: "br2", broker: "SM", associate: "AL", franchisee: "Danielle Brooks",
    cellPhone: "615-555-7007", city: "Nashville", state: "TN", storesBought: 1, storeCount: 1,
    dateIntroCall: "2025-03-20", dateLeaseSigned: "2025-08-14",
    territoryMapLink: "#", marketStudyLink: "#", mapLink: "#", tourBookLink: "#",
    cobroker: "", cobrokerPercent: "", estimatedCommission: 20000,
    status: "Signed",
    notes: [
      { date: "2025-08-14", text: "Lease executed — Midtown Broadway location.", author: "SM" },
      { date: "2025-06-01", text: "LOI accepted.", author: "SM" },
    ],
    documents: { ...emptyDocs, engagementLetter: "#", signedLOI: "#", signedLease: "#", floorPlan: "#", commissionAgreement: "#" },
    isOneOff: false, corporate: false, corporateComments: "",
  },
  {
    id: "dl08", brandId: "br2", broker: "MC", associate: "", franchisee: "Patricia Moore",
    cellPhone: "404-555-8008", city: "Atlanta", state: "GA", storesBought: 0, storeCount: 2,
    dateIntroCall: "2025-10-05", dateLeaseSigned: null,
    territoryMapLink: "#", marketStudyLink: null, mapLink: null, tourBookLink: null,
    cobroker: "", cobrokerPercent: "", estimatedCommission: 35000,
    status: "Market Study",
    notes: [
      { date: "2025-12-15", text: "Reviewing Buckhead and Midtown submarkets.", author: "MC" },
      { date: "2025-10-05", text: "Intro call completed — wants 2 Atlanta locations.", author: "MC" },
    ],
    documents: { ...emptyDocs, engagementLetter: "#" },
    isOneOff: false, corporate: false, corporateComments: "",
  },
  {
    id: "dl09", brandId: "br2", broker: "SM", associate: "", franchisee: "David Kim",
    cellPhone: "720-555-9009", city: "Denver", state: "CO", storesBought: 0, storeCount: 1,
    dateIntroCall: "2025-12-01", dateLeaseSigned: null,
    territoryMapLink: null, marketStudyLink: null, mapLink: null, tourBookLink: null,
    cobroker: "", cobrokerPercent: "", estimatedCommission: 16000,
    status: "Kick Off",
    notes: [
      { date: "2025-12-01", text: "Initial discussion — interested in LoDo district.", author: "SM" },
    ],
    documents: emptyDocs,
    isOneOff: false, corporate: false, corporateComments: "",
  },
  {
    id: "dl10", brandId: "br2", broker: "MC", associate: "AL", franchisee: "Rachel Green",
    cellPhone: "213-555-0010", city: "Los Angeles", state: "CA", storesBought: 0, storeCount: 1,
    dateIntroCall: "2025-07-22", dateLeaseSigned: null,
    territoryMapLink: "#", marketStudyLink: "#", mapLink: "#", tourBookLink: "#",
    cobroker: "Mark Stevens", cobrokerPercent: "20%", estimatedCommission: 30000,
    status: "Lease Negotiations",
    notes: [
      { date: "2026-01-20", text: "Lease negotiations ongoing — landlord countered.", author: "MC" },
      { date: "2025-11-10", text: "LOI accepted by landlord in Silver Lake.", author: "AL" },
    ],
    documents: { ...emptyDocs, engagementLetter: "#", signedLOI: "#", flyer: "#", floorPlan: "#", cobrokerAgreement: "#" },
    isOneOff: false, corporate: false, corporateComments: "",
  },

  // NextHealth
  {
    id: "dl11", brandId: "br3", broker: "SM", associate: "JR", franchisee: "Dr. Michael Torres",
    cellPhone: "310-555-1101", city: "Beverly Hills", state: "CA", storesBought: 1, storeCount: 1,
    dateIntroCall: "2025-02-10", dateLeaseSigned: "2025-07-30",
    territoryMapLink: "#", marketStudyLink: "#", mapLink: "#", tourBookLink: "#",
    cobroker: "", cobrokerPercent: "", estimatedCommission: 55000,
    status: "Signed",
    notes: [
      { date: "2025-07-30", text: "Lease signed for Robertson Blvd flagship.", author: "SM" },
      { date: "2025-05-20", text: "LOI accepted — premium terms.", author: "JR" },
    ],
    documents: { ...emptyDocs, engagementLetter: "#", signedLOI: "#", signedLease: "#", floorPlan: "#", approvalPackage: "#", commissionAgreement: "#" },
    isOneOff: false, corporate: false, corporateComments: "",
  },
  {
    id: "dl12", brandId: "br3", broker: "MC", associate: "JR", franchisee: "Dr. Emily Watson",
    cellPhone: "480-555-1202", city: "Scottsdale", state: "AZ", storesBought: 0, storeCount: 1,
    dateIntroCall: "2025-09-15", dateLeaseSigned: null,
    territoryMapLink: "#", marketStudyLink: "#", mapLink: "#", tourBookLink: "#",
    cobroker: "", cobrokerPercent: "", estimatedCommission: 42000,
    status: "First LOI(s) Submitted",
    notes: [
      { date: "2026-02-01", text: "LOI submitted for Kierland Commons space.", author: "MC" },
      { date: "2025-11-05", text: "Toured 4 properties. Kierland Commons preferred.", author: "JR" },
    ],
    documents: { ...emptyDocs, engagementLetter: "#", flyer: "#", signedLOI: "#" },
    isOneOff: false, corporate: false, corporateComments: "",
  },
  {
    id: "dl13", brandId: "br3", broker: "SM", associate: "", franchisee: "Dr. Alex Patel",
    cellPhone: "212-555-1303", city: "New York", state: "NY", storesBought: 0, storeCount: 2,
    dateIntroCall: "2025-11-10", dateLeaseSigned: null,
    territoryMapLink: "#", marketStudyLink: null, mapLink: null, tourBookLink: null,
    cobroker: "Linda Cho", cobrokerPercent: "35%", estimatedCommission: 85000,
    status: "Market Study",
    notes: [
      { date: "2026-01-15", text: "Market study for Manhattan — Tribeca and SoHo.", author: "SM" },
      { date: "2025-11-10", text: "Intro call — wants premium Manhattan locations.", author: "SM" },
    ],
    documents: { ...emptyDocs, engagementLetter: "#" },
    isOneOff: false, corporate: false, corporateComments: "",
  },
  {
    id: "dl14", brandId: "br3", broker: "MC", associate: "", franchisee: "Dr. Sarah Lin",
    cellPhone: "415-555-1404", city: "San Francisco", state: "CA", storesBought: 0, storeCount: 1,
    dateIntroCall: "2026-01-08", dateLeaseSigned: null,
    territoryMapLink: null, marketStudyLink: null, mapLink: null, tourBookLink: null,
    cobroker: "", cobrokerPercent: "", estimatedCommission: 48000,
    status: "Kick Off",
    notes: [
      { date: "2026-01-08", text: "Initial sales call — exploring SF market entry.", author: "MC" },
    ],
    documents: emptyDocs,
    isOneOff: false, corporate: false, corporateComments: "",
  },
  {
    id: "dl15", brandId: "br3", broker: "SM", associate: "JR", franchisee: "Dr. James Park",
    cellPhone: "702-555-1505", city: "Las Vegas", state: "NV", storesBought: 0, storeCount: 1,
    dateIntroCall: "2025-07-01", dateLeaseSigned: null,
    territoryMapLink: "#", marketStudyLink: "#", mapLink: "#", tourBookLink: "#",
    cobroker: "", cobrokerPercent: "", estimatedCommission: 38000,
    status: "On Hold",
    notes: [
      { date: "2025-12-20", text: "Deal on hold — franchisee reviewing financing options.", author: "SM" },
      { date: "2025-10-01", text: "LOI submitted but landlord slow to respond.", author: "JR" },
    ],
    documents: { ...emptyDocs, engagementLetter: "#", flyer: "#" },
    isOneOff: false, corporate: false, corporateComments: "",
  },

  // GolfTRK
  {
    id: "dl16", brandId: "br4", broker: "MC", associate: "AL", franchisee: "Chris Anderson",
    cellPhone: "704-555-1606", city: "Charlotte", state: "NC", storesBought: 0, storeCount: 1,
    dateIntroCall: "2025-08-20", dateLeaseSigned: null,
    territoryMapLink: "#", marketStudyLink: "#", mapLink: "#", tourBookLink: "#",
    cobroker: "", cobrokerPercent: "", estimatedCommission: 25000,
    status: "Site Tours",
    notes: [
      { date: "2026-01-18", text: "Touring South End & Ballantyne locations.", author: "MC" },
      { date: "2025-10-10", text: "Market study complete — strong golf demographics.", author: "AL" },
    ],
    documents: { ...emptyDocs, engagementLetter: "#", flyer: "#" },
    isOneOff: false, corporate: false, corporateComments: "",
  },
  {
    id: "dl17", brandId: "br4", broker: "SM", associate: "", franchisee: "Brian Kelly",
    cellPhone: "614-555-1707", city: "Columbus", state: "OH", storesBought: 1, storeCount: 1,
    dateIntroCall: "2025-05-01", dateLeaseSigned: "2025-10-15",
    territoryMapLink: "#", marketStudyLink: "#", mapLink: "#", tourBookLink: "#",
    cobroker: "", cobrokerPercent: "", estimatedCommission: 22000,
    status: "Signed",
    notes: [
      { date: "2025-10-15", text: "Lease signed! Polaris area location.", author: "SM" },
      { date: "2025-08-01", text: "LOI accepted.", author: "SM" },
    ],
    documents: { ...emptyDocs, engagementLetter: "#", signedLOI: "#", signedLease: "#", commissionAgreement: "#" },
    isOneOff: false, corporate: false, corporateComments: "",
  },
  {
    id: "dl18", brandId: "br4", broker: "MC", associate: "AL", franchisee: "Derek Taylor",
    cellPhone: "615-555-1808", city: "Nashville", state: "TN", storesBought: 0, storeCount: 1,
    dateIntroCall: "2025-10-28", dateLeaseSigned: null,
    territoryMapLink: "#", marketStudyLink: "#", mapLink: null, tourBookLink: null,
    cobroker: "", cobrokerPercent: "", estimatedCommission: 20000,
    status: "Market Study",
    notes: [
      { date: "2025-12-20", text: "Evaluating Green Hills and Cool Springs.", author: "AL" },
      { date: "2025-10-28", text: "Intro call done — Nashville market.", author: "MC" },
    ],
    documents: { ...emptyDocs, engagementLetter: "#" },
    isOneOff: false, corporate: false, corporateComments: "",
  },
  {
    id: "dl19", brandId: "br4", broker: "SM", associate: "", franchisee: "Ryan Hughes",
    cellPhone: "813-555-1909", city: "Tampa", state: "FL", storesBought: 0, storeCount: 2,
    dateIntroCall: "2025-11-15", dateLeaseSigned: null,
    territoryMapLink: "#", marketStudyLink: null, mapLink: null, tourBookLink: null,
    cobroker: "Pete Allen", cobrokerPercent: "25%", estimatedCommission: 30000,
    status: "Kick Off",
    notes: [
      { date: "2025-11-15", text: "Intro call — wants 2 Tampa Bay area locations.", author: "SM" },
    ],
    documents: emptyDocs,
    isOneOff: false, corporate: false, corporateComments: "",
  },
  {
    id: "dl20", brandId: "br4", broker: "MC", associate: "", franchisee: "Steve Martinez",
    cellPhone: "303-555-2020", city: "Denver", state: "CO", storesBought: 0, storeCount: 1,
    dateIntroCall: "2025-06-05", dateLeaseSigned: null,
    territoryMapLink: "#", marketStudyLink: "#", mapLink: "#", tourBookLink: "#",
    cobroker: "", cobrokerPercent: "", estimatedCommission: 18000,
    status: "Lease Negotiations",
    notes: [
      { date: "2026-02-10", text: "Lease being drafted — Cherry Creek location.", author: "MC" },
      { date: "2025-11-22", text: "LOI accepted by landlord.", author: "MC" },
    ],
    documents: { ...emptyDocs, engagementLetter: "#", signedLOI: "#", floorPlan: "#" },
    isOneOff: false, corporate: false, corporateComments: "",
  },

  // dermani MEDSPA
  {
    id: "dl21", brandId: "br5", broker: "SM", associate: "JR", franchisee: "Dr. Nicole Adams",
    cellPhone: "404-555-2101", city: "Atlanta", state: "GA", storesBought: 2, storeCount: 2,
    dateIntroCall: "2025-01-15", dateLeaseSigned: "2025-06-20",
    territoryMapLink: "#", marketStudyLink: "#", mapLink: "#", tourBookLink: "#",
    cobroker: "", cobrokerPercent: "", estimatedCommission: 52000,
    status: "Signed",
    notes: [
      { date: "2025-06-20", text: "Both Buckhead and Sandy Springs leases signed.", author: "SM" },
      { date: "2025-04-10", text: "LOIs accepted on both locations.", author: "JR" },
    ],
    documents: { ...emptyDocs, engagementLetter: "#", signedLOI: "#", signedLease: "#", floorPlan: "#", approvalPackage: "#", commissionAgreement: "#" },
    isOneOff: false, corporate: false, corporateComments: "",
  },
  {
    id: "dl22", brandId: "br5", broker: "MC", associate: "AL", franchisee: "Dr. Mark Rodriguez",
    cellPhone: "469-555-2202", city: "Plano", state: "TX", storesBought: 0, storeCount: 1,
    dateIntroCall: "2025-09-22", dateLeaseSigned: null,
    territoryMapLink: "#", marketStudyLink: "#", mapLink: "#", tourBookLink: "#",
    cobroker: "", cobrokerPercent: "", estimatedCommission: 28000,
    status: "First LOI(s) Submitted",
    notes: [
      { date: "2026-01-28", text: "LOI submitted for Legacy West space.", author: "MC" },
      { date: "2025-11-15", text: "Toured Legacy West and Shops at Willow Bend.", author: "AL" },
    ],
    documents: { ...emptyDocs, engagementLetter: "#", flyer: "#", signedLOI: "#" },
    isOneOff: false, corporate: false, corporateComments: "",
  },
  {
    id: "dl23", brandId: "br5", broker: "SM", associate: "", franchisee: "Dr. Amy Chen",
    cellPhone: "858-555-2303", city: "San Diego", state: "CA", storesBought: 0, storeCount: 1,
    dateIntroCall: "2025-12-10", dateLeaseSigned: null,
    territoryMapLink: null, marketStudyLink: null, mapLink: null, tourBookLink: null,
    cobroker: "", cobrokerPercent: "", estimatedCommission: 32000,
    status: "Kick Off",
    notes: [
      { date: "2025-12-10", text: "Intro call — La Jolla or Del Mar preferred.", author: "SM" },
    ],
    documents: emptyDocs,
    isOneOff: false, corporate: false, corporateComments: "",
  },
  {
    id: "dl24", brandId: "br5", broker: "MC", associate: "", franchisee: "Dr. John Baker",
    cellPhone: "972-555-2404", city: "Fort Worth", state: "TX", storesBought: 0, storeCount: 1,
    dateIntroCall: "2025-08-05", dateLeaseSigned: null,
    territoryMapLink: "#", marketStudyLink: "#", mapLink: "#", tourBookLink: "#",
    cobroker: "", cobrokerPercent: "", estimatedCommission: 24000,
    status: "On Hold",
    notes: [
      { date: "2025-12-05", text: "Deal on hold — franchisee dealing with construction permit delays.", author: "MC" },
      { date: "2025-10-20", text: "LOI submitted for Clearfork location.", author: "MC" },
    ],
    documents: { ...emptyDocs, engagementLetter: "#", flyer: "#" },
    isOneOff: false, corporate: false, corporateComments: "",
  },

  // One-Off Deals
  {
    id: "dl25", brandId: "br1", broker: "SM", associate: "", franchisee: "Corporate HQ Relocation",
    cellPhone: "214-555-9901", city: "Frisco", state: "TX", storesBought: 0, storeCount: 1,
    dateIntroCall: "2025-10-01", dateLeaseSigned: null,
    territoryMapLink: null, marketStudyLink: null, mapLink: null, tourBookLink: null,
    cobroker: "", cobrokerPercent: "", estimatedCommission: 65000,
    status: "Lease Negotiations",
    notes: [
      { date: "2026-01-10", text: "Lease negotiation for 15,000 SF office space.", author: "SM" },
    ],
    documents: emptyDocs,
    isOneOff: true, corporate: true, corporateComments: "Corporate HQ relocation — not a franchise deal.",
  },
  {
    id: "dl26", brandId: "br3", broker: "MC", associate: "JR", franchisee: "Pop-Up Wellness Event",
    cellPhone: "310-555-9902", city: "West Hollywood", state: "CA", storesBought: 0, storeCount: 1,
    dateIntroCall: "2026-01-05", dateLeaseSigned: null,
    territoryMapLink: null, marketStudyLink: null, mapLink: null, tourBookLink: null,
    cobroker: "", cobrokerPercent: "", estimatedCommission: 12000,
    status: "Site Tours",
    notes: [
      { date: "2026-02-01", text: "Touring short-term lease spaces on Sunset.", author: "MC" },
    ],
    documents: emptyDocs,
    isOneOff: true, corporate: true, corporateComments: "Temporary pop-up — 6 month lease.",
  },
];

export function getDealRecordById(id: string) {
  return dealRecords.find((d) => d.id === id);
}

export function getDealRecordsByBrand(brandId: string) {
  return dealRecords.filter((d) => d.brandId === brandId);
}

export function getUniqueBrokers() {
  return [...new Set(dealRecords.map((d) => d.broker))];
}

export function getUniqueStates() {
  return [...new Set(dealRecords.map((d) => d.state))].sort();
}

// Status badge styles
export const dealStatusColors: Record<DealStatusNew, { bg: string; text: string; dot: string }> = {
  "Signed":                  { bg: "bg-emerald-500/15", text: "text-emerald-700", dot: "bg-emerald-500" },
  "Lease Negotiations":      { bg: "bg-blue-500/15",    text: "text-blue-700",    dot: "bg-blue-500" },
  "LOI Negotiations":        { bg: "bg-indigo-500/15",  text: "text-indigo-700",  dot: "bg-indigo-500" },
  "First LOI(s) Submitted":  { bg: "bg-sky-400/15",     text: "text-sky-700",     dot: "bg-sky-500" },
  "Site Tours":              { bg: "bg-teal-500/15",    text: "text-teal-700",    dot: "bg-teal-500" },
  "Market Study":            { bg: "bg-purple-500/15",  text: "text-purple-700",  dot: "bg-purple-500" },
  "Kick Off":                { bg: "bg-gray-400/15",    text: "text-gray-600",    dot: "bg-gray-400" },
  "On Hold":                 { bg: "bg-amber-500/15",   text: "text-amber-700",   dot: "bg-amber-500" },
};

// Row tint for table view
export function getRowTint(status: DealStatusNew): string {
  if (status === "Signed") return "bg-emerald-50/60";
  if (status === "On Hold") return "bg-red-50/50";
  return "";
}
