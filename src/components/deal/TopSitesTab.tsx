import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, BookOpen, Building2, FileSpreadsheet, FileText, Plus, Route, Upload } from "lucide-react";
import { toast } from "sonner";
import type { DealRecord } from "@/data/dealsData";
import { getSitesByDeal, type DealStage, type Site } from "@/data/mapRuntimeData";
import { createSite, createSites, siteToMutationInput, updateSite, type SiteMutationInput } from "@/application/data/runtimeMutations";
import { useRuntimeDataVersion } from "@/application/data/runtimeStore";
import { PropertyTab } from "./PropertyTab";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { buildAddressQuery, geocodeAddress } from "@/lib/geocoding";

const SITE_STAGES: DealStage[] = ["Prospecting", "LOI", "Lease", "Open", "Closed"];

const STATUS_COLORS: Record<DealStage, { bg: string; border: string; text: string; dot: string }> = {
  Prospecting: { bg: "rgba(30,96,145,0.08)", border: "rgba(30,96,145,0.22)", text: "#1e6091", dot: "#1e6091" },
  LOI: { bg: "rgba(91,33,182,0.08)", border: "rgba(91,33,182,0.22)", text: "#5b21b6", dot: "#5b21b6" },
  Lease: { bg: "rgba(217,119,6,0.08)", border: "rgba(217,119,6,0.22)", text: "#92400e", dot: "#d97706" },
  Open: { bg: "rgba(5,150,105,0.08)", border: "rgba(5,150,105,0.22)", text: "#065f46", dot: "#065f46" },
  Closed: { bg: "rgba(153,27,27,0.08)", border: "rgba(153,27,27,0.22)", text: "#991b1b", dot: "#991b1b" },
};

function blankSiteInput(deal: DealRecord): SiteMutationInput {
  return {
    dealId: deal.id,
    name: "",
    address: "",
    city: deal.city,
    state: deal.state,
    zipCode: "",
    lat: 0,
    lng: 0,
    stage: "Prospecting",
    statusLabel: "Prospecting",
    notes: "",
    squareFootage: "",
    spaceType: "",
    propertyType: "",
    landlord: "",
    landlordContact: "",
    leaseTerm: "",
    possessionDate: "",
    tourTime: "",
    brokerName: "",
    brokerPhone: "",
    photoUrls: [],
    brochureUrl: "",
    floorPlanUrl: "",
    loiUrl: "",
    leaseUrl: "",
    baseRent: "",
    nnn: "",
    grossMonthlyRent: "",
    commencementDate: "",
    tiAllowance: "",
    loiNotes: "",
  };
}

function parseCsvRows(csv: string, deal: DealRecord): SiteMutationInput[] {
  const lines = csv.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((header) => header.trim().toLowerCase());
  const rows = lines.slice(1);

  return rows.map((line) => {
    const values = line.split(",").map((value) => value.trim());
    const get = (name: string) => values[headers.indexOf(name)] ?? "";
    const stageCandidate = get("stage") as DealStage;
    return {
      ...blankSiteInput(deal),
      name: get("property_name") || get("name") || get("property"),
      address: get("address"),
      city: get("city") || deal.city,
      state: get("state") || deal.state,
      zipCode: get("zip") || get("zip_code"),
      lat: Number(get("lat")) || 0,
      lng: Number(get("lng")) || Number(get("lon")) || 0,
      stage: SITE_STAGES.includes(stageCandidate) ? stageCandidate : "Prospecting",
      statusLabel: get("status") || get("stage") || "Prospecting",
      notes: get("notes"),
      squareFootage: get("square_footage") || get("sf"),
      spaceType: get("space_type"),
      propertyType: get("property_type"),
      landlord: get("landlord"),
      landlordContact: get("landlord_contact"),
    };
  }).filter((row) => row.address);
}

