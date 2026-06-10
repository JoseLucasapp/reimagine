import { useState, useMemo, useEffect } from "react";
import {
  Search, Plus, MoreHorizontal, ExternalLink, ChevronDown, X, Info, Users, Download,
} from "lucide-react";
import { toast } from "sonner";
import {
  bizDevRecords, bizDevCategories, bizDevOwners, bizDevStatuses,
  statusBadgeClasses, statusDotClasses, statusLabels,
  BizDevRecord, BizDevStatus, BizDevCategory,
} from "@/data/bizDevData";
import { cn } from "@/lib/utils";

import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type TabKey = "all" | "active" | "inactive" | "prospects";

const tabs: { key: TabKey; label: string; filter?: BizDevStatus }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active Clients", filter: "0 - Active Client" },
  { key: "inactive", label: "In-Active", filter: "1 - In-Active Client" },
  { key: "prospects", label: "Prospects", filter: "2 - Prospect" },
];

const emptyRecord: Omit<BizDevRecord, "id"> = {
  status: "2 - Prospect", owner: "", dateAdded: new Date().toISOString().slice(0, 10),
  companyName: "", website: "", category: "F&B", subCategory: "",
  isFranchise: true, reachOutMethod: "", mainContact: "", cell: "",
  mainContactPosition: "", mainContactEmail: "",
  reachOut1: "", reachOut2: "", reachOut3: "", reachOut4: "",
};

