#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import XLSX from "xlsx";

const SKIP_SHEETS = new Set(["Home", "Space Requirements", "Biz Dev", "Activity Log", "Quotes"]);
const DOCUMENT_KEYS = new Set([
  "engagementLetter",
  "cobrokerAgreement",
  "flyer",
  "demo",
  "signedLOI",
  "floorPlan",
  "approvalPackage",
  "commissionAgreement",
  "signedLease",
]);

const DEAL_FIELD_ALIASES = {
  brand: ["Brand"],
  rowNumber: ["#"],
  broker: ["Broker", "Lead Broker"],
  associate: ["Associate"],
  dealName: ["Deal"],
  franchisee: ["Franchisee(s)", "Client's Name", "Client Name"],
  cellPhone: ["Cell Phone #", "Cell Phone", "Phone"],
  city: ["City"],
  state: ["State"],
  storesBought: ["Stores Bought"],
  storeCount: ["Store Count #", "Est. Location Count", "Store Count"],
  introCallDate: ["Date of Intro Call", "Date Started", "Date Introduced"],
  leaseSignedDate: ["Date Lease was Executed", "Lease Execution Date", "Date Lease Executed"],
  territoryMapLink: ["Territory Map Link", "Territory Map", "Awarded Territory Map"],
  marketStudyLink: ["Market Study Link", "Market Study"],
  mapLink: ["Map Link", "Map"],
  tourBookLink: ["Tour Book Link", "Tour Book"],
  estimatedCommission: ["Estimated / Confirmed Total Commission", "Estimated Commission", "Confirmed Total Commission"],
  cobroker: ["Co-Broker", "Cobroker"],
  cobrokerPercent: ["Co-Broker %", "Cobroker %"],
  status: ["Status"],
  notes: ["Update Notes", "Notes", "Notes ", "Commission Notes"],
};

const DOCUMENT_KEY_MAP = new Map([
  ["engagement letter", "engagementLetter"],
  ["engagement letters", "engagementLetter"],
  ["letter", "engagementLetter"],
  ["co-broker agreement", "cobrokerAgreement"],
  ["co broker agreement", "cobrokerAgreement"],
  ["cobroker agreement", "cobrokerAgreement"],
  ["flyer", "flyer"],
  ["demo", "demo"],
  ["demo report", "demo"],
  ["signed loi", "signedLOI"],
  ["loi", "signedLOI"],
  ["floor plan", "floorPlan"],
  ["floor plans", "floorPlan"],
  ["approval package", "approvalPackage"],
  ["commission agreement", "commissionAgreement"],
  ["commission agreemnt", "commissionAgreement"],
  ["signed lease", "signedLease"],
  ["lease", "signedLease"],
]);


class SupabaseRest {
  constructor(url, serviceRoleKey) {
    this.url = url;
    this.serviceRoleKey = serviceRoleKey;
  }

