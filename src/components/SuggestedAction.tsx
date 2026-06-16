import { DealRecord } from "@/data/dealsData";
import { generateSuggestedAction } from "@/lib/dealIntelligence";
import { getLatestAiInsight } from "@/application/ai/aiService";
import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import aiNudgeIcon from "@/assets/ai-nudge-icon.png";

export function SuggestedAction({ deal }: { deal: DealRecord }) {
  const [dismissed, setDismissed] = useState(() => {
    const key = `dismissed-action-${deal.id}`;
    const stored = localStorage.getItem(key);
    if (!stored) return false;
    const expiry = new Date(stored).getTime();
    return Date.now() < expiry;
  });
  const [aiAction, setAiAction] = useState<string | null>(null);

  const fallbackAction = useMemo(() => generateSuggestedAction(deal), [deal]);

  useEffect(() => {
    let cancelled = false;
    setAiAction(null);

    getLatestAiInsight("suggested_action", deal.id)
      .then((insight) => {
        if (!cancelled) setAiAction(insight?.output.action || insight?.output.summary || null);
      })
      .catch(() => {
        if (!cancelled) setAiAction(null);
      });

    return () => {
      cancelled = true;
    };
  }, [deal.id]);

  const action = aiAction || fallbackAction;

  if (dismissed) return null;

  const handleDismiss = () => {
    const key = `dismissed-action-${deal.id}`;
    const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    localStorage.setItem(key, expiry);
    setDismissed(true);
  };

  const boldPhrase = deal.franchisee;
  const parts = action.split(boldPhrase);

  return (
    <div style={{
      background: "var(--nudge-card-bg)",
      border: "1.5px solid transparent",
      borderRadius: 12,
      boxShadow: "var(--shadow-card)",
      overflow: "hidden",
      marginBottom: 16,
    }}>
      <div style={{ padding: 16 }}>
        {/* Header row */}
        <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
          <span style={{
            fontSize: 12, fontWeight: 600, color: "var(--ai-badge-color)",
            background: "var(--ai-badge-bg)",
            borderRadius: 20, padding: "2px 10px",
            display: "inline-flex", alignItems: "center", gap: 4,
          }}>
            <img src={aiNudgeIcon} alt="" style={{ width: 12, height: 12 }} /> Suggested Action
          </span>
          <button onClick={handleDismiss} className="transition-colors" style={{ color: "var(--text-muted)", padding: 4 }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#991b1b"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action text */}
        <p style={{ fontSize: 12, lineHeight: 1.6, color: "var(--text-secondary)", marginTop: 8 }}>
          {parts.length > 1 ? (
            <>
              {parts[0]}
              <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{boldPhrase}</span>
              {parts.slice(1).join(boldPhrase)}
            </>
          ) : action}
        </p>

        {/* CTA buttons */}
        <div className="flex items-center gap-[8px]" style={{ marginTop: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "0.02em", cursor: "pointer" }}>
            Log Update →
          </span>
          <button onClick={handleDismiss} style={{
            background: "transparent", color: "var(--text-muted)",
            border: "none", fontSize: 12, cursor: "pointer",
          }}>Dismiss</button>
        </div>
      </div>
    </div>
  );
}
