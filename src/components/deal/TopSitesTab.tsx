import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Plus, Upload, FileText, ArrowLeft, BookOpen, FileSpreadsheet, Route } from "lucide-react";
import { PropertyTab } from "./PropertyTab";
import { toast } from "sonner";

interface TopSitesTabProps {
  deal: {
    city: string;
    state: string;
    franchisee: string;
  };
}

const MOCK_SITES = [
  { id: "s1", name: "McKinney Ave", address: "3421 McKinney Ave", cityState: "Dallas, TX", sf: "2,400 SF", spaceType: "Inline Retail", landlord: "Crow Holdings", status: "Selected", files: 6, selected: true },
  { id: "s2", name: "Uptown Plaza", address: "2800 Routh St", cityState: "Dallas, TX", sf: "2,200 SF", spaceType: "End Cap", landlord: "Lincoln Property", status: "Under Review", files: 2, selected: false },
  { id: "s3", name: "Knox-Henderson Strip", address: "4100 Knox St", cityState: "Dallas, TX", sf: "2,600 SF", spaceType: "Inline Retail", landlord: "Weitzman Group", status: "Active Tour", files: 1, selected: false },
];

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  "Selected": { bg: "rgba(5,150,105,0.08)", border: "rgba(5,150,105,0.22)", text: "#065f46", dot: "#065f46" },
  "Under Review": { bg: "rgba(217,119,6,0.08)", border: "rgba(217,119,6,0.22)", text: "#92400e", dot: "#d97706" },
  "Active Tour": { bg: "rgba(30,96,145,0.08)", border: "rgba(30,96,145,0.22)", text: "#1e6091", dot: "#1e6091" },
  "LOI Submitted": { bg: "rgba(91,33,182,0.08)", border: "rgba(91,33,182,0.22)", text: "#5b21b6", dot: "#5b21b6" },
  "Lease Executed": { bg: "rgba(5,150,105,0.08)", border: "rgba(5,150,105,0.22)", text: "#065f46", dot: "#065f46" },
  "On Hold": { bg: "rgba(153,27,27,0.08)", border: "rgba(153,27,27,0.22)", text: "#991b1b", dot: "#991b1b" },
};

