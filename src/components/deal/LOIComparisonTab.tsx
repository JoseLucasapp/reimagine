import { Columns3 } from "lucide-react";

export function LOIComparisonTab() {
  return (
    <div className="glass-card-static flex flex-col items-center justify-center" style={{ padding: 48, borderRadius: 16, minHeight: 400, position: "relative", overflow: "hidden" }}>
      {/* Top gradient bar */}
      <div className="absolute top-0 left-0 right-0" style={{ height: 3, background: "linear-gradient(to right, #E18739, #c0deed)" }} />
      
      <Columns3 className="w-12 h-12" style={{ color: "var(--text-muted)" }} />
      <h2 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", marginTop: 16 }}>LOI Comparison</h2>
      <span style={{
        display: "inline-block", background: "rgba(225,135,57,0.10)", color: "#b85c1a",
        border: "1px solid rgba(225,135,57,0.22)", borderRadius: 8,
        padding: "8px 24px", fontSize: 14, fontWeight: 600, marginTop: 16,
      }}>Coming Soon</span>
      <p style={{ fontSize: 14, color: "var(--text-muted)", maxWidth: 420, textAlign: "center", marginTop: 16, lineHeight: 1.6 }}>
        Compare lease terms side-by-side across multiple properties, or review two LOI revisions for the same site.
      </p>
      
      {/* Two preview cards */}
      <div className="flex gap-4 mt-6">
        {[
          { title: "Property vs Property", desc: "Compare terms across different locations" },
          { title: "LOI Round 1 vs Round 2", desc: "Track how terms changed through negotiation" },
        ].map(card => (
          <div key={card.title} style={{
            padding: "16px 24px", borderRadius: 12, border: "1px solid var(--border-subtle)",
            background: "var(--bg-card)", minWidth: 200, textAlign: "center",
          }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{card.title}</p>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{card.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
