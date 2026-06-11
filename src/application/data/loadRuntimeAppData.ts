import { rebuildBrandRuntimeData } from "@/data/brandsData";
import { replaceBizDevRuntimeData, type BizDevCategory, type BizDevRecord, type BizDevStatus } from "@/data/bizDevData";
import {
  emptyDealDocuments,
  replaceDealRuntimeData,
  type DealBrand,
  type DealDocuments,
  type DealNote,
  type DealRecord,
  type DealStatusNew,
} from "@/data/dealsData";
import { replaceMapRuntimeData, type DealStage, type Site, type SiteFile, type SiteLoiTerms } from "@/data/mapRuntimeData";
import { replaceSpaceRequirementsRuntimeData, type GasReq, type SecondFloor, type SpaceRequirement } from "@/data/spaceReqData";
import { replaceTeamRuntimeData } from "@/data/teamData";
import type { UserRole } from "@/domain/entities";
import { notifyRuntimeDataChanged } from "@/application/data/runtimeStore";
import { supabaseRequest } from "@/infrastructure/supabase/client";

type RuntimeLoadOptions = {
  accessToken: string | null;
};

type BrandRow = {
  id: string;
  name: string;
  category: string;
  logo_color: string | null;
  corporate_link: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  username: string | null;
  role: UserRole;
};

type DealRow = {
  id: string;
  brand_id: string;
  franchisee: string;
  broker: string;
  associate: string | null;
  city: string;
  state: string;
  stage: DealStatusNew;
  store_count: number | null;
  stores_bought: number | null;
  estimated_commission: string | number | null;
  intro_call_date: string | null;
  lease_signed_date: string | null;
  is_one_off: boolean | null;
  corporate: boolean | null;
  cell_phone: string | null;
  territory_map_link: string | null;
  market_study_link: string | null;
  map_link: string | null;
  tour_book_link: string | null;
  cobroker: string | null;
  cobroker_percent: string | null;
  corporate_comments: string | null;
  created_at: string;
};

type DealNoteRow = {
  deal_id: string;
  body: string;
  author_name: string | null;
  created_at: string;
};

type DealDocumentKey = keyof DealDocuments;

type DealDocumentRow = {
  deal_id: string;
  document_key: DealDocumentKey;
  file_path: string;
};

type ProspectStatusRow = "active_client" | "inactive_client" | "prospect" | "dead";

type ProspectRow = {
  id: string;
  company_name: string;
  category: string;
  status: ProspectStatusRow;
  owner: string | null;
  website: string | null;
  main_contact: string | null;
  main_contact_email: string | null;
  sub_category: string | null;
  is_franchise: boolean | null;
  reach_out_method: string | null;
  cell: string | null;
  main_contact_position: string | null;
  reach_out_1: string | null;
  reach_out_2: string | null;
  reach_out_3: string | null;
  reach_out_4: string | null;
  created_at: string;
};

type SiteRow = {
  id: string;
  deal_id: string;
  property_name: string | null;
  address: string;
  city: string;
  state: string;
  zip_code: string | null;
  lat: number | null;
  lng: number | null;
  stage: DealStage;
  status_label: string | null;
  notes: string | null;
  square_footage: string | null;
  space_type: string | null;
  property_type: string | null;
  landlord: string | null;
  landlord_contact: string | null;
  lease_term: string | null;
  possession_date: string | null;
  tour_time: string | null;
  broker_name: string | null;
  broker_phone: string | null;
  photo_urls: string[] | null;
  brochure_url: string | null;
  floor_plan_url: string | null;
  loi_url: string | null;
  lease_url: string | null;
  base_rent: string | null;
  nnn: string | null;
  gross_monthly_rent: string | null;
  commencement_date: string | null;
  ti_allowance: string | null;
  loi_notes: string | null;
};

type SpaceRequirementRow = {
  id: string;
  brand_id: string;
  brand_name: string;
  space_type: string;
  min_sf: number;
  max_sf: number;
  ideal_sf: number;
  min_storefront_width: string;
  power: string;
  hvac: string;
  gas: GasReq;
  water_line_size: string;
  sewer_line_size: string;
  slab: string;
  grease_trap: "Yes" | "No";
  second_floor: SecondFloor;
  parking: string;
};

const prospectStatusMap: Record<ProspectStatusRow, BizDevStatus> = {
  active_client: "0 - Active Client",
  inactive_client: "1 - In-Active Client",
  prospect: "2 - Prospect",
  dead: "3 - Dead",
};

function numberFromDb(value: string | number | null): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function dateOnly(value: string | null): string | null {
  if (!value) return null;
  return value.slice(0, 10);
}

function mapBrand(row: BrandRow): DealBrand {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    logoColor: row.logo_color ?? "#E18739",
    corporateLink: row.corporate_link ?? "#",
  };
}