export default function BizDevPage() {
  const [tab, setTab] = useState<TabKey>("all");
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [records, setRecords] = useState(bizDevRecords);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<BizDevRecord | null>(null);
  const [formData, setFormData] = useState<Omit<BizDevRecord, "id">>(emptyRecord);
  const [sortCol, setSortCol] = useState<keyof BizDevRecord>("companyName");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [bannerDismissed, setBannerDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem("rcre_bizdev_banner_dismissed") === "1";
  });
  const BIZDEV_IMPORT_URL =
    "https://script.google.com/macros/s/AKfycby82LjrN3GcSAxkriizFrmnFqKADw5TFK0igBMXWLRNQFV0eKNyN5gtZDVlkClV7Hg7hQ/exec";
  const dismissBanner = () => {
    sessionStorage.setItem("rcre_bizdev_banner_dismissed", "1");
    setBannerDismissed(true);
  };
  const handleImportFromBizDev = () => {
    window.open(BIZDEV_IMPORT_URL, "_blank", "noopener,noreferrer");
    toast("Biz Dev import coming soon", {
      description: "Opening your existing Biz Dev workspace in a new tab.",
    });
  };

  const filtered = useMemo(() => {
    const tabFilter = tabs.find((t) => t.key === tab)?.filter;
    return records
      .filter((r) => {
        if (tabFilter && r.status !== tabFilter) return false;
        if (catFilter !== "all" && r.category !== catFilter) return false;
        if (ownerFilter !== "all" && r.owner !== ownerFilter) return false;
        if (search) return r.companyName.toLowerCase().includes(search.toLowerCase());
        return true;
      })
      .sort((a, b) => {
        const aVal = a[sortCol] ?? "";
        const bVal = b[sortCol] ?? "";
        const cmp = String(aVal).localeCompare(String(bVal));
        return sortDir === "asc" ? cmp : -cmp;
      });
  }, [records, tab, search, catFilter, ownerFilter, sortCol, sortDir]);

  const openAdd = () => { setEditingRecord(null); setFormData(emptyRecord); setDrawerOpen(true); };
  const openEdit = (r: BizDevRecord) => { setEditingRecord(r); const { id, ...rest } = r; setFormData(rest); setDrawerOpen(true); };
  const handleSave = () => {
    if (editingRecord) {
      setRecords((prev) => prev.map((r) => r.id === editingRecord.id ? { ...r, ...formData } : r));
      toast.success("Prospect updated");
    } else {
      setRecords((prev) => [...prev, { ...formData, id: `bd${Date.now()}` } as BizDevRecord]);
      toast.success("Prospect added", { description: formData.companyName || "New prospect" });
    }
    setDrawerOpen(false);
  };
  const handleConvert = (r: BizDevRecord) => {
    setRecords((prev) => prev.map((rec) => rec.id === r.id ? { ...rec, status: "0 - Active Client" as BizDevStatus } : rec));
  };
  const toggleSort = (col: keyof BizDevRecord) => {
    if (sortCol === col) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  };
  const updateForm = <K extends keyof Omit<BizDevRecord, "id">>(key: K, value: Omit<BizDevRecord, "id">[K]) => setFormData((prev) => ({ ...prev, [key]: value }));

  const SortHeader = ({ col, children }: { col: keyof BizDevRecord; children: React.ReactNode }) => (
    <th
      className="text-left px-4 py-3 cursor-pointer select-none whitespace-nowrap transition-colors"
      onClick={() => toggleSort(col)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {sortCol === col && <ChevronDown className={cn("w-3 h-3 transition-transform", sortDir === "desc" && "rotate-180")} />}
      </span>
    </th>
  );

  return (
    <div className="animate-fade-in">
    <div className="px-4 md:px-7" style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 1600, margin: "0 auto", paddingTop: 20, paddingBottom: 20 }}>
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" style={{ marginBottom: -4 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
          Prospects
        </h1>
        <div className="flex items-center gap-3">
          <span style={{ fontSize: 12, fontWeight: 400, color: "var(--text-muted)" }}>
            {filtered.length} record{filtered.length !== 1 ? "s" : ""}
          </span>
          <button
            onClick={openAdd}
            className="cta-primary inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Add New Prospect
          </button>
        </div>
      </div>

      {/* Biz Dev → Prospects bridge banner (dismissible per session) */}
      {!bannerDismissed && (
        <div
          role="status"
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between"
          style={{
            gap: 12,
            padding: "12px 16px",
            borderRadius: 12,
            background: "rgba(94, 158, 214, 0.08)",
            border: "1px solid rgba(94, 158, 214, 0.28)",
          }}
        >
          <div className="flex items-start" style={{ gap: 12 }}>
            <div
              className="flex items-center justify-center shrink-0"
              style={{
                width: 32, height: 32, borderRadius: 8,
                background: "rgba(94, 158, 214, 0.18)",
                color: "#5E9ED6",
              }}
            >
              <Info className="w-4 h-4" />
            </div>
            <div className="flex flex-col" style={{ gap: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.4 }}>
                Your existing Biz Dev contacts are being migrated into Prospects.
              </span>
              <span style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.4 }}>
                Full integration coming soon.
              </span>
            </div>
          </div>
          <div className="flex items-center" style={{ gap: 8 }}>
            <button
              type="button"
              onClick={handleImportFromBizDev}
              className="inline-flex items-center transition-colors"
              style={{
                gap: 8,
                padding: "8px 12px",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                color: "#5E9ED6",
                background: "transparent",
                border: "1px solid rgba(94, 158, 214, 0.45)",
                cursor: "pointer",
              }}
            >
              <Download className="w-3.5 h-3.5" />
              Import from Biz Dev
            </button>
            <button
              type="button"
              onClick={dismissBanner}
              aria-label="Dismiss banner"
              className="flex items-center justify-center transition-colors"
              style={{
                width: 28, height: 28, borderRadius: 8,
                background: "transparent", border: "none",
                color: "var(--text-muted)", cursor: "pointer",
              }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-4 overflow-x-auto" style={{ borderBottom: "2px solid rgba(36,60,81,0.08)", scrollbarWidth: "none" }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide transition-colors -mb-px whitespace-nowrap"
            style={{
              borderBottom: tab === t.key ? "3px solid #E18739" : "3px solid transparent",
              color: tab === t.key ? "var(--stat-value-color)" : "var(--text-faint)",
              background: tab === t.key ? "rgba(36,60,81,0.04)" : "transparent",
              borderRadius: tab === t.key ? "8px 8px 0 0" : undefined,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#94a3b8" }} />
          <input
            type="text" placeholder="Search company..." value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="glass-input pl-9 pr-4 py-2 text-sm w-full"
          />
        </div>
        <div className="flex gap-3">
          <Select value={catFilter} onValueChange={setCatFilter}>
            <SelectTrigger className="glass-input"><SelectValue placeholder="All Categories" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {bizDevCategories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={ownerFilter} onValueChange={setOwnerFilter}>
            <SelectTrigger className="glass-input"><SelectValue placeholder="All Owners" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Owners</SelectItem>
              {bizDevOwners.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="glass-table">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <SortHeader col="status">Status</SortHeader>
                <SortHeader col="companyName">Company</SortHeader>
                <SortHeader col="category">Category</SortHeader>
                <SortHeader col="owner">Owner</SortHeader>
                <SortHeader col="mainContact">Contact</SortHeader>
                <SortHeader col="reachOutMethod">Method</SortHeader>
                <SortHeader col="reachOut1">1st Reach</SortHeader>
                <SortHeader col="dateAdded">Added</SortHeader>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="transition-colors">
                  <td className="px-4 py-3.5">
                    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold", statusBadgeClasses[r.status])}>
                      <span className={cn("w-1.5 h-1.5 rounded-full", statusDotClasses[r.status])} />
                      {statusLabels[r.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div>
                      <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{r.companyName}</span>
                      {r.website && (
                        <a href={r.website} target="_blank" rel="noopener noreferrer" className="ml-1.5 inline-flex transition-colors" style={{ color: "#94a3b8" }}>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                    <span className="text-xs" style={{ color: "var(--text-faint)" }}>{r.isFranchise ? "Franchise" : "Corporate"}</span>
                  </td>
                  <td className="px-4 py-3.5 text-sm" style={{ color: "var(--text-secondary)" }}>{r.category}</td>
                  <td className="px-4 py-3.5 text-sm font-medium" style={{ color: "#E18739" }}>{r.owner}</td>
                  <td className="px-4 py-3.5">
                    <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{r.mainContact}</div>
                    <div className="text-xs" style={{ color: "var(--text-faint)" }}>{r.mainContactPosition}</div>
                  </td>
                  <td className="px-4 py-3.5 text-sm" style={{ color: "var(--text-secondary)" }}>{r.reachOutMethod}</td>
                  <td className="px-4 py-3.5 text-xs whitespace-nowrap" style={{ color: "var(--text-faint)" }}>{r.reachOut1 || "—"}</td>
                  <td className="px-4 py-3.5 text-xs whitespace-nowrap" style={{ color: "var(--text-faint)" }}>{r.dateAdded}</td>
                  <td className="px-4 py-3.5">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-1 rounded transition-colors" style={{ color: "var(--text-faint)" }}>
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(r)}>View / Edit</DropdownMenuItem>
                        {r.status === "2 - Prospect" && (
                          <DropdownMenuItem onClick={() => handleConvert(r)}>Convert to Brand</DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-16 text-center text-sm" style={{ color: "var(--text-faint)" }}>No records match filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto" style={{ background: "var(--bg-surface)", backdropFilter: "blur(24px)" }}>
          <SheetHeader>
            <SheetTitle style={{ color: "var(--text-primary)" }}>{editingRecord ? "Edit Record" : "Add New Prospect"}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <FormField label="Company Name" value={formData.companyName} onChange={(v) => updateForm("companyName", v)} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="section-label mb-1.5 block">Status</label>
                <Select value={formData.status} onValueChange={(v) => updateForm("status", v as BizDevStatus)}>
                  <SelectTrigger className="glass-input"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {bizDevStatuses.map((s) => <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <FormField label="Owner" value={formData.owner} onChange={(v) => updateForm("owner", v)} />
            </div>
            <FormField label="Website" value={formData.website} onChange={(v) => updateForm("website", v)} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="section-label mb-1.5 block">Category</label>
                <Select value={formData.category} onValueChange={(v) => updateForm("category", v as BizDevCategory)}>
                  <SelectTrigger className="glass-input"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {bizDevCategories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <FormField label="Sub-Category" value={formData.subCategory} onChange={(v) => updateForm("subCategory", v)} />
            </div>
            <div className="flex items-center gap-3">
              <label className="section-label">Franchise</label>
              <button
                type="button"
                onClick={() => updateForm("isFranchise", !formData.isFranchise)}
                className={cn("w-10 h-6 rounded-full transition-colors relative", formData.isFranchise ? "bg-[#243c51]" : "bg-gray-300")}
              >
                <span className={cn("absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform", formData.isFranchise ? "left-[18px]" : "left-0.5")} />
              </button>
              <span className="text-sm" style={{ color: "var(--text-primary)" }}>{formData.isFranchise ? "Franchise" : "Corporate"}</span>
            </div>
            <FormField label="Reach Out Method" value={formData.reachOutMethod} onChange={(v) => updateForm("reachOutMethod", v)} />
            <FormField label="Main Contact" value={formData.mainContact} onChange={(v) => updateForm("mainContact", v)} />
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Position" value={formData.mainContactPosition} onChange={(v) => updateForm("mainContactPosition", v)} />
              <FormField label="Cell" value={formData.cell} onChange={(v) => updateForm("cell", v)} />
            </div>
            <FormField label="Email" value={formData.mainContactEmail} onChange={(v) => updateForm("mainContactEmail", v)} type="email" />
            <div className="grid grid-cols-2 gap-3">
              <FormField label="1st Reach Out" value={formData.reachOut1} onChange={(v) => updateForm("reachOut1", v)} type="date" />
              <FormField label="2nd Reach Out" value={formData.reachOut2} onChange={(v) => updateForm("reachOut2", v)} type="date" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="3rd Reach Out" value={formData.reachOut3} onChange={(v) => updateForm("reachOut3", v)} type="date" />
              <FormField label="4th Reach Out" value={formData.reachOut4} onChange={(v) => updateForm("reachOut4", v)} type="date" />
            </div>
            <div className="flex gap-3 pt-4">
              <button onClick={handleSave} className="cta-primary flex-1">
                {editingRecord ? "Save Changes" : "Add Record"}
              </button>
              <button onClick={() => setDrawerOpen(false)} className="px-5 py-2.5 text-sm font-semibold uppercase tracking-wide rounded-[11px] transition-colors" style={{ border: "1px solid rgba(36,60,81,0.12)", color: "#4a5568" }}>
                Cancel
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
    </div>
  );
}

function FormField({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="section-label mb-1.5 block">{label}</label>
      <input
        type={type} value={value} onChange={(e) => onChange(e.target.value)}
        className="glass-input w-full px-3 py-2 text-sm"
      />
    </div>
  );
}
