import { getStoredSession } from "@/application/auth/session";
import { rebuildBrandRuntimeData } from "@/data/brandsData";
import {
  bizDevRecords,
  replaceBizDevRuntimeData,
  type BizDevCategory,
  type BizDevRecord,
  type BizDevStatus,
} from "@/data/bizDevData";
import {
  dealBrands,
  dealRecords,
  emptyDealDocuments,
  normalizeDealStatus,
  type BrandStatus,
  type DealBrand,
  type DealDocuments,
  type DealNote,
  type PersistedDealStatus,
  type DealRecord,
  type DealStatusNew,
} from "@/data/dealsData";
import {
  replaceSpaceRequirementsRuntimeData,
  spaceRequirements,
  type GasReq,
  type SecondFloor,
  type SpaceRequirement,
} from "@/data/spaceReqData";
import {
  brands as mapBrands,
  deals as mapDeals,
  getSitesByDeal,
  replaceMapDealRuntime,
  replaceMapRuntimeData,
  replaceSiteRuntime,
  type Deal as MapDeal,
  type DealStage,
  type Site,
  type SiteFile,
  type SiteLoiTerms,
} from "@/data/mapRuntimeData";
import type { TakeActionAudience, TakeActionStatus } from "@/domain/entities";
import { supabaseRequest, type JsonObject } from "@/infrastructure/supabase/client";
import { notifyRuntimeDataChanged } from "@/application/data/runtimeStore";
import { sendTakeActionNotification } from "@/lib/takeActionNotifications";

type BrandRow = {
  id: string;
  name: string;
  status?: BrandStatus | null;
  is_hidden?: boolean | null;
  category: string;
  logo_color: string | null;
  corporate_link: string | null;
  internal_link: string | null;
  franchisor_link: string | null;
  franchisor_map_link: string | null;
  source_key: string | null;
  source_sheet: string | null;
  source_row: number | null;
};

type ProspectStatusRow = "active_client" | "inactive_client" | "prospect" | "dead";

type ProspectRow = {
  id: string;
  company_name: string;
  category: string;
  sub_category: string | null;
  status: ProspectStatusRow;
  source_status_label: string | null;
  owner: string | null;
  website: string | null;
  is_franchise: boolean | null;
  date_added: string | null;
  brick_and_mortar: string | null;
  estimated_location_count: number | null;
  franchise_or_corporate: string | null;
  reach_out_method: string | null;
  main_contact: string | null;
  cell: string | null;
  office_phone: string | null;
  linkedin: string | null;
  main_contact_position: string | null;
  main_contact_email: string | null;
  secondary_contact: string | null;
  secondary_position: string | null;
  secondary_email: string | null;
  secondary_cell: string | null;
  secondary_office: string | null;
  secondary_linkedin: string | null;
  lead_source: string | null;
  reach_out_1: string | null;
  reach_out_2: string | null;
  reach_out_3: string | null;
  reach_out_4: string | null;
  reach_out_5: string | null;
  final_reach_out: string | null;
  last_reach_out_date: string | null;
  next_follow_up_date: string | null;
  overdue: string | null;
  update_notes: string | null;
  source_key: string | null;
  source_sheet: string | null;
  source_row: number | null;
  created_at: string;
};