function buildNotes(rows: DealNoteRow[]): Map<string, DealNote[]> {
  const grouped = new Map<string, DealNote[]>();
  for (const row of rows) {
    const current = grouped.get(row.deal_id) ?? [];
    current.push({
      date: dateOnly(row.created_at) ?? row.created_at,
      text: row.body,
      author: row.author_name ?? undefined,
    });
    grouped.set(row.deal_id, current);
  }

  for (const notes of grouped.values()) {
    notes.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }
  return grouped;
}

function buildDocuments(rows: DealDocumentRow[]): Map<string, DealDocuments> {
  const grouped = new Map<string, DealDocuments>();
  for (const row of rows) {
    const current = grouped.get(row.deal_id) ?? { ...emptyDealDocuments };
    current[row.document_key] = row.file_path;
    grouped.set(row.deal_id, current);
  }
  return grouped;
}

function mapDeal(row: DealRow, notes: Map<string, DealNote[]>, documents: Map<string, DealDocuments>): DealRecord {
  return {
    id: row.id,
    brandId: row.brand_id,
    broker: row.broker,
    associate: row.associate ?? "",
    franchisee: row.franchisee,
    cellPhone: row.cell_phone ?? "",
    city: row.city,
    state: row.state,
    storesBought: row.stores_bought ?? 0,
    storeCount: row.store_count ?? 0,
    dateIntroCall: dateOnly(row.intro_call_date),
    dateLeaseSigned: dateOnly(row.lease_signed_date),
    territoryMapLink: row.territory_map_link,
    marketStudyLink: row.market_study_link,
    mapLink: row.map_link,
    tourBookLink: row.tour_book_link,
    cobroker: row.cobroker ?? "",
    cobrokerPercent: row.cobroker_percent ?? "",
    estimatedCommission: numberFromDb(row.estimated_commission),
    status: row.stage,
    notes: notes.get(row.id) ?? [],
    documents: documents.get(row.id) ?? { ...emptyDealDocuments },
    isOneOff: row.is_one_off ?? false,
    corporate: row.corporate ?? false,
    corporateComments: row.corporate_comments ?? "",
  };
}

function normalizeCategory(category: string): BizDevCategory {
  const allowed: readonly BizDevCategory[] = [
    "Beauty",
    "Pet Related",
    "Fitness",
    "Health & Wellness",
    "F&B",
    "Entertainment",
    "Automotive",
    "Service",
    "Medical",
    "Education",
    "Soft Goods",
  ];
  return allowed.includes(category as BizDevCategory) ? (category as BizDevCategory) : "Service";
}

function mapProspect(row: ProspectRow): BizDevRecord {
  return {
    id: row.id,
    status: prospectStatusMap[row.status],
    owner: row.owner ?? "",
    dateAdded: dateOnly(row.created_at) ?? "",
    companyName: row.company_name,
    website: row.website ?? "",
    category: normalizeCategory(row.category),
    subCategory: row.sub_category ?? "",
    isFranchise: row.is_franchise ?? true,
    reachOutMethod: row.reach_out_method ?? "",
    mainContact: row.main_contact ?? "",
    cell: row.cell ?? "",
    mainContactPosition: row.main_contact_position ?? "",
    mainContactEmail: row.main_contact_email ?? "",
    reachOut1: row.reach_out_1 ?? "",
    reachOut2: row.reach_out_2 ?? "",
    reachOut3: row.reach_out_3 ?? "",
    reachOut4: row.reach_out_4 ?? "",
  };
}

function mapSpaceRequirement(row: SpaceRequirementRow): SpaceRequirement {
  return {
    id: row.id,
    brandId: row.brand_id,
    brandName: row.brand_name,
    spaceType: row.space_type,
    minSF: row.min_sf,
    maxSF: row.max_sf,
    idealSF: row.ideal_sf,
    minStorefrontWidth: row.min_storefront_width,
    power: row.power,
    hvac: row.hvac,
    gas: row.gas,
    waterLineSize: row.water_line_size,
    sewerLineSize: row.sewer_line_size,
    slab: row.slab,
    greaseTrap: row.grease_trap,
    secondFloor: row.second_floor,
    parking: row.parking,
  };
}

function mapStatusToLegacyStage(status: DealStatusNew): DealStage {
  if (status === "Signed") return "Open";
  if (status === "Lease Negotiations") return "Lease";
  if (status === "LOI Negotiations" || status === "First LOI(s) Submitted") return "LOI";
  if (status === "On Hold") return "Closed";
  return "Prospecting";
}

