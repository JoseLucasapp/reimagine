import { DealRecord } from "@/data/dealsData";
import { generateDealSummary } from "@/lib/dealIntelligence";
import { getLatestAiFeedbackRating, getLatestAiInsight, generateAiInsight, submitAiFeedback } from "@/application/ai/aiService";
import type { AiFeedbackRating, AiInsight } from "@/application/ai/types";
import { AIInsightFeedback } from "@/components/AIInsightFeedback";
import { RefreshCw, Clock } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
  const fallbackSummary = useMemo(() => generateDealSummary(deal), [deal]);
  const [insight, setInsight] = useState<AiInsight | null>(null);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<AiFeedbackRating | null>(null);

  useEffect(() => {
    let cancelled = false;
    setInsight(null);
    setFeedback(null);

    async function loadInsight() {
      try {
        const result = await getLatestAiInsight("deal_summary", deal.id);
        if (cancelled) return;
        setInsight(result);
        if (!result) return;

        try {
          const rating = await getLatestAiFeedbackRating(result.id);
          if (!cancelled) setFeedback(rating);
        } catch {
          if (!cancelled) setFeedback(null);
        }
      } catch {
        if (!cancelled) setInsight(null);
      }
    }

    void loadInsight();

    return () => {
      cancelled = true;
    };
  }, [deal.id]);

  const summary = insight?.output.summary || fallbackSummary;

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const result = await generateAiInsight({ type: "deal_summary", entityId: deal.id, force: true });
      setInsight(result);
      setFeedback(null);
    } catch {
      setInsight(null);
    } finally {
      setLoading(false);
    }
  };

  const handleFeedback = async (rating: AiFeedbackRating) => {
    setFeedback(rating);
    if (!insight) return;
    try {
      await submitAiFeedback(insight.id, rating);
    } catch {
      // Feedback is non-blocking; keep the UI state even if persistence fails.
    }
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
          {!insight && (
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>template fallback</span>
          )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          title="Regenerate summary"
          aria-busy={loading}
          className="p-[4px] rounded-[8px] hover:bg-white/60 transition-colors disabled:opacity-60"
          style={{ color: "var(--text-muted)", display: "inline-flex", alignItems: "center", gap: 6 }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "#E18739"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
        >
          {loading && (
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
              Generating...
            </span>
          )}
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
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
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {insight ? `Generated ${new Date(insight.createdAt).toLocaleDateString()}` : `Updated ${new Date().toLocaleDateString()}`}
          </span>
        </div>
        <div className="flex items-center gap-[4px]">
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Was this helpful?</span>
          <AIInsightFeedback value={feedback} onChange={handleFeedback} />
        </div>
      </div>
    </div>
  );
}