type DealRow = {
  id: string;
  brand_id: string;
  name: string | null;
  source_status_label: string | null;
  source_key: string | null;
  source_sheet: string | null;
  source_row: number | null;
  franchisee: string;
  broker: string;
  associate: string | null;
  cell_phone: string | null;
  city: string;
  state: string;
  stage: PersistedDealStatus;
  store_count: number | null;
  stores_bought: number | null;
  estimated_commission: string | number | null;
  intro_call_date: string | null;
  lease_signed_date: string | null;
  territory_map_link: string | null;
  market_study_link: string | null;
  map_link: string | null;
  tour_book_link: string | null;
  cobroker: string | null;
  cobroker_percent: string | null;
  is_one_off: boolean | null;
  corporate: boolean | null;
  corporate_comments: string | null;
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

type TakeActionRow = {
  id: string;
  deal_id: string;
  audience: TakeActionAudience;
  status: TakeActionStatus;
  title: string;
  body: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type SpaceRequirementRow = {
  id: string;
  brand_id: string;
  brand_name: string;
  space_type: string;
  min_sf: number;
  max_sf: number;
  ideal_sf: number;
  min_sf_raw: string | null;
  max_sf_raw: string | null;
  ideal_sf_raw: string | null;
  landlord_deck_link: string | null;
  loi_template_link: string | null;
  other_special_requirements: string | null;
  source_key: string | null;
  source_sheet: string | null;
  source_row: number | null;
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

export type BrandMutationInput = {
  name: string;
  category: string;
  status?: BrandStatus;
  logoColor: string;
  franchisorLink?: string;
  corporateLink?: string;
};

export type ProspectMutationInput = Omit<BizDevRecord, "id">;

export type DealMutationInput = {
  brandId: string;
  franchisee: string;
  cellPhone: string;
  city: string;
  state: string;
  broker: string;
  associate: string;
  corporate: boolean;
  dateIntroCall: string;
  dateLeaseSigned: string;
  storesBought: number;
  storeCount: number;
  territoryMapLink: string;
  marketStudyLink: string;
  mapLink: string;
  tourBookLink: string;
  cobroker: string;
  cobrokerPercent: string;
  estimatedCommission: number;
  status: DealStatusNew;
  initialNote?: string;
  documents: DealDocuments;
  isOneOff: boolean;
  corporateComments: string;
};

export type DealActionMutationInput = {
  dealId: string;
  audience: TakeActionAudience;
  title: string;
  body: string;
  recipients: string[];
  requestedBy: string;
  contextName: string;
  contextUrl: string;
  message: string;
  urgency?: string;
};

export type SpaceRequirementMutationInput = Omit<SpaceRequirement, "id">;

export type TourBookMutationInput = {
  dealId: string;
  title: string;
  status: "draft" | "generated" | "sent";
  generatedUrl: string;
};

export type SiteMutationInput = {
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
  baseRent: string;
  nnn: string;
  grossMonthlyRent: string;
  commencementDate: string;
  tiAllowance: string;
  loiNotes: string;
};

const prospectStatusToDb: Record<BizDevStatus, ProspectStatusRow> = {
  "0 - Active Client": "active_client",
  "1 - In-Active Client": "inactive_client",
  "2 - Prospect": "prospect",
  "3 - Dead": "dead",
};

const prospectStatusFromDb: Record<ProspectStatusRow, BizDevStatus> = {
  active_client: "0 - Active Client",
  inactive_client: "1 - In-Active Client",
  prospect: "2 - Prospect",
  dead: "3 - Dead",
};

const documentKeys: DealDocumentKey[] = [
  "engagementLetter",
  "cobrokerAgreement",
  "flyer",
  "demo",
  "signedLOI",
  "floorPlan",
  "approvalPackage",
  "commissionAgreement",
  "signedLease",
];

function accessToken(): string {
  const token = getStoredSession()?.accessToken;
  if (!token) throw new Error("Session expired. Log in again before saving changes.");
  return token;
}

function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function dateToNull(value: string): string | null {
  return blankToNull(value);
}

function linkToNull(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "https://") return null;
  return trimmed;
}

function dateOnly(value: string | null): string | null {
  if (!value) return null;
  return value.slice(0, 10);
}

function numberFromDb(value: string | number | null): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function cleanNumber(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function one<T>(rows: T[], table: string): T {
  if (!rows[0]) throw new Error(`Supabase returned no rows for ${table}.`);
  return rows[0];
}

async function insertReturning<T>(table: string, body: JsonObject): Promise<T> {
  const rows = await supabaseRequest<T[]>(`/rest/v1/${table}`, {
    method: "POST",
    body,
    accessToken: accessToken(),
    prefer: "return=representation",
  });
  return one(rows, table);
}

async function patchReturning<T>(table: string, id: string, body: JsonObject): Promise<T> {
  const query = new URLSearchParams({ id: `eq.${id}` });
  const rows = await supabaseRequest<T[]>(`/rest/v1/${table}`, {
    method: "PATCH",
    query,
    body,
    accessToken: accessToken(),
    prefer: "return=representation",
  });
  return one(rows, table);
}

async function deleteById(table: string, id: string): Promise<void> {
  const query = new URLSearchParams({ id: `eq.${id}` });
  await supabaseRequest<unknown>(`/rest/v1/${table}`, {
    method: "DELETE",
    query,
    accessToken: accessToken(),
  });
}

async function deleteDealDocuments(dealId: string, keys: DealDocumentKey[]): Promise<void> {
  if (keys.length === 0) return;

  const query = new URLSearchParams({
    deal_id: `eq.${dealId}`,
    document_key: `in.(${keys.join(",")})`,
  });
  await supabaseRequest<unknown>("/rest/v1/deal_documents", {
    method: "DELETE",
    query,
    accessToken: accessToken(),
  });
}

function mapBrand(row: BrandRow): DealBrand {
  return {
    id: row.id,
    name: row.name,
    status: row.status === "prospect" ? "prospect" : "active",
    isHidden: Boolean(row.is_hidden),
    category: row.category,
    logoColor: row.logo_color ?? "#E18739",
    corporateLink: row.corporate_link ?? "#",
    internalLink: row.internal_link,
    franchisorLink: row.franchisor_link,
    franchisorMapLink: row.franchisor_map_link,
    sourceKey: row.source_key,
    sourceSheet: row.source_sheet,
    sourceRow: row.source_row,
  };
}

function upsertBrandRuntime(brand: DealBrand): void {
  const next = [brand, ...dealBrands.filter((current) => current.id !== brand.id)];
  dealBrands.splice(0, dealBrands.length, ...next);
  rebuildBrandRuntimeData();
  notifyRuntimeDataChanged();
}

function mapProspect(row: ProspectRow): BizDevRecord {
  return {
    id: row.id,
    status: prospectStatusFromDb[row.status],
    sourceStatusLabel: row.source_status_label,
    owner: row.owner ?? "",
    dateAdded: dateOnly(row.date_added) ?? dateOnly(row.created_at) ?? "",
    companyName: row.company_name,
    website: row.website ?? "",
    category: row.category as BizDevCategory,
    subCategory: row.sub_category ?? "",
    isFranchise: row.is_franchise ?? true,
    reachOutMethod: row.reach_out_method ?? "",
    mainContact: row.main_contact ?? "",
    cell: row.cell ?? "",
    officePhone: row.office_phone ?? "",
    linkedin: row.linkedin ?? "",
    mainContactPosition: row.main_contact_position ?? "",
    mainContactEmail: row.main_contact_email ?? "",
    secondaryContact: row.secondary_contact ?? "",
    secondaryPosition: row.secondary_position ?? "",
    secondaryEmail: row.secondary_email ?? "",
    secondaryCell: row.secondary_cell ?? "",
    secondaryOffice: row.secondary_office ?? "",
    secondaryLinkedin: row.secondary_linkedin ?? "",
    leadSource: row.lead_source ?? "",
    brickAndMortar: row.brick_and_mortar ?? "",
    estimatedLocationCount: row.estimated_location_count,
    franchiseOrCorporate: row.franchise_or_corporate ?? "",
    reachOut1: dateOnly(row.reach_out_1) ?? "",
    reachOut2: dateOnly(row.reach_out_2) ?? "",
    reachOut3: dateOnly(row.reach_out_3) ?? "",
    reachOut4: dateOnly(row.reach_out_4) ?? "",
    reachOut5: dateOnly(row.reach_out_5) ?? "",
    finalReachOut: dateOnly(row.final_reach_out) ?? "",
    lastReachOutDate: dateOnly(row.last_reach_out_date) ?? "",
    nextFollowUpDate: dateOnly(row.next_follow_up_date) ?? "",
    overdue: row.overdue ?? "",
    updateNotes: row.update_notes ?? "",
    sourceKey: row.source_key,
    sourceSheet: row.source_sheet,
    sourceRow: row.source_row,
  };
}

function upsertProspectRuntime(record: BizDevRecord): void {
  const exists = bizDevRecords.some((current) => current.id === record.id);
  const next = exists
    ? bizDevRecords.map((current) => (current.id === record.id ? record : current))
    : [record, ...bizDevRecords];
  replaceBizDevRuntimeData(next);
  notifyRuntimeDataChanged();
}

function mapDeal(row: DealRow, existing?: DealRecord): DealRecord {
  return {
    id: row.id,
    brandId: row.brand_id,
    name: row.name,
    sourceStatusLabel: row.source_status_label,
    sourceKey: row.source_key,
    sourceSheet: row.source_sheet,
    sourceRow: row.source_row,
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
    status: normalizeDealStatus(row.stage),
    notes: existing?.notes ?? [],
    documents: existing?.documents ?? { ...emptyDealDocuments },
    isOneOff: row.is_one_off ?? false,
    corporate: row.corporate ?? false,
    corporateComments: row.corporate_comments ?? "",
  };
}

function mapNote(row: DealNoteRow): DealNote {
  return {
    date: dateOnly(row.created_at) ?? row.created_at,
    text: row.body,
    author: row.author_name ?? undefined,
  };
}

function statusToMapStage(status: DealStatusNew): DealStage {
  if (status === "Signed") return "Open";
  if (status === "Lease Negotiations") return "Lease";
  if (status === "LOI Negotiations") return "LOI";
  if (status === "On Hold") return "Closed";
  return "Prospecting";
}

function dealRecordToMapDeal(record: DealRecord, sites: Site[] = getSitesByDeal(record.id)): MapDeal {
  const brand = dealBrands.find((item) => item.id === record.brandId);
  return {
    id: record.id,
    name: record.name ?? `${brand?.name ?? "Brand"} — ${record.city}, ${record.state}`,
    brandId: record.brandId,
    market: `${record.city}, ${record.state}`,
    stage: statusToMapStage(record.status),
    assignedBroker: record.broker,
    franchiseeName: record.franchisee,
    sites,
    notes: record.notes[0]?.text ?? "",
    createdAt: record.dateIntroCall ?? new Date().toISOString().slice(0, 10),
  };
}

function upsertDealRuntime(record: DealRecord): void {
  const exists = dealRecords.some((current) => current.id === record.id);
  const next = exists
    ? dealRecords.map((current) => (current.id === record.id ? record : current))
    : [record, ...dealRecords];
  dealRecords.splice(0, dealRecords.length, ...next);
  rebuildBrandRuntimeData();
  replaceMapDealRuntime(dealRecordToMapDeal(record));
  notifyRuntimeDataChanged();
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
    minSFRaw: row.min_sf_raw,
    maxSFRaw: row.max_sf_raw,
    idealSFRaw: row.ideal_sf_raw,
    landlordDeckLink: row.landlord_deck_link,
    loiTemplateLink: row.loi_template_link,
    otherSpecialRequirements: row.other_special_requirements,
    sourceKey: row.source_key,
    sourceSheet: row.source_sheet,
    sourceRow: row.source_row,
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

function upsertSpaceRequirementRuntime(record: SpaceRequirement): void {
  const exists = spaceRequirements.some((current) => current.id === record.id);
  const next = exists
    ? spaceRequirements.map((current) => (current.id === record.id ? record : current))
    : [...spaceRequirements, record];
  replaceSpaceRequirementsRuntimeData(next);
  notifyRuntimeDataChanged();
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

function upsertSiteRuntime(record: Site): void {
  const attached = replaceSiteRuntime(record);
  if (!attached) {
    const parentDeal = dealRecords.find((deal) => deal.id === record.dealId);
    if (parentDeal) replaceMapDealRuntime(dealRecordToMapDeal(parentDeal, [record]));
  }
  notifyRuntimeDataChanged();
}

function brandBody(input: BrandMutationInput): JsonObject {
  const link = input.franchisorLink ?? input.corporateLink ?? "";
  return {
    name: input.name.trim(),
    category: input.category.trim() || "Uncategorized",
    status: input.status ?? "active",
    is_hidden: false,
    logo_color: input.logoColor.trim() || "#E18739",
    corporate_link: linkToNull(link) ?? "#",
  };
}

function prospectBody(input: ProspectMutationInput): JsonObject {
  return {
    company_name: input.companyName.trim(),
    category: input.category,
    sub_category: blankToNull(input.subCategory),
    status: prospectStatusToDb[input.status],
    owner: blankToNull(input.owner),
    website: linkToNull(input.website),
    is_franchise: input.isFranchise,
    reach_out_method: blankToNull(input.reachOutMethod),
    main_contact: blankToNull(input.mainContact),
    cell: blankToNull(input.cell),
    main_contact_position: blankToNull(input.mainContactPosition),
    main_contact_email: blankToNull(input.mainContactEmail),
    reach_out_1: dateToNull(input.reachOut1),
    reach_out_2: dateToNull(input.reachOut2),
    reach_out_3: dateToNull(input.reachOut3),
    reach_out_4: dateToNull(input.reachOut4),
    reach_out_5: dateToNull(input.reachOut5 ?? ""),
    final_reach_out: dateToNull(input.finalReachOut ?? ""),
    last_reach_out_date: dateToNull(input.lastReachOutDate ?? ""),
    next_follow_up_date: dateToNull(input.nextFollowUpDate ?? ""),
    source_status_label: input.sourceStatusLabel ?? null,
    date_added: dateToNull(input.dateAdded),
    brick_and_mortar: blankToNull(input.brickAndMortar ?? ""),
    estimated_location_count: input.estimatedLocationCount ?? null,
    franchise_or_corporate: blankToNull(input.franchiseOrCorporate ?? ""),
    office_phone: blankToNull(input.officePhone ?? ""),
    linkedin: linkToNull(input.linkedin ?? ""),
    secondary_contact: blankToNull(input.secondaryContact ?? ""),
    secondary_position: blankToNull(input.secondaryPosition ?? ""),
    secondary_email: blankToNull(input.secondaryEmail ?? ""),
    secondary_cell: blankToNull(input.secondaryCell ?? ""),
    secondary_office: blankToNull(input.secondaryOffice ?? ""),
    secondary_linkedin: linkToNull(input.secondaryLinkedin ?? ""),
    lead_source: blankToNull(input.leadSource ?? ""),
    overdue: blankToNull(input.overdue ?? ""),
    update_notes: blankToNull(input.updateNotes ?? ""),
  };
}

function dealBody(input: DealMutationInput): JsonObject {
  return {
    brand_id: input.brandId,
    franchisee: input.franchisee.trim(),
    broker: input.broker.trim(),
    associate: blankToNull(input.associate),
    cell_phone: blankToNull(input.cellPhone),
    city: input.city.trim(),
    state: input.state.trim(),
    stage: normalizeDealStatus(input.status),
    store_count: cleanNumber(input.storeCount),
    stores_bought: cleanNumber(input.storesBought),
    estimated_commission: cleanNumber(input.estimatedCommission),
    intro_call_date: dateToNull(input.dateIntroCall),
    lease_signed_date: dateToNull(input.dateLeaseSigned),
    territory_map_link: linkToNull(input.territoryMapLink),
    market_study_link: linkToNull(input.marketStudyLink),
    map_link: linkToNull(input.mapLink),
    tour_book_link: linkToNull(input.tourBookLink),
    cobroker: blankToNull(input.cobroker),
    cobroker_percent: blankToNull(input.cobrokerPercent),
    is_one_off: input.isOneOff,
    corporate: input.corporate,
    corporate_comments: input.corporateComments.trim(),
  };
}

function spaceRequirementBody(input: SpaceRequirementMutationInput): JsonObject {
  return {
    brand_id: input.brandId,
    brand_name: input.brandName.trim(),
    space_type: input.spaceType.trim(),
    min_sf: cleanNumber(input.minSF),
    max_sf: cleanNumber(input.maxSF),
    ideal_sf: cleanNumber(input.idealSF),
    min_storefront_width: input.minStorefrontWidth.trim(),
    power: input.power.trim(),
    hvac: input.hvac.trim(),
    gas: input.gas,
    water_line_size: input.waterLineSize.trim(),
    sewer_line_size: input.sewerLineSize.trim(),
    slab: input.slab.trim(),
    grease_trap: input.greaseTrap,
    second_floor: input.secondFloor,
    parking: input.parking.trim(),
    min_sf_raw: input.minSFRaw ?? null,
    max_sf_raw: input.maxSFRaw ?? null,
    ideal_sf_raw: input.idealSFRaw ?? null,
    landlord_deck_link: linkToNull(input.landlordDeckLink ?? ""),
    loi_template_link: linkToNull(input.loiTemplateLink ?? ""),
    other_special_requirements: blankToNull(input.otherSpecialRequirements ?? ""),
  };
}

function siteBody(input: SiteMutationInput): JsonObject {
  return {
    deal_id: input.dealId,
    property_name: blankToNull(input.name),
    address: input.address.trim(),
    city: input.city.trim(),
    state: input.state.trim(),
    zip_code: blankToNull(input.zipCode),
    lat: cleanNumber(input.lat),
    lng: cleanNumber(input.lng),
    stage: input.stage,
    status_label: blankToNull(input.statusLabel),
    notes: blankToNull(input.notes),
    square_footage: blankToNull(input.squareFootage),
    space_type: blankToNull(input.spaceType),
    property_type: blankToNull(input.propertyType),
    landlord: blankToNull(input.landlord),
    landlord_contact: blankToNull(input.landlordContact),
    lease_term: blankToNull(input.leaseTerm),
    possession_date: dateToNull(input.possessionDate),
    tour_time: blankToNull(input.tourTime),
    broker_name: blankToNull(input.brokerName),
    broker_phone: blankToNull(input.brokerPhone),
    photo_urls: input.photoUrls.map((url) => url.trim()).filter(Boolean),
    brochure_url: linkToNull(input.brochureUrl),
    floor_plan_url: linkToNull(input.floorPlanUrl),
    loi_url: linkToNull(input.loiUrl),
    lease_url: linkToNull(input.leaseUrl),
    base_rent: blankToNull(input.baseRent),
    nnn: blankToNull(input.nnn),
    gross_monthly_rent: blankToNull(input.grossMonthlyRent),
    commencement_date: dateToNull(input.commencementDate),
    ti_allowance: blankToNull(input.tiAllowance),
    loi_notes: blankToNull(input.loiNotes),
  };
}

function cleanDocuments(input: DealDocuments): DealDocuments {
  return documentKeys.reduce<DealDocuments>((acc, key) => {
    const value = input[key]?.trim();
    acc[key] = value && value !== "https://" ? value : null;
    return acc;
  }, { ...emptyDealDocuments });
}

async function syncDealDocuments(
  dealId: string,
  input: DealDocuments,
  existing: DealDocuments = { ...emptyDealDocuments },
): Promise<DealDocuments> {
  const documents = cleanDocuments(input);
  const rows: JsonObject[] = documentKeys
    .filter((key) => documents[key])
    .map((key) => ({
      deal_id: dealId,
      document_key: key,
      file_path: documents[key] ?? "",
    }));

  if (rows.length > 0) {
    const query = new URLSearchParams({ on_conflict: "deal_id,document_key" });
    await supabaseRequest<DealDocumentRow[]>("/rest/v1/deal_documents", {
      method: "POST",
      query,
      body: rows,
      accessToken: accessToken(),
      prefer: "resolution=merge-duplicates,return=representation",
    });
  }

  const keysToDelete = documentKeys.filter((key) => existing[key] && !documents[key]);
  await deleteDealDocuments(dealId, keysToDelete);

  return documents;
}

export async function createDealNote(dealId: string, body: string): Promise<DealNote | null> {
  const text = body.trim();
  if (!text) return null;
  const profile = getStoredSession()?.profile;

  const row = await insertReturning<DealNoteRow>("deal_notes", {
    deal_id: dealId,
    body: text,
    author_name: profile?.fullName || profile?.email || profile?.username || "Reimagine",
  });
  const note = mapNote(row);
  const existing = dealRecords.find((record) => record.id === dealId);
  if (existing) upsertDealRuntime({ ...existing, notes: [note, ...existing.notes] });
  return note;
}

export async function createBrand(input: BrandMutationInput): Promise<DealBrand> {
  const row = await insertReturning<BrandRow>("brands", brandBody(input));
  const brand = mapBrand(row);
  upsertBrandRuntime(brand);
  return brand;
}

export async function setBrandHidden(id: string, isHidden: boolean): Promise<DealBrand> {
  const row = await patchReturning<BrandRow>("brands", id, { is_hidden: isHidden });
  const brand = mapBrand(row);
  upsertBrandRuntime(brand);
  return brand;
}

export async function removeBrand(id: string): Promise<void> {
  await deleteById("brands", id);
  const removedDealIds = new Set(dealRecords.filter((record) => record.brandId === id).map((record) => record.id));
  dealBrands.splice(0, dealBrands.length, ...dealBrands.filter((brand) => brand.id !== id));
  dealRecords.splice(0, dealRecords.length, ...dealRecords.filter((record) => record.brandId !== id));
  spaceRequirements.splice(0, spaceRequirements.length, ...spaceRequirements.filter((record) => record.brandId !== id));
  replaceMapRuntimeData({
    brands: mapBrands.filter((brand) => brand.id !== id),
    deals: mapDeals.filter((deal) => !removedDealIds.has(deal.id) && deal.brandId !== id),
  });
  rebuildBrandRuntimeData();
  notifyRuntimeDataChanged();
}

export async function createProspect(input: ProspectMutationInput): Promise<BizDevRecord> {
  const row = await insertReturning<ProspectRow>("prospects", prospectBody(input));
  const record = mapProspect(row);
  upsertProspectRuntime(record);
  return record;
}

export async function updateProspect(id: string, input: ProspectMutationInput): Promise<BizDevRecord> {
  const row = await patchReturning<ProspectRow>("prospects", id, prospectBody(input));
  const record = mapProspect(row);
  upsertProspectRuntime(record);
  return record;
}

export async function createDeal(input: DealMutationInput): Promise<DealRecord> {
  const row = await insertReturning<DealRow>("deals", dealBody(input));
  let record = mapDeal(row);
  const documents = await syncDealDocuments(row.id, input.documents);
  record = { ...record, documents };
  const note = await createDealNote(row.id, input.initialNote ?? "");
  if (note) record = { ...record, notes: [note] };
  upsertDealRuntime(record);
  return record;
}

export async function updateDeal(id: string, input: DealMutationInput): Promise<DealRecord> {
  const existing = dealRecords.find((record) => record.id === id);
  const row = await patchReturning<DealRow>("deals", id, dealBody(input));
  let record = mapDeal(row, existing);
  const documents = await syncDealDocuments(row.id, input.documents, existing?.documents);
  record = { ...record, documents };
  const note = await createDealNote(row.id, input.initialNote ?? "");
  if (note) record = { ...record, notes: [note, ...record.notes] };
  upsertDealRuntime(record);
  return record;
}


export async function createTourBook(input: TourBookMutationInput): Promise<void> {
  await insertReturning<{ id: string }>("tour_books", {
    deal_id: input.dealId,
    title: input.title.trim(),
    status: input.status,
    generated_url: blankToNull(input.generatedUrl),
  });
  notifyRuntimeDataChanged();
}

export async function createDealActionItem(input: DealActionMutationInput): Promise<void> {
  const profile = getStoredSession()?.profile;
  if (!profile) throw new Error("Current user profile is required before creating action items.");
  await insertReturning<TakeActionRow>("take_action_items", {
    deal_id: input.dealId,
    audience: input.audience,
    status: "open",
    title: input.title.trim(),
    body: input.body.trim(),
    created_by: profile.id,
  });
  await sendTakeActionNotification({
    recipients: input.recipients,
    actionTypeLabel: input.title,
    message: input.message,
    requestedBy: input.requestedBy,
    contextName: input.contextName,
    contextUrl: input.contextUrl,
    urgency: input.urgency,
  }).catch((error) => {
    console.warn("Take Action email notification failed", error);
    return false;
  });
}

export async function createSpaceRequirement(input: SpaceRequirementMutationInput): Promise<SpaceRequirement> {
  const row = await insertReturning<SpaceRequirementRow>("space_requirements", spaceRequirementBody(input));
  const record = mapSpaceRequirement(row);
  upsertSpaceRequirementRuntime(record);
  return record;
}

export async function updateSpaceRequirement(id: string, input: SpaceRequirementMutationInput): Promise<SpaceRequirement> {
  const row = await patchReturning<SpaceRequirementRow>("space_requirements", id, spaceRequirementBody(input));
  const record = mapSpaceRequirement(row);
  upsertSpaceRequirementRuntime(record);
  return record;
}

export function siteToMutationInput(site: Site): SiteMutationInput {
  return {
    dealId: site.dealId,
    name: site.name,
    address: site.address,
    city: site.city,
    state: site.state,
    zipCode: site.zipCode,
    lat: site.lat,
    lng: site.lng,
    stage: site.stage,
    statusLabel: site.statusLabel,
    notes: site.notes,
    squareFootage: site.squareFootage,
    spaceType: site.spaceType,
    propertyType: site.propertyType,
    landlord: site.landlord,
    landlordContact: site.landlordContact,
    leaseTerm: site.leaseTerm,
    possessionDate: site.possessionDate,
    tourTime: site.tourTime,
    brokerName: site.brokerName,
    brokerPhone: site.brokerPhone,
    photoUrls: site.photoUrls,
    brochureUrl: site.brochureUrl,
    floorPlanUrl: site.floorPlanUrl,
    loiUrl: site.loiUrl,
    leaseUrl: site.leaseUrl,
    baseRent: site.loiTerms.baseRent,
    nnn: site.loiTerms.nnn,
    grossMonthlyRent: site.loiTerms.grossMonthlyRent,
    commencementDate: site.loiTerms.commencementDate,
    tiAllowance: site.loiTerms.tiAllowance,
    loiNotes: site.loiTerms.notes,
  };
}

export async function createSite(input: SiteMutationInput): Promise<Site> {
  const row = await insertReturning<SiteRow>("sites", siteBody(input));
  const record = mapSite(row);
  upsertSiteRuntime(record);
  return record;
}

export async function updateSite(id: string, input: SiteMutationInput): Promise<Site> {
  const row = await patchReturning<SiteRow>("sites", id, siteBody(input));
  const record = mapSite(row);
  upsertSiteRuntime(record);
  return record;
}

export async function createSites(inputs: SiteMutationInput[]): Promise<Site[]> {
  if (inputs.length === 0) return [];
  const rows = await supabaseRequest<SiteRow[]>("/rest/v1/sites", {
    method: "POST",
    body: inputs.map(siteBody),
    accessToken: accessToken(),
    prefer: "return=representation",
  });
  const records = rows.map(mapSite);
  records.forEach(upsertSiteRuntime);
  return records;
}