function buildSiteFiles(row: SiteRow): SiteFile[] {
  const files: SiteFile[] = [];
  if (row.brochure_url) files.push({ name: "Brochure", type: "brochure", url: row.brochure_url });
  if (row.floor_plan_url) files.push({ name: "Floor Plan", type: "floor_plan", url: row.floor_plan_url });
  if (row.loi_url) files.push({ name: "LOI", type: "loi", url: row.loi_url });
  if (row.lease_url) files.push({ name: "Lease", type: "lease", url: row.lease_url });
  return files;
}

function mapSite(row: SiteRow): Site {
  const loiTerms: SiteLoiTerms = {
    baseRent: row.base_rent ?? "",
    nnn: row.nnn ?? "",
    grossMonthlyRent: row.gross_monthly_rent ?? "",
    leaseTerm: row.lease_term ?? "",
    commencementDate: dateOnly(row.commencement_date) ?? "",
    tiAllowance: row.ti_allowance ?? "",
    notes: row.loi_notes ?? "",
  };

  return {
    id: row.id,
    dealId: row.deal_id,
    name: row.property_name ?? row.address,
    address: row.address,
    city: row.city,
    state: row.state,
    zipCode: row.zip_code ?? "",
    lat: row.lat ?? 0,
    lng: row.lng ?? 0,
    stage: row.stage,
    statusLabel: row.status_label ?? row.stage,
    notes: row.notes ?? "",
    squareFootage: row.square_footage ?? "",
    spaceType: row.space_type ?? "",
    propertyType: row.property_type ?? "",
    landlord: row.landlord ?? "",
    landlordContact: row.landlord_contact ?? "",
    leaseTerm: row.lease_term ?? "",
    possessionDate: dateOnly(row.possession_date) ?? "",
    tourTime: row.tour_time ?? "",
    brokerName: row.broker_name ?? "",
    brokerPhone: row.broker_phone ?? "",
    photoUrls: row.photo_urls ?? [],
    brochureUrl: row.brochure_url ?? "",
    floorPlanUrl: row.floor_plan_url ?? "",
    loiUrl: row.loi_url ?? "",
    leaseUrl: row.lease_url ?? "",
    files: buildSiteFiles(row),
    loiTerms,
  };
}

async function readTable<T>(table: string, accessToken: string | null): Promise<T[]> {
  return supabaseRequest<T[]>(`/rest/v1/${table}`, {
    query: new URLSearchParams({ select: "*" }),
    accessToken,
  });
}

export async function loadRuntimeAppData({ accessToken }: RuntimeLoadOptions): Promise<void> {
  const [brandRows, profileRows, dealRows, noteRows, documentRows, prospectRows, siteRows, spaceRows] = await Promise.all([
    readTable<BrandRow>("brands", accessToken),
    readTable<ProfileRow>("profiles", accessToken),
    readTable<DealRow>("deals", accessToken),
    readTable<DealNoteRow>("deal_notes", accessToken),
    readTable<DealDocumentRow>("deal_documents", accessToken),
    readTable<ProspectRow>("prospects", accessToken),
    readTable<SiteRow>("sites", accessToken),
    readTable<SpaceRequirementRow>("space_requirements", accessToken),
  ]);

  const brands = brandRows.map(mapBrand);
  const notes = buildNotes(noteRows);
  const documents = buildDocuments(documentRows);
  const deals = dealRows.map((row) => mapDeal(row, notes, documents));
  const prospects = prospectRows.map(mapProspect);
  const spaceRequirements = spaceRows.map(mapSpaceRequirement);

  replaceDealRuntimeData({ brands, deals });
  rebuildBrandRuntimeData();
  replaceTeamRuntimeData(profileRows.map((row) => ({
    id: row.id,
    fullName: row.full_name,
    username: row.username,
    role: row.role,
  })));
  replaceBizDevRuntimeData(prospects);
  replaceSpaceRequirementsRuntimeData(spaceRequirements);

  const sitesByDeal = new Map<string, Site[]>();
  for (const row of siteRows) {
    const current = sitesByDeal.get(row.deal_id) ?? [];
    current.push(mapSite(row));
    sitesByDeal.set(row.deal_id, current);
  }

  replaceMapRuntimeData({
    brands: brands.map((brand) => ({ id: brand.id, name: brand.name, logoColor: brand.logoColor })),
    deals: deals.map((deal) => ({
      id: deal.id,
      name: `${brands.find((brand) => brand.id === deal.brandId)?.name ?? "Brand"} — ${deal.city}, ${deal.state}`,
      brandId: deal.brandId,
      market: `${deal.city}, ${deal.state}`,
      stage: mapStatusToLegacyStage(deal.status),
      assignedBroker: deal.broker,
      franchiseeName: deal.franchisee,
      sites: sitesByDeal.get(deal.id) ?? [],
      notes: deal.notes[0]?.text ?? "",
      createdAt: deal.dateIntroCall ?? new Date().toISOString().slice(0, 10),
    })),
  });

  notifyRuntimeDataChanged();
}
