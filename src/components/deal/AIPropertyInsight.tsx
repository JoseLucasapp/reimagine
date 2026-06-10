import { useState } from "react";
import { RefreshCw, Ruler, Building2, LayoutGrid, Clock } from "lucide-react";
import aiNudgeIcon from "@/assets/ai-nudge-icon.png";

function HighlightText({ text }: { text: string }) {
  const highlights: { phrase: string; bg: string; color: string }[] = [
    { phrase: "meets all core requirements", bg: "rgba(5,150,105,0.12)", color: "var(--status-signed-text)" },
    { phrase: "2,400 SF", bg: "rgba(225,135,57,0.12)", color: "var(--text-orange-ui)" },
    { phrase: "158 days", bg: "rgba(217,119,6,0.12)", color: "var(--stage-warn)" },
    { phrase: "64 days over", bg: "rgba(153,27,27,0.12)", color: "var(--stage-bad)" },
    { phrase: "benchmark", bg: "rgba(36,60,81,0.12)", color: "var(--text-tertiary)" },
  ];

  let parts: (string | { text: string; bg: string; color: string })[] = [text];
  for (const h of highlights) {
    const next: typeof parts = [];
    for (const part of parts) {
      if (typeof part !== "string") { next.push(part); continue; }
      const idx = part.indexOf(h.phrase);
      if (idx === -1) { next.push(part); continue; }
      if (idx > 0) next.push(part.slice(0, idx));
      next.push({ text: h.phrase, bg: h.bg, color: h.color });
      if (idx + h.phrase.length < part.length) next.push(part.slice(idx + h.phrase.length));
    }
    parts = next;
  }

  return (
    <p style={{ fontSize: 12, lineHeight: 1.6, color: "var(--text-secondary)" }}>
      {parts.map((p, i) =>
        typeof p === "string" ? <span key={i}>{p}</span> : (
          <span key={i} style={{ background: p.bg, color: p.color, borderRadius: 4, padding: "1px 4px 1px 4px", fontWeight: 600 }}>{p.text}</span>
        )
      )}
    </p>
  );
}

const FIT_CHIPS = [
  { icon: Ruler, label: "2,400 SF", sub: "Req: 2,000–2,800 SF", match: true },
  { icon: Building2, label: "Inline Retail", sub: "Req: Inline or End Cap", match: true },
  { icon: LayoutGrid, label: "Strip Center", sub: "Req: Strip or Lifestyle", match: true },
];

export function AIPropertyInsight() {
  const [spinning, setSpinning] = useState(false);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);

  const handleRefresh = () => { setSpinning(true); setTimeout(() => setSpinning(false), 800); };

  const summaryText = "This McKinney Ave location meets all core requirements for Milkshake Factory. At 2,400 SF in a Strip Center, it falls within the brand's target range. Lease was executed in 158 days — 64 days over portfolio average. Consider this location a benchmark for future DFW site selections.";

  return (
    <div style={{
      background: "var(--nudge-card-bg)",
      border: "1.5px solid transparent",
      borderRadius: 12,
      boxShadow: "var(--shadow-card)",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div className="flex items-center justify-between" style={{ padding: "12px 16px 12px 16px", borderBottom: "1px solid var(--border-divider)" }}>
        <span style={{
          fontSize: 12, fontWeight: 600, color: "var(--ai-badge-color)",
          background: "var(--ai-badge-bg)",
          borderRadius: 20, padding: "2px 10px",
          display: "inline-flex", alignItems: "center", gap: 4,
        }}>
          <img src={aiNudgeIcon} alt="" style={{ width: 12, height: 12 }} /> Property Insight
        </span>
        <button onClick={handleRefresh}
          className="transition-colors"
          style={{ color: "var(--text-muted)" }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "#E18739"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
        >
          <RefreshCw className="w-4 h-4" style={{ transition: "transform 0.6s ease", transform: spinning ? "rotate(360deg)" : "none" }} />
        </button>
      </div>

      {/* Space Fit */}
      <div style={{ padding: "12px 16px 0 16px" }}>
        <span style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", display: "block", marginBottom: 8 }}>Space Fit</span>
        <div className="flex" style={{ gap: 8, marginBottom: 12, overflow: "hidden" }}>
          {FIT_CHIPS.map((chip) => (
            <div key={chip.label} className="flex flex-col min-w-0" style={{
              flex: 1, padding: "8px 10px", borderRadius: 8, gap: 4,
              background: chip.match ? "rgba(5,150,105,0.08)" : "rgba(153,27,27,0.08)",
              border: `1px solid ${chip.match ? "rgba(5,150,105,0.18)" : "rgba(153,27,27,0.18)"}`,
              overflow: "hidden",
            }}>
              <div className="flex items-center" style={{ gap: 4, minWidth: 0 }}>
                <chip.icon className="w-3 h-3 shrink-0" style={{ color: chip.match ? "var(--status-signed-text)" : "var(--stage-bad)" }} />
                <span className="truncate" style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{chip.label}</span>
              </div>
              <span className="truncate" style={{ fontSize: 12, color: "var(--text-muted)" }}>{chip.sub}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: chip.match ? "var(--status-signed-text)" : "var(--stage-bad)" }}>
                {chip.match ? "✓ Match" : "✗ Mismatch"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* AI Summary */}
      <div style={{ padding: "12px 16px 12px 16px", borderTop: "1px solid var(--border-divider)" }}>
        <HighlightText text={summaryText} />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between" style={{ padding: "8px 16px 8px 16px", borderTop: "1px solid var(--border-divider)" }}>
        <div className="flex items-center" style={{ gap: 4 }}>
          <Clock className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Generated from deal data · 3/22/2026</span>
        </div>
        <div className="flex items-center" style={{ gap: 8 }}>
          <button onClick={() => setFeedback("up")} style={{ opacity: feedback === "up" ? 1 : 0.5, fontSize: 16, transition: "opacity 0.15s" }}>👍</button>
          <button onClick={() => setFeedback("down")} style={{ opacity: feedback === "down" ? 1 : 0.5, fontSize: 16, transition: "opacity 0.15s" }}>👎</button>
        </div>
      </div>
    </div>
  );
}