export function TopSitesTab({ deal }: TopSitesTabProps) {
  const navigate = useNavigate();
  const [viewingSite, setViewingSite] = useState<string | null>(null);

  if (viewingSite) {
    return (
      <div>
        <button
          onClick={() => setViewingSite(null)}
          className="flex items-center gap-2 mb-4 transition-colors"
          style={{ fontSize: 14, color: "var(--text-muted)", cursor: "pointer", background: "none", border: "none" }}
          onMouseEnter={e => { e.currentTarget.style.color = "var(--text-orange-ui)"; }}
          onMouseLeave={e => { e.currentTarget.style.color = "var(--text-muted)"; }}
        >
          <ArrowLeft className="w-4 h-4" /> Back to Top Sites
        </button>
        <PropertyTab deal={deal} />
        {/* Tour Book Tools */}
        <div className="mt-4 glass-card-static" style={{ padding: 0, borderRadius: 12, overflow: "hidden" }}>
          <div style={{ height: 3, background: "linear-gradient(to right, #E18739, #c0deed, #243c51)" }} />
          <div style={{ padding: "20px 24px 12px" }}>
            <p style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>Tour Book Tools</p>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
              Generate a branded tour book, import sites from CSV, or build a multi-site itinerary.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" style={{ padding: "0 24px 24px" }}>
            {/* Generate Tour Book */}
            <div onClick={() => navigate("/tour-book-generator")}
              className="flex flex-col gap-2 transition-all cursor-pointer"
              style={{ padding: 16, borderRadius: 10, background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = "var(--shadow-card-hover, 0 8px 36px rgba(36,60,81,0.13))"; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; }}>
              <BookOpen className="w-6 h-6" style={{ color: "#E18739" }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Generate Tour Book</span>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Select sites, configure, export PDF</span>
            </div>
            {/* Import from CSV */}
            <div onClick={() => toast("CSV import coming soon")}
              className="flex flex-col gap-2 transition-all cursor-pointer"
              style={{ padding: 16, borderRadius: 10, background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = "var(--shadow-card-hover, 0 8px 36px rgba(36,60,81,0.13))"; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; }}>
              <FileSpreadsheet className="w-6 h-6" style={{ color: "var(--text-muted)" }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Import from CSV</span>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Bulk-add sites from a spreadsheet</span>
              <span style={{ display: "inline-block", background: "rgba(225,135,57,0.10)", color: "#b85c1a", border: "1px solid rgba(225,135,57,0.22)", borderRadius: 4, padding: "2px 8px", fontSize: 12, fontWeight: 600, width: "fit-content" }}>Soon</span>
            </div>
            {/* Build Itinerary */}
            <div onClick={() => toast("Itinerary builder coming soon")}
              className="flex flex-col gap-2 transition-all cursor-pointer"
              style={{ padding: 16, borderRadius: 10, background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = "var(--shadow-card-hover, 0 8px 36px rgba(36,60,81,0.13))"; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; }}>
              <Route className="w-6 h-6" style={{ color: "var(--text-muted)" }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Build Itinerary</span>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Multi-site route with directions</span>
              <span style={{ display: "inline-block", background: "rgba(225,135,57,0.10)", color: "#b85c1a", border: "1px solid rgba(225,135,57,0.22)", borderRadius: 4, padding: "2px 8px", fontSize: 12, fontWeight: 600, width: "fit-content" }}>Soon</span>
            </div>
          </div>
        </div>
        
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between" style={{ marginBottom: 24 }}>
        <div className="flex items-center justify-between lg:block">
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>Top Sites</h2>
            <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 2 }}>{MOCK_SITES.length} properties</p>
          </div>
          <div className="flex items-center gap-2 lg:hidden">
            <button onClick={() => toast("Add site coming soon")} className="cta-secondary flex items-center gap-1.5" style={{ padding: "6px 12px", fontSize: 12 }}>
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </div>
        </div>
        <div className="hidden lg:flex items-center gap-2">
          <button onClick={() => toast("Add site coming soon")} className="cta-secondary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Site
          </button>
          <button
            onClick={() => toast("CSV import coming soon")}
            className="flex items-center gap-2 px-4 py-2 rounded-[8px] text-[14px] font-medium"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", color: "var(--text-secondary)" }}>
            <Upload className="w-4 h-4" /> Import
            <span style={{
              background: "rgba(225,135,57,0.12)", color: "#b85c1a",
              borderRadius: 4, padding: "2px 6px", fontSize: 12, fontWeight: 600,
            }}>Soon</span>
          </button>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden lg:block glass-card-static overflow-hidden" style={{ borderRadius: 12, padding: 0 }}>
        {/* Table Header */}
        <div style={{
          display: "grid", gridTemplateColumns: "40px 1fr 1.2fr 0.8fr 0.7fr 0.8fr 0.8fr 0.8fr 60px 80px",
          height: 40, alignItems: "center", borderBottom: "1px solid var(--border-divider)",
          padding: "0 16px",
        }}>
          {["#", "Property Name", "Address", "City, State", "SF", "Space Type", "Landlord", "Status", "Files", "Action"].map(h => (
            <span key={h} style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</span>
          ))}
        </div>

        {/* Table Rows */}
        {MOCK_SITES.map((site, idx) => {
          const sc = STATUS_COLORS[site.status] || STATUS_COLORS["Under Review"];
          return (
            <div
              key={site.id}
              onClick={() => setViewingSite(site.id)}
              className="transition-colors cursor-pointer"
              style={{
                display: "grid", gridTemplateColumns: "40px 1fr 1.2fr 0.8fr 0.7fr 0.8fr 0.8fr 0.8fr 60px 80px",
                height: 48, alignItems: "center", padding: "0 16px",
                borderBottom: idx < MOCK_SITES.length - 1 ? "1px solid var(--border-divider)" : "none",
                background: site.selected ? "rgba(36,60,81,0.03)" : "transparent",
              }}
              onMouseEnter={e => { if (!site.selected) e.currentTarget.style.background = "rgba(36,60,81,0.025)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = site.selected ? "rgba(36,60,81,0.03)" : "transparent"; }}
            >
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-muted)" }}>{idx + 1}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{site.name}</span>
              <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>{site.address}</span>
              <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>{site.cityState}</span>
              <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>{site.sf}</span>
              <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>{site.spaceType}</span>
              <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>{site.landlord}</span>
              <span className="flex items-center gap-1.5" style={{
                background: sc.bg, border: `1px solid ${sc.border}`, borderRadius: 8,
                padding: "4px 8px", fontSize: 12, fontWeight: 600, color: sc.text, width: "fit-content",
              }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: sc.dot }} />
                {site.status}
              </span>
              <span className="flex items-center gap-1" style={{ fontSize: 12, color: "var(--text-muted)" }}>
                <FileText className="w-3 h-3" /> {site.files}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); setViewingSite(site.id); }}
                className="transition-colors"
                style={{ fontSize: 14, fontWeight: 600, color: "var(--text-orange-ui)", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
                onMouseEnter={e => { e.currentTarget.style.color = "#b85c1a"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "var(--text-orange-ui)"; }}
              >
                View →
              </button>
            </div>
          );
        })}
      </div>

      {/* Mobile Cards */}
      <div className="flex flex-col gap-3 lg:hidden">
        {MOCK_SITES.map((site, idx) => {
          const sc = STATUS_COLORS[site.status] || STATUS_COLORS["Under Review"];
          return (
            <div
              key={site.id}
              onClick={() => setViewingSite(site.id)}
              className="glass-card-static cursor-pointer active:scale-[0.98] transition-transform"
              style={{
                padding: 16, borderRadius: 12,
                border: site.selected ? "1.5px solid rgba(36,60,81,0.18)" : undefined,
                background: site.selected ? "rgba(36,60,81,0.03)" : undefined,
              }}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span style={{ width: 24, height: 24, borderRadius: "50%", background: "rgba(36,60,81,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", flexShrink: 0 }}>{idx + 1}</span>
                  <div>
                    <p style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>{site.name}</p>
                    <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>{site.address}, {site.cityState}</p>
                  </div>
                </div>
                <span className="flex items-center gap-1.5 shrink-0" style={{
                  background: sc.bg, border: `1px solid ${sc.border}`, borderRadius: 8,
                  padding: "4px 8px", fontSize: 12, fontWeight: 600, color: sc.text,
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: sc.dot }} />
                  {site.status}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-3 overflow-hidden" style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                <span className="shrink-0" style={{ fontWeight: 500 }}>{site.sf}</span>
                <span className="shrink-0">·</span>
                <span className="truncate">{site.spaceType}</span>
                <span className="shrink-0">·</span>
                <span className="truncate">{site.landlord}</span>
              </div>
              <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: "1px solid var(--border-divider)" }}>
                <span className="flex items-center gap-1" style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  <FileText className="w-3 h-3" /> {site.files} files
                </span>
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-orange-ui)" }}>View →</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}