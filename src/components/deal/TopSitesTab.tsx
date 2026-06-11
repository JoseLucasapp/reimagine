import { Building2, FileText, Plus, Upload } from "lucide-react";
import { toast } from "sonner";
import { getSitesByDeal, type Site } from "@/data/mapRuntimeData";

interface TopSitesTabProps {
  deal: {
    id: string;
    city: string;
    state: string;
    franchisee: string;
  };
}

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  Prospecting: { bg: "rgba(30,96,145,0.08)", border: "rgba(30,96,145,0.22)", text: "#1e6091", dot: "#1e6091" },
  LOI: { bg: "rgba(91,33,182,0.08)", border: "rgba(91,33,182,0.22)", text: "#5b21b6", dot: "#5b21b6" },
  Lease: { bg: "rgba(217,119,6,0.08)", border: "rgba(217,119,6,0.22)", text: "#92400e", dot: "#d97706" },
  Open: { bg: "rgba(5,150,105,0.08)", border: "rgba(5,150,105,0.22)", text: "#065f46", dot: "#065f46" },
  Closed: { bg: "rgba(153,27,27,0.08)", border: "rgba(153,27,27,0.22)", text: "#991b1b", dot: "#991b1b" },
};

function statusStyle(site: Site) {
  return STATUS_COLORS[site.stage] ?? STATUS_COLORS.Prospecting;
}

export function TopSitesTab({ deal }: TopSitesTabProps) {
  const sites = getSitesByDeal(deal.id);

  return (
    <div>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between" style={{ marginBottom: 24 }}>
        <div className="flex items-center justify-between lg:block">
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>Top Sites</h2>
            <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 2 }}>
              {sites.length} real {sites.length === 1 ? "property" : "properties"}
            </p>
          </div>
          <div className="flex items-center gap-2 lg:hidden">
            <button onClick={() => toast("Add site requires a Supabase-backed site form")} className="cta-secondary flex items-center gap-1.5" style={{ padding: "6px 12px", fontSize: 12 }}>
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </div>
        </div>
        <div className="hidden lg:flex items-center gap-2">
          <button onClick={() => toast("Add site requires a Supabase-backed site form")} className="cta-secondary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Site
          </button>
          <button
            onClick={() => toast("CSV import requires a Supabase import workflow")}
            className="flex items-center gap-2 px-4 py-2 rounded-[8px] text-[14px] font-medium"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", color: "var(--text-secondary)" }}>
            <Upload className="w-4 h-4" /> Import
          </button>
        </div>
      </div>

      {sites.length === 0 ? (
        <div className="glass-card-static flex flex-col items-center justify-center text-center" style={{ minHeight: 220, borderRadius: 12, padding: 32 }}>
          <Building2 className="w-9 h-9" style={{ color: "var(--text-muted)" }} />
          <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginTop: 12 }}>No real sites attached</p>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6, maxWidth: 420 }}>
            Sites will appear here after they are saved in Supabase for {deal.franchisee}.
          </p>
        </div>
      ) : (
        <div className="glass-card-static overflow-hidden" style={{ borderRadius: 12, padding: 0 }}>
          <div style={{
            display: "grid", gridTemplateColumns: "40px 1.4fr 1fr 0.8fr 0.8fr 1.4fr",
            height: 40, alignItems: "center", borderBottom: "1px solid var(--border-divider)",
            padding: "0 16px",
          }}>
            {["#", "Address", "City, State", "Stage", "Files", "Notes"].map(h => (
              <span key={h} style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</span>
            ))}
          </div>

          {sites.map((site, idx) => {
            const sc = statusStyle(site);
            return (
              <div
                key={site.id}
                style={{
                  display: "grid", gridTemplateColumns: "40px 1.4fr 1fr 0.8fr 0.8fr 1.4fr",
                  minHeight: 52, alignItems: "center", padding: "0 16px",
                  borderBottom: idx < sites.length - 1 ? "1px solid var(--border-divider)" : "none",
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-muted)" }}>{idx + 1}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{site.address}</span>
                <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>{site.city}, {site.state}</span>
                <span className="flex items-center gap-1.5" style={{
                  background: sc.bg, border: `1px solid ${sc.border}`, borderRadius: 8,
                  padding: "4px 8px", fontSize: 12, fontWeight: 600, color: sc.text, width: "fit-content",
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: sc.dot }} />
                  {site.stage}
                </span>
                <span className="flex items-center gap-1" style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  <FileText className="w-3 h-3" /> {site.files.length}
                </span>
                <span className="truncate" style={{ fontSize: 13, color: "var(--text-muted)" }}>{site.notes || "—"}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