  async request(pathname, { method = "GET", query, body, prefer } = {}) {
    const url = new URL(`${this.url}${pathname}`);
    if (query) {
      for (const [key, value] of query.entries()) url.searchParams.set(key, value);
    }
    const response = await fetch(url, {
      method,
      headers: {
        apikey: this.serviceRoleKey,
        authorization: `Bearer ${this.serviceRoleKey}`,
        "content-type": "application/json",
        ...(prefer ? { Prefer: prefer } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    const json = text ? JSON.parse(text) : null;
    if (!response.ok) {
      throw new Error(`${method} ${pathname} failed: ${text}`);
    }
    return json;
  }

  async select(table, select) {
    return this.request(`/rest/v1/${table}`, {
      query: new URLSearchParams({ select }),
    });
  }

  async upsert(table, rows, conflictColumn) {
    if (rows.length === 0) return [];
    const uniqueRows = dedupeRowsByConflictColumn(rows, conflictColumn, table);
    const written = [];
    for (const chunk of chunks(uniqueRows, 500)) {
      const returned = await this.request(`/rest/v1/${table}`, {
        method: "POST",
        query: new URLSearchParams({ on_conflict: conflictColumn }),
        body: chunk,
        prefer: "resolution=merge-duplicates,return=representation",
      });
      written.push(...returned);
      console.log(`  ${table}: ${written.length}/${uniqueRows.length}`);
    }
    return written;
  }

  async upsertOptional(table, rows, conflictColumn) {
    try {
      return await this.upsert(table, rows, conflictColumn);
    } catch (error) {
      console.warn(`  ${table}: skipped (${error.message})`);
      return [];
    }
  }
}


function dedupeRowsByConflictColumn(rows, conflictColumn, table) {
  const byKey = new Map();
  const rowsWithoutConflictValue = [];
  let duplicateCount = 0;

  for (const row of rows) {
    const key = row?.[conflictColumn];
    if (key === null || key === undefined || String(key).trim() === "") {
      rowsWithoutConflictValue.push(row);
      continue;
    }

    const normalizedKey = String(key);
    const existing = byKey.get(normalizedKey);
    if (existing) {
      duplicateCount += 1;
      byKey.set(normalizedKey, mergeRowsPreferNonEmpty(existing, row));
    } else {
      byKey.set(normalizedKey, row);
    }
  }

  if (duplicateCount > 0) {
    console.warn(`  ${table}: removed ${duplicateCount} duplicate ${conflictColumn} row(s) before upsert`);
  }

  return [...byKey.values(), ...rowsWithoutConflictValue];
}

function mergeRowsPreferNonEmpty(base, next) {
  const merged = { ...base };

  for (const [key, value] of Object.entries(next)) {
    if (value !== null && value !== undefined && value !== "") {
      merged[key] = value;
    }
  }

  return merged;
}

const args = parseArgs(process.argv.slice(2));
if (!args.file) {
  fail('Missing --file "./imports/Reimagine CRE _ Real Estate Dashboard.xlsx"');
}
const apply = Boolean(args.apply);
const dryRun = Boolean(args["dry-run"]) || !apply;

loadEnvFile(".env.import");
loadEnvFile(".env");

const SUPABASE_URL = apply ? envRequired("SUPABASE_URL").replace(/\/$/, "") : (process.env.SUPABASE_URL ?? "https://dry-run.supabase.co").replace(/\/$/, "");
const SUPABASE_SERVICE_ROLE_KEY = apply ? envRequired("SUPABASE_SERVICE_ROLE_KEY") : process.env.SUPABASE_SERVICE_ROLE_KEY ?? "dry-run";

const workbookPath = path.resolve(args.file);
if (!fs.existsSync(workbookPath)) fail(`File not found: ${workbookPath}`);

const workbook = XLSX.readFile(workbookPath, {
  cellDates: false,
  cellNF: false,
  cellStyles: false,
  WTF: false,
});

const context = {
  brands: [],
  prospects: [],
  spaceRequirements: [],
  deals: [],
  dealDocuments: [],
  dealNotes: [],
  activityLogs: [],
  warnings: [],
};

const homeBrandMap = parseHomeBrands(workbook);
const bizDevCategoryByCompany = new Map();
context.prospects = parseBizDev(workbook, bizDevCategoryByCompany);
context.spaceRequirements = parseSpaceRequirements(workbook);
const parsedDeals = parseDeals(workbook);
context.deals = parsedDeals.deals;
context.dealDocuments = parsedDeals.documentDrafts;
context.dealNotes = parsedDeals.noteDrafts;
context.activityLogs = parseActivityLogs(workbook);
context.brands = buildBrands(homeBrandMap, context.spaceRequirements, context.deals, bizDevCategoryByCompany);

printSummary(context, dryRun);

if (dryRun) {
  console.log("\nDry run only. No data was written. Re-run with --apply to import.");
  process.exit(0);
}

if (context.brands.length === 0) fail("Import blocked: no brands parsed.");
if (context.deals.length === 0) fail("Import blocked: no deals parsed.");
if (context.prospects.length === 0) fail("Import blocked: no prospects parsed.");

const supabase = new SupabaseRest(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

console.log("\nWriting to Supabase...");
const writtenBrands = await supabase.upsert("brands", context.brands, "source_key");
const brandIdByName = new Map();
for (const brand of writtenBrands) {
  brandIdByName.set(normalizeName(brand.name), brand.id);
}

const missingBrands = new Set();
for (const requirement of context.spaceRequirements) {
  const brandId = brandIdByName.get(normalizeName(requirement.__brandName));
  if (!brandId) missingBrands.add(requirement.__brandName);
  requirement.brand_id = brandId ?? null;
  delete requirement.__brandName;
}
for (const deal of context.deals) {
  const brandId = brandIdByName.get(normalizeName(deal.__brandName));
  if (!brandId) missingBrands.add(deal.__brandName);
  deal.brand_id = brandId ?? null;
  delete deal.__brandName;
}
if (missingBrands.size > 0) fail(`Import blocked: missing brand ids for ${[...missingBrands].join(", ")}`);

await supabase.upsert("prospects", context.prospects, "source_key");
await supabase.upsert("space_requirements", context.spaceRequirements, "source_key");
const writtenDeals = await supabase.upsert("deals", context.deals, "source_key");
const dealIdBySourceKey = new Map(writtenDeals.map((deal) => [deal.source_key, deal.id]));

const documents = context.dealDocuments.flatMap((draft) => {
  const dealId = dealIdBySourceKey.get(draft.__dealSourceKey);
  if (!dealId) return [];
  delete draft.__dealSourceKey;
  return [{ ...draft, deal_id: dealId }];
});
const notes = context.dealNotes.flatMap((draft) => {
  const dealId = dealIdBySourceKey.get(draft.__dealSourceKey);
  if (!dealId) return [];
  delete draft.__dealSourceKey;
  return [{ ...draft, deal_id: dealId }];
});

await supabase.upsert("deal_documents", documents, "source_key");
await supabase.upsert("deal_notes", notes, "source_key");

const prospects = await supabase.select("prospects", "id,company_name");
const prospectIdByCompany = new Map(prospects.map((row) => [normalizeName(row.company_name), row.id]));
const activityLogs = context.activityLogs.map((row) => ({
  ...row,
  prospect_id: prospectIdByCompany.get(normalizeName(row.company_name)) ?? null,
}));
await supabase.upsertOptional("prospect_activity_logs", activityLogs, "source_key");

console.log("\nImport complete.");
console.log(`Brands written: ${writtenBrands.length}`);
console.log(`Prospects parsed: ${context.prospects.length}`);
console.log(`Space requirements parsed: ${context.spaceRequirements.length}`);
console.log(`Deals written: ${writtenDeals.length}`);
console.log(`Documents written: ${documents.length}`);
console.log(`Notes written: ${notes.length}`);
console.log(`Activity logs parsed: ${activityLogs.length}`);

function parseArgs(rawArgs) {
  const parsed = {};
  for (let i = 0; i < rawArgs.length; i += 1) {
    const item = rawArgs[i];
    if (!item.startsWith("--")) continue;
    const key = item.slice(2);
    const next = rawArgs[i + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      i += 1;
    }
  }
  return parsed;
}

function loadEnvFile(filePath) {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) return;
  const content = fs.readFileSync(resolved, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function envRequired(name) {
  const value = process.env[name];
  if (!value) fail(`Missing environment variable ${name}. Add it to .env.import.`);
  return value;
}

function fail(message) {
  console.error(`\n${message}`);
  process.exit(1);
}

function parseHomeBrands(wb) {
  const sheet = requireSheet(wb, "Home");
  const headerRow = findHeaderRow(sheet, ["Brand", "Internal Link", "Franchisor Link"], 2);
  const rows = rowsFromHeader(sheet, headerRow);
  const brands = new Map();

  for (const row of rows) {
    const brandName = cleanText(row.values.Brand);
    if (!brandName || isPlaceholder(brandName)) continue;
    brands.set(normalizeName(brandName), {
      name: brandName,
      internalLink: getLinkOrNull(row.cells["Internal Link"]),
      franchisorLink: getLinkOrNull(row.cells["Franchisor Link"]),
      franchisorMapLink: getLinkOrNull(row.cells["Franchisor Map Link"]),
      sourceSheet: "Home",
      sourceRow: row.excelRow,
    });
  }
  return brands;
}

function parseBizDev(wb, categoryByCompany) {
  const sheet = requireSheet(wb, "Biz Dev");
  const headerRow = findHeaderRow(sheet, ["Status", "Company Name", "Category", "Main Contact"], 3);
  const rows = rowsFromHeader(sheet, headerRow);
  const prospects = [];

  for (const row of rows) {
    const companyName = cleanText(row.values["Company Name"]);
    if (!companyName) continue;
    const category = normalizeBizDevCategory(row.values.Category);
    categoryByCompany.set(normalizeName(companyName), category);

    prospects.push({
      source_key: makeSourceKey(["prospect", "biz-dev", row.excelRow, companyName]),
      source_sheet: "Biz Dev",
      source_row: row.excelRow,
      source_status_label: cleanText(row.values.Status),
      status: normalizeProspectStatus(row.values.Status),
      owner: cleanText(row.values.Owner),
      date_added: excelDateToIsoDate(row.values["Date Added"]),
      company_name: companyName,
      website: getLinkOrText(row.cells.Website),
      brick_and_mortar: cleanText(row.values["Brick and Mortar (Y/N)"]),
      estimated_location_count: parseIntegerOrNull(row.values["Est. Current Location Count"]),
      category,
      sub_category: cleanText(row.values["Sub-Category"]),
      is_franchise: String(row.values["Franchise or Corporate"] ?? "").toLowerCase().includes("franchise"),
      franchise_or_corporate: cleanText(row.values["Franchise or Corporate"]),
      reach_out_method: cleanText(row.values["Reach Out Method"]),
      main_contact: cleanText(row.values["Main Contact"]),
      cell: cleanText(row.values["Cell Phone #"]),
      office_phone: cleanText(row.values["Office Phone #"]),
      linkedin: getLinkOrText(row.cells.LinkedIn),
      main_contact_position: cleanText(row.values["Main Contact Position"]),
      main_contact_email: cleanText(row.values["Main Contact Email"]),
      secondary_contact: cleanText(row.values["Secondary Contact"]),
      secondary_position: cleanText(row.values["Secondary Position"]),
      secondary_email: cleanText(row.values["Secondary Email"]),
      secondary_cell: cleanText(row.values["Secondary Cell #"]),
      secondary_office: cleanText(row.values["Secondary Office #"]),
      secondary_linkedin: getLinkOrText(row.cells["Secondary LinkedIn"]),
      lead_source: cleanText(row.values["Lead Source"]),
      reach_out_1: excelDateToIsoDate(row.values["1st Reach Out"]),
      reach_out_2: excelDateToIsoDate(row.values["2nd Reach Out"]),
      reach_out_3: excelDateToIsoDate(row.values["3rd Reach Out"]),
      reach_out_4: excelDateToIsoDate(row.values["4th Reach Out"]),
      reach_out_5: excelDateToIsoDate(row.values["5th Reach Out"]),
      final_reach_out: excelDateToIsoDate(row.values["Final Reach Out"]),
      last_reach_out_date: excelDateToIsoDate(row.values["Last Reach Out Date"]),
      next_follow_up_date: excelDateToIsoDate(row.values["Next Follow Up Date"]),
      overdue: cleanText(row.values.Overdue),
      update_notes: cleanText(row.values["Update Notes"]),
    });
  }
  return prospects;
}

function parseSpaceRequirements(wb) {
  const sheet = requireSheet(wb, "Space Requirements");
  const headerRow = findHeaderRow(sheet, ["Brand", "Space Type", "Min Size (SF)", "Max Size (SF)"], 3);
  const rows = rowsFromHeader(sheet, headerRow);
  const requirements = [];

  for (const row of rows) {
    const brandName = cleanText(row.values.Brand);
    if (!brandName) continue;
    const spaceType = cleanText(row.values["Space Type"]) ?? "Retail";
    requirements.push({
      __brandName: brandName,
      source_key: makeSourceKey(["space_requirement", brandName, spaceType]),
      source_sheet: "Space Requirements",
      source_row: row.excelRow,
      brand_id: null,
      brand_name: brandName,
      landlord_deck_link: getLinkOrText(row.cells["Landlord Deck Link"]),
      loi_template_link: getLinkOrText(row.cells["LOI Template Link"]),
      space_type: spaceType,
      min_sf: parseSizeToSquareFeet(row.values["Min Size (SF)"]),
      max_sf: parseSizeToSquareFeet(row.values["Max Size (SF)"]),
      ideal_sf: parseSizeToSquareFeet(row.values["Ideal Size (SF)"]),
      min_sf_raw: cleanText(row.values["Min Size (SF)"]),
      max_sf_raw: cleanText(row.values["Max Size (SF)"]),
      ideal_sf_raw: cleanText(row.values["Ideal Size (SF)"]),
      min_storefront_width: cleanText(row.values["Min Storefront Width"]) ?? "N/A",
      power: cleanText(row.values.Power) ?? "N/A",
      hvac: cleanText(row.values.HVAC) ?? "N/A",
      gas: normalizeGas(row.values.Gas),
      water_line_size: cleanText(row.values["Water Line Size"]) ?? "N/A",
      sewer_line_size: cleanText(row.values["Sewer Line Size"]) ?? "N/A",
      slab: cleanText(row.values.Slab) ?? "N/A",
      grease_trap: normalizeGreaseTrap(row.values["Grease Trap"]),
      second_floor: normalizeSecondFloor(row.values["2nd Floor Space"]),
      parking: cleanText(row.values.Parking) ?? "N/A",
      other_special_requirements: cleanText(row.values["Other Special Requirements"]),
    });
  }
  return requirements;
}

function parseDeals(wb) {
  const deals = [];
  const documentDrafts = [];
  const noteDrafts = [];

  for (const sheetName of wb.SheetNames) {
    if (SKIP_SHEETS.has(sheetName)) continue;
    const sheet = wb.Sheets[sheetName];
    let headerRow;
    try {
      headerRow = findHeaderRow(sheet, ["Deal", "City", "State"], 2);
    } catch {
      continue;
    }
    const rows = rowsFromHeader(sheet, headerRow);

    for (const row of rows) {
      const dealName = cleanText(getByAliases(row.values, DEAL_FIELD_ALIASES.dealName));
      const city = cleanText(getByAliases(row.values, DEAL_FIELD_ALIASES.city));
      const state = cleanText(getByAliases(row.values, DEAL_FIELD_ALIASES.state));
      if (!dealName && !city && !state) continue;

      const brandName = sheetName === "One-Off Deals"
        ? cleanText(getByAliases(row.values, DEAL_FIELD_ALIASES.brand)) ?? "One-Off"
        : sheetName;
      const dealSourceKey = makeSourceKey(["deal", sheetName, row.excelRow, dealName || `${city}-${state}`]);
      const sourceStatusLabel = cleanText(getByAliases(row.values, DEAL_FIELD_ALIASES.status));

      deals.push({
        __brandName: brandName,
        source_key: dealSourceKey,
        source_sheet: sheetName,
        source_row: row.excelRow,
        source_status_label: sourceStatusLabel,
        brand_id: null,
        name: dealName,
        franchisee: cleanText(getByAliases(row.values, DEAL_FIELD_ALIASES.franchisee)) ?? dealName ?? "N/A",
        broker: cleanText(getByAliases(row.values, DEAL_FIELD_ALIASES.broker)) ?? "N/A",
        associate: cleanText(getByAliases(row.values, DEAL_FIELD_ALIASES.associate)),
        cell_phone: cleanText(getByAliases(row.values, DEAL_FIELD_ALIASES.cellPhone)),
        city: city ?? "Unknown",
        state: state ?? "NA",
        stage: normalizeDealStage(sourceStatusLabel),
        store_count: parseIntegerOrDefault(getByAliases(row.values, DEAL_FIELD_ALIASES.storeCount), 1),
        stores_bought: parseIntegerOrDefault(getByAliases(row.values, DEAL_FIELD_ALIASES.storesBought), 0),
        estimated_commission: parseMoney(getByAliases(row.values, DEAL_FIELD_ALIASES.estimatedCommission)),
        intro_call_date: excelDateToIsoDate(getByAliases(row.values, DEAL_FIELD_ALIASES.introCallDate)),
        lease_signed_date: excelDateToIsoDate(getByAliases(row.values, DEAL_FIELD_ALIASES.leaseSignedDate)),
        territory_map_link: getLinkOrText(getCellByAliases(row.cells, DEAL_FIELD_ALIASES.territoryMapLink)),
        market_study_link: getLinkOrText(getCellByAliases(row.cells, DEAL_FIELD_ALIASES.marketStudyLink)),
        map_link: getLinkOrText(getCellByAliases(row.cells, DEAL_FIELD_ALIASES.mapLink)),
        tour_book_link: getLinkOrText(getCellByAliases(row.cells, DEAL_FIELD_ALIASES.tourBookLink)),
        cobroker: cleanText(getByAliases(row.values, DEAL_FIELD_ALIASES.cobroker)),
        cobroker_percent: cleanText(getByAliases(row.values, DEAL_FIELD_ALIASES.cobrokerPercent)),
        is_one_off: sheetName === "One-Off Deals",
        corporate: false,
        corporate_comments: "",
      });

      const noteBody = DEAL_FIELD_ALIASES.notes
        .map((alias) => cleanText(row.values[alias]))
        .filter(Boolean)
        .join("\n\n");
      if (noteBody) {
        noteDrafts.push({
          __dealSourceKey: dealSourceKey,
          source_key: makeSourceKey(["deal_note", sheetName, row.excelRow]),
          source_sheet: sheetName,
          source_row: row.excelRow,
          author_name: "Imported from Excel",
          body: noteBody,
        });
      }

      for (const [header, cell] of Object.entries(row.cells)) {
        const documentKey = documentKeyForHeader(header) ?? documentKeyForHeader(cleanText(cell?.v));
        if (!documentKey) continue;
        const url = getHyperlink(cell) ?? urlLike(cleanText(cell?.v));
        if (!url) continue;
        documentDrafts.push({
          __dealSourceKey: dealSourceKey,
          source_key: makeSourceKey(["document", sheetName, row.excelRow, documentKey]),
          source_sheet: sheetName,
          source_row: row.excelRow,
          source_label: cleanText(cell?.v),
          document_key: documentKey,
          file_path: url,
        });
      }
    }
  }

  return { deals, documentDrafts, noteDrafts };
}

function parseActivityLogs(wb) {
  const sheet = wb.Sheets["Activity Log"];
  if (!sheet) return [];
  const headerRow = findHeaderRow(sheet, ["Timestamp", "Company", "Owner", "Method"], 3);
  const rows = rowsFromHeader(sheet, headerRow);
  return rows.flatMap((row) => {
    const companyName = cleanText(row.values.Company);
    if (!companyName) return [];
    return [{
      source_key: makeSourceKey(["activity_log", row.excelRow, companyName]),
      source_sheet: "Activity Log",
      source_row: row.excelRow,
      company_name: companyName,
      owner: cleanText(row.values.Owner),
      method: cleanText(row.values.Method),
      notes: cleanText(row.values.Notes),
      occurred_at: excelDateToIsoDateTime(row.values.Timestamp),
      next_follow_up: excelDateToIsoDate(row.values["Next Follow Up"]),
    }];
  });
}

function buildBrands(homeBrandMap, spaceRequirements, deals, categoryByCompany) {
  const brands = new Map(homeBrandMap);
  for (const requirement of spaceRequirements) {
    if (!brands.has(normalizeName(requirement.__brandName))) {
      brands.set(normalizeName(requirement.__brandName), { name: requirement.__brandName, sourceSheet: requirement.source_sheet, sourceRow: requirement.source_row });
    }
  }
  for (const deal of deals) {
    if (!brands.has(normalizeName(deal.__brandName))) {
      brands.set(normalizeName(deal.__brandName), { name: deal.__brandName, sourceSheet: deal.source_sheet, sourceRow: deal.source_row });
    }
  }

  return [...brands.values()].map((brand) => {
    const category = categoryByCompany.get(normalizeName(brand.name)) ?? "Service";
    return {
      source_key: makeSourceKey(["brand", brand.name]),
      source_sheet: brand.sourceSheet ?? "import",
      source_row: brand.sourceRow ?? null,
      name: brand.name,
      category,
      logo_color: "#E18739",
      corporate_link: brand.franchisorLink ?? "#",
      internal_link: brand.internalLink ?? null,
      franchisor_link: brand.franchisorLink ?? null,
      franchisor_map_link: brand.franchisorMapLink ?? null,
    };
  });
}

function requireSheet(wb, name) {
  const sheet = wb.Sheets[name];
  if (!sheet) fail(`Missing required sheet: ${name}`);
  return sheet;
}

function findHeaderRow(sheet, expectedLabels, minHits) {
  const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1:A1");
  for (let r = range.s.r; r <= range.e.r; r += 1) {
    const values = [];
    for (let c = range.s.c; c <= range.e.c; c += 1) {
      const address = XLSX.utils.encode_cell({ r, c });
      const value = cleanText(sheet[address]?.v);
      if (value) values.push(value.toLowerCase());
    }
    const hits = expectedLabels.filter((label) => values.includes(label.toLowerCase())).length;
    if (hits >= minHits) return r;
  }
  throw new Error(`Could not find header row. Expected ${expectedLabels.join(", ")}`);
}

function rowsFromHeader(sheet, headerRow) {
  const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1:A1");
  const headers = [];
  for (let c = range.s.c; c <= range.e.c; c += 1) {
    const address = XLSX.utils.encode_cell({ r: headerRow, c });
    const header = cleanText(sheet[address]?.v);
    headers.push(header || `__col_${c}`);
  }

  const rows = [];
  for (let r = headerRow + 1; r <= range.e.r; r += 1) {
    const values = {};
    const cells = {};
    let hasAnyValue = false;
    for (let c = range.s.c; c <= range.e.c; c += 1) {
      const header = headers[c - range.s.c];
      const address = XLSX.utils.encode_cell({ r, c });
      const cell = sheet[address];
      const value = cell?.v ?? null;
      if (cleanText(value)) hasAnyValue = true;
      if (header) {
        values[header] = value;
        cells[header] = cell;
      }
    }
    if (hasAnyValue) rows.push({ values, cells, excelRow: r + 1 });
  }
  return rows;
}

function getByAliases(values, aliases) {
  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(values, alias)) return values[alias];
  }
  return null;
}

function getCellByAliases(cells, aliases) {
  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(cells, alias)) return cells[alias];
  }
  return undefined;
}

function cleanText(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).replace(/\s+/g, " ").trim();
  if (!text) return null;
  if (["n/a", "na", "null", "undefined", "-"].includes(text.toLowerCase())) return null;
  return text;
}

function getHyperlink(cell) {
  const target = cell?.l?.Target;
  return target ? String(target).trim() : null;
}

function getLinkOrNull(cell) {
  const link = getHyperlink(cell);
  if (link) return link;
  const text = cleanText(cell?.v);
  return urlLike(text);
}

function getLinkOrText(cell) {
  const link = getHyperlink(cell);
  if (link) return link;
  const text = cleanText(cell?.v);
  if (!text) return null;
  if (isPlaceholder(text)) return null;
  return text;
}

function urlLike(value) {
  if (!value) return null;
  const text = String(value).trim();
  return /^https?:\/\//i.test(text) ? text : null;
}

function isPlaceholder(value) {
  const text = String(value ?? "").trim().toLowerCase();
  return ["link", "map", "letter", "flyer", "demo", "tour book", "signed lease"].includes(text);
}

function normalizeName(value) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function slug(value) {
  return normalizeName(value).replace(/\s+/g, "-");
}

function makeSourceKey(parts) {
  return parts.filter((part) => part !== null && part !== undefined && String(part).trim() !== "").map(slug).join(":");
}

function normalizeBizDevCategory(value) {
  const text = cleanText(value) ?? "Service";
  const normalized = text.toLowerCase();
  if (normalized.includes("pet")) return "Pet Related";
  if (normalized.includes("beauty") || normalized.includes("salon") || normalized.includes("spa")) return "Beauty";
  if (normalized.includes("fitness")) return "Fitness";
  if (normalized.includes("health") || normalized.includes("wellness") || normalized.includes("medical")) return "Health & Wellness";
  if (normalized.includes("restaurant") || normalized.includes("food") || normalized.includes("coffee") || normalized.includes("f&b")) return "F&B";
  if (normalized.includes("entertainment") || normalized.includes("golf") || normalized.includes("pickleball")) return "Entertainment";
  if (normalized.includes("auto")) return "Automotive";
  if (normalized.includes("education") || normalized.includes("school")) return "Education";
  if (normalized.includes("retail") || normalized.includes("apparel") || normalized.includes("goods")) return "Soft Goods";
  return "Service";
}

function normalizeProspectStatus(value) {
  const text = String(value ?? "").toLowerCase().trim();
  if (text.includes("active client") && !text.includes("in-active")) return "active_client";
  if (text.includes("in-active client") || text.includes("inactive client")) return "inactive_client";
  if (text.includes("dead") || text.includes("disqualified")) return "dead";
  return "prospect";
}

function normalizeDealStage(value) {
  const text = String(value ?? "").toLowerCase().trim();
  if (!text) return "Kick Off";
  if (text.includes("signed") || text === "open" || text.includes("7-signed")) return "Signed";
  if (text.includes("lease")) return "Lease Negotiations";
  if (text.includes("loi negotiation")) return "LOI Negotiations";
  if (text === "loi" || text.includes("first loi")) return "LOI Negotiations";
  if (text.includes("market")) return "Market Study";
  if (text.includes("property tour") || text.includes("site tour") || text.includes("tour")) return "Site Tours";
  if (text.includes("hold") || text.includes("dead") || text.includes("cancel") || text.includes("inactive")) return "On Hold";
  if (text.includes("intro") || text.includes("sales call") || text.includes("kick")) return "Kick Off";
  return "Kick Off";
}

function parseSizeToSquareFeet(value) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  const raw = String(value).trim().toLowerCase().replace(/,/g, "");
  if (!raw || raw === "n/a" || raw === "na" || raw === "-") return 0;
  const hasAcres = raw.includes("ac") || raw.includes("acre");
  const numbers = [...raw.matchAll(/\d+(\.\d+)?/g)].map((match) => Number(match[0]));
  if (numbers.length === 0) return 0;
  const result = numbers.length >= 2 ? (numbers[0] + numbers[1]) / 2 : numbers[0];
  return Math.round(hasAcres ? result * 43560 : result);
}

