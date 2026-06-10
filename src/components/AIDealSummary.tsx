import { DealRecord } from "@/data/dealsData";
import { generateDealSummary } from "@/lib/dealIntelligence";
import { RefreshCw, Clock } from "lucide-react";
import { useState, useMemo } from "react";
import aiNudgeIcon from "@/assets/ai-nudge-icon.png";

function highlightEntities(text: string, deal: DealRecord): React.ReactNode[] {
  const highlights = [
    { term: deal.franchisee, bg: "rgba(36,60,81,0.06)" },
    { term: `${deal.city}, ${deal.state}`, bg: "rgba(36,60,81,0.06)" },
    { term: "successfully signed", bg: "rgba(5,150,105,0.08)" },
    { term: "fully executed", bg: "rgba(5,150,105,0.08)" },
    { term: "All 3 leases", bg: "rgba(5,150,105,0.08)" },
  ];

  let result: React.ReactNode[] = [text];

  for (const h of highlights) {
    const next: React.ReactNode[] = [];
    for (const part of result) {
      if (typeof part !== "string") { next.push(part); continue; }
      const idx = part.indexOf(h.term);
      if (idx === -1) { next.push(part); continue; }
      if (idx > 0) next.push(part.slice(0, idx));
      next.push(
        <span key={h.term + idx} style={{ background: h.bg, borderRadius: 4, padding: "0 4px", fontWeight: 500, color: "var(--text-primary)" }}>
          {h.term}
        </span>
      );
      if (idx + h.term.length < part.length) next.push(part.slice(idx + h.term.length));
    }
    result = next;
  }
  return result;
}

export function AIDealSummary({ deal }: { deal: DealRecord }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const summary = useMemo(() => {
    void refreshKey;
    return generateDealSummary(deal);
  }, [deal, refreshKey]);

  const handleRefresh = () => {
    setSpinning(true);
    setRefreshKey((k) => k + 1);
    setTimeout(() => setSpinning(false), 600);
  };

  return (
    <div style={{
      background: "var(--nudge-card-bg)",
      border: "1.5px solid transparent",
      borderRadius: 12,
      boxShadow: "var(--shadow-card)",
      overflow: "hidden",
      marginBottom: 16,
    }}>
      {/* Header */}
      <div className="flex items-center justify-between" style={{ padding: "16px 16px 12px 16px", borderBottom: "1px solid var(--border-divider)" }}>
        <div className="flex items-center gap-[8px]">
          <span style={{
            fontSize: 12, fontWeight: 600, color: "var(--ai-badge-color)",
            background: "var(--ai-badge-bg)",
            borderRadius: 20, padding: "2px 10px",
            display: "inline-flex", alignItems: "center", gap: 4,
          }}>
            <img src={aiNudgeIcon} alt="" style={{ width: 12, height: 12 }} /> AI Summary
          </span>
        </div>
        <button
          onClick={handleRefresh}
          title="Regenerate summary"
          className="p-[4px] rounded-[8px] hover:bg-white/60 transition-colors"
          style={{ color: "var(--text-muted)" }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "#E18739"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
        >
          <RefreshCw className="w-4 h-4" style={{ transition: "transform 0.6s ease", transform: spinning ? "rotate(360deg)" : "none" }} />
        </button>
      </div>

      {/* Summary text */}
      <div style={{ padding: "16px 16px 16px 16px" }}>
        <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text-secondary)" }}>
          {highlightEntities(summary, deal)}
        </p>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between" style={{
        padding: "8px 16px 8px 16px", borderTop: "1px solid var(--border-divider)",
      }}>
        <div className="flex items-center gap-[4px]">
          <Clock className="w-[12px] h-[12px]" style={{ color: "var(--text-muted)" }} />
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Updated {new Date().toLocaleDateString()}</span>
        </div>
        <div className="flex items-center gap-[4px]">
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Was this helpful?</span>
          <button className="hover:text-[#E18739] transition-colors" style={{ fontSize: 12, color: "var(--text-muted)", padding: "0 4px" }}>👍</button>
          <button className="hover:text-[#E18739] transition-colors" style={{ fontSize: 12, color: "var(--text-muted)", padding: "0 4px" }}>👎</button>
        </div>
      </div>
    </div>
  );
}