async function withResolvedCoordinates(input: SiteMutationInput): Promise<SiteMutationInput> {
  if (Number.isFinite(input.lat) && Number.isFinite(input.lng) && input.lat !== 0 && input.lng !== 0) return input;
  const result = await geocodeAddress(buildAddressQuery([input.address, input.city, input.state, input.zipCode]));
  return result ? { ...input, lat: result.lat, lng: result.lng } : input;
}

async function resolveCoordinatesForRows(inputs: SiteMutationInput[]): Promise<SiteMutationInput[]> {
  const rows: SiteMutationInput[] = [];
  for (const input of inputs) {
    rows.push(await withResolvedCoordinates(input));
  }
  return rows;
}

function SiteForm({ deal, site, onClose }: { deal: DealRecord; site: Site | null; onClose: () => void }) {
  const [form, setForm] = useState<SiteMutationInput>(() => (site ? siteToMutationInput(site) : blankSiteInput(deal)));
  const [saving, setSaving] = useState(false);
  const update = <K extends keyof SiteMutationInput>(key: K, value: SiteMutationInput[K]) => setForm((current) => ({ ...current, [key]: value }));

  const save = async () => {
    if (!form.address.trim()) {
      toast.error("Address is required.");
      return;
    }
    if (!form.city.trim() || !form.state.trim()) {
      toast.error("City and state are required.");
      return;
    }
    setSaving(true);
    try {
      const payload = await withResolvedCoordinates(form);
      if (site) {
        await updateSite(site.id, payload);
        toast.success("Site updated");
      } else {
        await createSite(payload);
        toast.success("Site created");
      }
      onClose();
    } catch (error) {
      toast.error("Unable to save site", { description: error instanceof Error ? error.message : "Check Supabase permissions." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SheetContent className="themed-scrollbar w-full sm:max-w-xl overflow-y-auto" style={{ background: "var(--bg-surface)", color: "var(--text-primary)" }}>
      <SheetHeader>
        <SheetTitle>{site ? "Edit Site" : "Add Site"}</SheetTitle>
        <SheetDescription>Save property information directly to Supabase.</SheetDescription>
      </SheetHeader>
      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Property Name"><Input value={form.name} onChange={(e) => update("name", e.target.value)} /></Field>
        <Field label="Stage"><Select value={form.stage} onValueChange={(value) => update("stage", value as DealStage)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{SITE_STAGES.map((stage) => <SelectItem key={stage} value={stage}>{stage}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Address"><Input value={form.address} onChange={(e) => update("address", e.target.value)} /></Field>
        <Field label="Zip Code"><Input value={form.zipCode} onChange={(e) => update("zipCode", e.target.value)} /></Field>
        <Field label="City"><Input value={form.city} onChange={(e) => update("city", e.target.value)} /></Field>
        <Field label="State"><Input value={form.state} onChange={(e) => update("state", e.target.value)} /></Field>
        <Field label="Latitude"><Input type="number" value={form.lat} onChange={(e) => update("lat", Number(e.target.value))} /></Field>
        <Field label="Longitude"><Input type="number" value={form.lng} onChange={(e) => update("lng", Number(e.target.value))} /></Field>
        <Field label="Square Footage"><Input value={form.squareFootage} onChange={(e) => update("squareFootage", e.target.value)} /></Field>
        <Field label="Space Type"><Input value={form.spaceType} onChange={(e) => update("spaceType", e.target.value)} /></Field>
        <Field label="Property Type"><Input value={form.propertyType} onChange={(e) => update("propertyType", e.target.value)} /></Field>
        <Field label="Landlord"><Input value={form.landlord} onChange={(e) => update("landlord", e.target.value)} /></Field>
        <Field label="Landlord Contact"><Input value={form.landlordContact} onChange={(e) => update("landlordContact", e.target.value)} /></Field>
        <Field label="Lease Term"><Input value={form.leaseTerm} onChange={(e) => update("leaseTerm", e.target.value)} /></Field>
        <Field label="Possession Date"><Input type="date" value={form.possessionDate} onChange={(e) => update("possessionDate", e.target.value)} /></Field>
        <Field label="Tour Time"><Input value={form.tourTime} onChange={(e) => update("tourTime", e.target.value)} /></Field>
        <Field label="Broker Name"><Input value={form.brokerName} onChange={(e) => update("brokerName", e.target.value)} /></Field>
        <Field label="Broker Phone"><Input value={form.brokerPhone} onChange={(e) => update("brokerPhone", e.target.value)} /></Field>
        <Field label="Photo URLs" wide><Textarea value={form.photoUrls.join("\n")} onChange={(e) => update("photoUrls", e.target.value.split(/\r?\n/).map((url) => url.trim()).filter(Boolean))} placeholder="One image URL per line" /></Field>
        <Field label="Brochure URL"><Input value={form.brochureUrl} onChange={(e) => update("brochureUrl", e.target.value)} /></Field>
        <Field label="Floor Plan URL"><Input value={form.floorPlanUrl} onChange={(e) => update("floorPlanUrl", e.target.value)} /></Field>
        <Field label="LOI URL"><Input value={form.loiUrl} onChange={(e) => update("loiUrl", e.target.value)} /></Field>
        <Field label="Lease URL"><Input value={form.leaseUrl} onChange={(e) => update("leaseUrl", e.target.value)} /></Field>
        <Field label="Notes" wide><Textarea value={form.notes} onChange={(e) => update("notes", e.target.value)} /></Field>
      </div>
      <button onClick={save} disabled={saving} className="cta-primary w-full mt-6 disabled:opacity-60">{saving ? "Saving..." : site ? "Save Site" : "Create Site"}</button>
    </SheetContent>
  );
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={`flex flex-col gap-1.5 ${wide ? "sm:col-span-2" : ""}`}>
      <Label className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>{label}</Label>
      {children}
    </div>
  );
}

function ImportSitesDialog({ deal, open, onOpenChange }: { deal: DealRecord; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [csv, setCsv] = useState("property_name,address,city,state,zip,lat,lng,stage,square_footage,space_type,property_type,landlord,notes\n");
  const [saving, setSaving] = useState(false);
  const rows = useMemo(() => parseCsvRows(csv, deal), [csv, deal]);

  const importRows = async () => {
    if (rows.length === 0) {
      toast.error("Paste at least one CSV row with an address.");
      return;
    }
    setSaving(true);
    try {
      await createSites(await resolveCoordinatesForRows(rows));
      toast.success(`${rows.length} site${rows.length === 1 ? "" : "s"} imported`);
      onOpenChange(false);
    } catch (error) {
      toast.error("Unable to import sites", { description: error instanceof Error ? error.message : "Check Supabase permissions." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import Sites from CSV</DialogTitle>
          <DialogDescription>Paste CSV data. Rows are saved into the Supabase `sites` table for this deal.</DialogDescription>
        </DialogHeader>
        <Textarea value={csv} onChange={(e) => setCsv(e.target.value)} className="min-h-[240px] font-mono text-xs" />
        <div className="flex items-center justify-between">
          <span className="text-sm" style={{ color: "var(--text-muted)" }}>{rows.length} valid row{rows.length === 1 ? "" : "s"} detected</span>
          <button onClick={importRows} disabled={saving} className="cta-primary disabled:opacity-60">{saving ? "Importing..." : "Import Sites"}</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function TopSitesTab({ deal }: { deal: DealRecord }) {
  const navigate = useNavigate();
  const runtimeVersion = useRuntimeDataVersion();
  const [viewingSiteId, setViewingSiteId] = useState<string | null>(null);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const sites = useMemo(() => {
    void runtimeVersion;
    return getSitesByDeal(deal.id);
  }, [deal.id, runtimeVersion]);
  const viewingSite = sites.find((site) => site.id === viewingSiteId) ?? null;

  if (viewingSite) {
    return (
      <div>
        <button onClick={() => setViewingSiteId(null)} className="flex items-center gap-2 mb-4 transition-colors" style={{ fontSize: 14, color: "var(--text-muted)", cursor: "pointer", background: "none", border: "none" }}>
          <ArrowLeft className="w-4 h-4" /> Back to Top Sites
        </button>
        <PropertyTab deal={deal} site={viewingSite} onEdit={() => { setEditingSite(viewingSite); setDrawerOpen(true); }} />
        <div className="mt-4 glass-card-static" style={{ padding: 0, borderRadius: 12, overflow: "hidden" }}>
          <div style={{ height: 3, background: "linear-gradient(to right, #E18739, #c0deed, #243c51)" }} />
          <div style={{ padding: "20px 24px 12px" }}>
            <p style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>Tour Book Tools</p>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>Generate a branded tour book, import sites from CSV, or review itinerary data.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" style={{ padding: "0 24px 24px" }}>
            <ToolCard icon={<BookOpen className="w-6 h-6" style={{ color: "#E18739" }} />} title="Generate Tour Book" description="Select sites, configure, export PDF" onClick={() => navigate(`/tour-book-generator?deal=${deal.id}`)} />
            <ToolCard icon={<FileSpreadsheet className="w-6 h-6" style={{ color: "var(--text-muted)" }} />} title="Import from CSV" description="Bulk-add sites from a spreadsheet" onClick={() => setImportOpen(true)} />
            <ToolCard icon={<Route className="w-6 h-6" style={{ color: "var(--text-muted)" }} />} title="Build Itinerary" description="Review the full map with routing context" onClick={() => navigate(`/map?deal=${deal.id}`)} />
          </div>
        </div>
        <Sheet open={drawerOpen} onOpenChange={(open) => { setDrawerOpen(open); if (!open) setEditingSite(null); }}><SiteForm deal={deal} site={editingSite} onClose={() => { setDrawerOpen(false); setEditingSite(null); }} /></Sheet>
        <ImportSitesDialog deal={deal} open={importOpen} onOpenChange={setImportOpen} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between" style={{ marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>Top Sites</h2>
          <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 2 }}>{sites.length} {sites.length === 1 ? "property" : "properties"}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setEditingSite(null); setDrawerOpen(true); }} className="cta-secondary flex items-center gap-2"><Plus className="w-4 h-4" /> Add Site</button>
          <button onClick={() => setImportOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-[8px] text-[14px] font-medium" style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", color: "var(--text-secondary)" }}><Upload className="w-4 h-4" /> Import</button>
        </div>
      </div>

      {sites.length === 0 ? (
        <div className="glass-card-static flex flex-col items-center justify-center text-center" style={{ minHeight: 220, borderRadius: 12, padding: 32 }}>
          <Building2 className="w-9 h-9" style={{ color: "var(--text-muted)" }} />
          <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginTop: 12 }}>No sites attached</p>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6, maxWidth: 420 }}>Add or import sites to populate this tab with Supabase data for {deal.franchisee}.</p>
        </div>
      ) : (
        <>
          <div className="hidden lg:block glass-card-static overflow-hidden" style={{ borderRadius: 12, padding: 0 }}>
            <div style={{ display: "grid", gridTemplateColumns: "40px 1fr 1.2fr 0.8fr 0.7fr 0.8fr 0.8fr 0.8fr 60px 80px", height: 40, alignItems: "center", borderBottom: "1px solid var(--border-divider)", padding: "0 16px" }}>
              {["#", "Property Name", "Address", "City, State", "SF", "Space Type", "Landlord", "Status", "Files", "Action"].map((header) => <span key={header} style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{header}</span>)}
            </div>
            {sites.map((site, index) => <SiteTableRow key={site.id} site={site} index={index} total={sites.length} onView={() => setViewingSiteId(site.id)} />)}
          </div>
          <div className="flex flex-col gap-3 lg:hidden">
            {sites.map((site, index) => <SiteMobileCard key={site.id} site={site} index={index} onView={() => setViewingSiteId(site.id)} />)}
          </div>
        </>
      )}

      <Sheet open={drawerOpen} onOpenChange={(open) => { setDrawerOpen(open); if (!open) setEditingSite(null); }}><SiteForm deal={deal} site={editingSite} onClose={() => { setDrawerOpen(false); setEditingSite(null); }} /></Sheet>
      <ImportSitesDialog deal={deal} open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}

function SiteTableRow({ site, index, total, onView }: { site: Site; index: number; total: number; onView: () => void }) {
  const colors = STATUS_COLORS[site.stage];
  return (
    <div onClick={onView} className="transition-colors cursor-pointer" style={{ display: "grid", gridTemplateColumns: "40px 1fr 1.2fr 0.8fr 0.7fr 0.8fr 0.8fr 0.8fr 60px 80px", minHeight: 48, alignItems: "center", padding: "0 16px", borderBottom: index < total - 1 ? "1px solid var(--border-divider)" : "none" }}>
      <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-muted)" }}>{index + 1}</span>
      <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{site.name || site.address}</span>
      <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>{site.address}</span>
      <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>{site.city}, {site.state}</span>
      <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>{site.squareFootage || "—"}</span>
      <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>{site.spaceType || "—"}</span>
      <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>{site.landlord || "—"}</span>
      <span className="flex items-center gap-1.5" style={{ background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: 8, padding: "4px 8px", fontSize: 12, fontWeight: 600, color: colors.text, width: "fit-content" }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: colors.dot }} />{site.statusLabel || site.stage}</span>
      <span className="flex items-center gap-1" style={{ fontSize: 12, color: "var(--text-muted)" }}><FileText className="w-3 h-3" /> {site.files.length}</span>
      <button onClick={(event) => { event.stopPropagation(); onView(); }} style={{ fontSize: 14, fontWeight: 600, color: "var(--text-orange-ui)", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>View →</button>
    </div>
  );
}

function SiteMobileCard({ site, index, onView }: { site: Site; index: number; onView: () => void }) {
  const colors = STATUS_COLORS[site.stage];
  return (
    <div onClick={onView} className="glass-card-static cursor-pointer active:scale-[0.98] transition-transform" style={{ padding: 16, borderRadius: 12 }}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span style={{ width: 24, height: 24, borderRadius: "50%", background: "rgba(36,60,81,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", flexShrink: 0 }}>{index + 1}</span>
          <div>
            <p style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>{site.name || site.address}</p>
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>{site.address}, {site.city}, {site.state}</p>
          </div>
        </div>
        <span className="flex items-center gap-1.5 shrink-0" style={{ background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: 8, padding: "4px 8px", fontSize: 12, fontWeight: 600, color: colors.text }}><span style={{ width: 5, height: 5, borderRadius: "50%", background: colors.dot }} />{site.statusLabel || site.stage}</span>
      </div>
      <div className="flex items-center gap-3 mt-3 overflow-hidden" style={{ fontSize: 12, color: "var(--text-secondary)" }}>
        <span className="shrink-0" style={{ fontWeight: 500 }}>{site.squareFootage || "SF —"}</span><span className="shrink-0">·</span><span className="truncate">{site.spaceType || "Space type —"}</span><span className="shrink-0">·</span><span className="truncate">{site.landlord || "Landlord —"}</span>
      </div>
      <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: "1px solid var(--border-divider)" }}>
        <span className="flex items-center gap-1" style={{ fontSize: 12, color: "var(--text-muted)" }}><FileText className="w-3 h-3" /> {site.files.length} files</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-orange-ui)" }}>View →</span>
      </div>
    </div>
  );
}

function ToolCard({ icon, title, description, onClick }: { icon: React.ReactNode; title: string; description: string; onClick: () => void }) {
  return (
    <div onClick={onClick} className="flex flex-col gap-2 transition-all cursor-pointer" style={{ padding: 16, borderRadius: 10, background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
      {icon}
      <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{title}</span>
      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{description}</span>
    </div>
  );
}