function normalizeGas(value) {
  const text = String(value ?? "").toLowerCase().trim();
  if (!text || text === "n/a" || text === "na" || text === "-") return "No";
  if (text.includes("preferred")) return "Preferred";
  if (text === "yes" || text === "y" || text.includes("required")) return "Yes";
  return "No";
}

function normalizeGreaseTrap(value) {
  const text = String(value ?? "").toLowerCase().trim();
  if (!text || text === "n/a" || text === "na" || text === "-") return "No";
  return text === "yes" || text === "y" || text.includes("required") ? "Yes" : "No";
}

function normalizeSecondFloor(value) {
  const text = String(value ?? "").toLowerCase().trim();
  if (!text || text === "n/a" || text === "na" || text === "-" || text === "no") return "Not Allowed";
  if (text.includes("maybe") || text.includes("preferred")) return "Maybe";
  if (text.includes("not")) return "Not Allowed";
  if (text.includes("allowed") || text === "yes" || text === "y") return "Allowed";
  return "Not Allowed";
}

function parseIntegerOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  const text = String(value).replace(/,/g, "").trim();
  const match = text.match(/\d+/);
  return match ? Number(match[0]) : null;
}

function parseIntegerOrDefault(value, fallback) {
  const parsed = parseIntegerOrNull(value);
  return parsed ?? fallback;
}

