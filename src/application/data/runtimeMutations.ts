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
  type DealBrand,
  type DealDocuments,
  type DealNote,
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
import type { TakeActionAudience, TakeActionStatus } from "@/domain/entities";
import { supabaseRequest, type JsonObject } from "@/infrastructure/supabase/client";

type BrandRow = {
  id: string;
  name: string;
  category: string;
  logo_color: string | null;
  corporate_link: string | null;
};

type ProspectStatusRow = "active_client" | "inactive_client" | "prospect" | "dead";

type ProspectRow = {
  id: string;
  company_name: string;
  category: string;
  sub_category: string | null;
  status: ProspectStatusRow;
  owner: string | null;
  website: string | null;
  is_franchise: boolean | null;
  reach_out_method: string | null;
  main_contact: string | null;
  cell: string | null;
  main_contact_position: string | null;
  main_contact_email: string | null;
  reach_out_1: string | null;
  reach_out_2: string | null;
  reach_out_3: string | null;
  reach_out_4: string | null;
  created_at: string;
};

type DealRow = {
  id: string;
  brand_id: string;
  franchisee: string;
  broker: string;
  associate: string | null;
  cell_phone: string | null;
  city: string;
  state: string;
  stage: DealStatusNew;
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

export type BrandMutationInput = {
  name: string;
  category: string;
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
};

export type SpaceRequirementMutationInput = Omit<SpaceRequirement, "id">;

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
    category: row.category,
    logoColor: row.logo_color ?? "#E18739",
    corporateLink: row.corporate_link ?? "#",
  };
}

function upsertBrandRuntime(brand: DealBrand): void {
  const next = [brand, ...dealBrands.filter((current) => current.id !== brand.id)];
  dealBrands.splice(0, dealBrands.length, ...next);
  rebuildBrandRuntimeData();
}

function mapProspect(row: ProspectRow): BizDevRecord {
  return {
    id: row.id,
    status: prospectStatusFromDb[row.status],
    owner: row.owner ?? "",
    dateAdded: dateOnly(row.created_at) ?? "",
    companyName: row.company_name,
    website: row.website ?? "",
    category: row.category as BizDevCategory,
    subCategory: row.sub_category ?? "",
    isFranchise: row.is_franchise ?? true,
    reachOutMethod: row.reach_out_method ?? "",
    mainContact: row.main_contact ?? "",
    cell: row.cell ?? "",
    mainContactPosition: row.main_contact_position ?? "",
    mainContactEmail: row.main_contact_email ?? "",
    reachOut1: dateOnly(row.reach_out_1) ?? "",
    reachOut2: dateOnly(row.reach_out_2) ?? "",
    reachOut3: dateOnly(row.reach_out_3) ?? "",
    reachOut4: dateOnly(row.reach_out_4) ?? "",
  };
}

function upsertProspectRuntime(record: BizDevRecord): void {
  const exists = bizDevRecords.some((current) => current.id === record.id);
  const next = exists
    ? bizDevRecords.map((current) => (current.id === record.id ? record : current))
    : [record, ...bizDevRecords];
  replaceBizDevRuntimeData(next);
}

function mapDeal(row: DealRow, existing?: DealRecord): DealRecord {
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

function upsertDealRuntime(record: DealRecord): void {
  const exists = dealRecords.some((current) => current.id === record.id);
  const next = exists
    ? dealRecords.map((current) => (current.id === record.id ? record : current))
    : [record, ...dealRecords];
  dealRecords.splice(0, dealRecords.length, ...next);
  rebuildBrandRuntimeData();
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

function upsertSpaceRequirementRuntime(record: SpaceRequirement): void {
  const exists = spaceRequirements.some((current) => current.id === record.id);
  const next = exists
    ? spaceRequirements.map((current) => (current.id === record.id ? record : current))
    : [...spaceRequirements, record];
  replaceSpaceRequirementsRuntimeData(next);
}

function brandBody(input: BrandMutationInput): JsonObject {
  const link = input.franchisorLink ?? input.corporateLink ?? "";
  return {
    name: input.name.trim(),
    category: input.category.trim() || "Uncategorized",
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
    stage: input.status,
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

async function createDealNote(dealId: string, body: string): Promise<DealNote | null> {
  const text = body.trim();
  if (!text) return null;

  const row = await insertReturning<DealNoteRow>("deal_notes", {
    deal_id: dealId,
    body: text,
    author_name: "Reimagine",
  });
  return mapNote(row);
}

export async function createBrand(input: BrandMutationInput): Promise<DealBrand> {
  const row = await insertReturning<BrandRow>("brands", brandBody(input));
  const brand = mapBrand(row);
  upsertBrandRuntime(brand);
  return brand;
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

export async function createDealActionItem(input: DealActionMutationInput): Promise<void> {
  await insertReturning<TakeActionRow>("take_action_items", {
    deal_id: input.dealId,
    audience: input.audience,
    status: "open",
    title: input.title.trim(),
    body: input.body.trim(),
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