function parseMoney(value) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number" && Number.isFinite(value)) return Number(value.toFixed(2));
  const text = String(value).replace(/,/g, "").replace(/\$/g, "").trim();
  if (!text || text.toLowerCase() === "n/a") return 0;
  const match = text.match(/-?\d+(\.\d+)?/);
  return match ? Number(Number(match[0]).toFixed(2)) : 0;
}

function excelDateToIsoDate(value) {
  const date = excelDate(value);
  return date ? date.toISOString().slice(0, 10) : null;
}

function excelDateToIsoDateTime(value) {
  const date = excelDate(value);
  return date ? date.toISOString() : null;
}

function excelDate(value) {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = Math.round((value - 25569) * 86400 * 1000);
    return new Date(ms);
  }
  const text = cleanText(value);
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function documentKeyForHeader(header) {
  const normalized = normalizeName(header);
  if (!normalized) return null;
  const direct = DOCUMENT_KEY_MAP.get(normalized);
  if (direct && DOCUMENT_KEYS.has(direct)) return direct;
  for (const [label, key] of DOCUMENT_KEY_MAP.entries()) {
    if (normalized.includes(label) && DOCUMENT_KEYS.has(key)) return key;
  }
  return null;
}

function printSummary(data, isDryRun) {
  console.log(isDryRun ? "Reimagine import dry run" : "Reimagine import apply");
  console.log(`Workbook: ${workbookPath}`);
  console.log(`Brands parsed: ${data.brands.length}`);
  console.log(`Prospects parsed: ${data.prospects.length}`);
  console.log(`Space requirements parsed: ${data.spaceRequirements.length}`);
  console.log(`Deals parsed: ${data.deals.length}`);
  console.log(`Documents with real URL parsed: ${data.dealDocuments.length}`);
  console.log(`Deal notes parsed: ${data.dealNotes.length}`);
  console.log(`Activity logs parsed: ${data.activityLogs.length}`);
}


function chunks(items, size) {
  const output = [];
  for (let i = 0; i < items.length; i += size) output.push(items.slice(i, i + size));
  return output;
}
