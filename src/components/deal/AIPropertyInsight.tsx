import { useEffect, useMemo, useState } from "react";
import { Building2, Clock, LayoutGrid, RefreshCw, Ruler } from "lucide-react";
import aiNudgeIcon from "@/assets/ai-nudge-icon.png";
import type { DealRecord } from "@/data/dealsData";
import { spaceRequirements } from "@/data/spaceReqData";
import type { Site } from "@/data/mapRuntimeData";
import { generateAiInsight, getLatestAiFeedbackRating, getLatestAiInsight, submitAiFeedback } from "@/application/ai/aiService";
import type { AiFeedbackRating, AiInsight } from "@/application/ai/types";
import { AIInsightFeedback } from "@/components/AIInsightFeedback";

function extractNumber(value: string): number | null {
  const match = value.replace(/,/g, "").match(/\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function fitLabel(match: boolean | null) {
  if (match === null) return "Not enough data";
  return match ? "✓ Match" : "Needs review";
}

export function AIPropertyInsight({ deal, site }: { deal: DealRecord; site: Site }) {
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<AiFeedbackRating | null>(null);
  const [insight, setInsight] = useState<AiInsight | null>(null);

  const requirement = useMemo(() => spaceRequirements.find((item) => item.brandId === deal.brandId), [deal.brandId]);
  const sf = extractNumber(site.squareFootage);
  const sfMatch = requirement && sf ? sf >= requirement.minSF && sf <= requirement.maxSF : null;
  const spaceMatch = requirement && site.spaceType ? site.spaceType.toLowerCase().includes(requirement.spaceType.toLowerCase()) : null;
  const propertyMatch = requirement && site.propertyType ? site.propertyType.toLowerCase().includes(requirement.spaceType.toLowerCase()) : null;

  useEffect(() => {
    let cancelled = false;
    setInsight(null);
    setFeedback(null);

    async function loadInsight() {
      try {
        const result = await getLatestAiInsight("property_insight", site.id, "site");
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
  }, [deal.id, site.id]);

  const fallbackSummary = [
    `${site.name || site.address} is currently tracked at the ${site.stage} stage for ${deal.franchisee}.`,
    site.squareFootage ? `The recorded size is ${site.squareFootage}.` : "Square footage has not been recorded yet.",
    requirement ? `The brand requirement target is ${requirement.minSF.toLocaleString()}–${requirement.maxSF.toLocaleString()} SF.` : "No brand space requirement has been saved yet.",
    site.landlord ? `Landlord: ${site.landlord}.` : "Landlord information is still missing.",
  ].join(" ");

  const summary = insight?.output.summary || fallbackSummary;

  const chips = [
    { icon: Ruler, label: site.squareFootage || "SF missing", sub: requirement ? `Req: ${requirement.minSF.toLocaleString()}–${requirement.maxSF.toLocaleString()} SF` : "No requirement", match: sfMatch },
    { icon: Building2, label: site.spaceType || "Space type missing", sub: requirement ? `Req: ${requirement.spaceType}` : "No requirement", match: spaceMatch },
    { icon: LayoutGrid, label: site.propertyType || "Property type missing", sub: site.stage, match: propertyMatch },
  ];

  const handleRegenerate = async () => {
    setLoading(true);
    try {
      const result = await generateAiInsight({
        type: "property_insight",
        entityId: site.id,
        entityType: "site",
        force: true,
        context: { dealId: deal.id },
      });
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
      // Feedback is non-blocking; keep the local UI state.
    }
  };

  return (
    <div style={{ background: "var(--nudge-card-bg)", border: "1.5px solid transparent", borderRadius: 12, boxShadow: "var(--shadow-card)", overflow: "hidden" }}>
      <div className="flex items-center justify-between" style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-divider)" }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ai-badge-color)", background: "var(--ai-badge-bg)", borderRadius: 20, padding: "2px 10px", display: "inline-flex", alignItems: "center", gap: 4 }}>
          <img src={aiNudgeIcon} alt="" style={{ width: 12, height: 12 }} /> Property Insight
        </span>
        <button
          onClick={handleRegenerate}
          disabled={loading}
          aria-busy={loading}
          className="transition-colors disabled:opacity-60"
          style={{ color: "var(--text-muted)", display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          {loading && (
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
              Generating...
            </span>
          )}
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>
      <div style={{ padding: "12px 16px 0" }}>
        <span style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", display: "block", marginBottom: 8 }}>Space Fit</span>
        <div className="flex" style={{ gap: 8, marginBottom: 12, overflow: "hidden" }}>
          {chips.map((chip) => (
            <div key={chip.label} className="flex flex-col min-w-0" style={{ flex: 1, padding: "8px 10px", borderRadius: 8, gap: 4, background: chip.match === false ? "rgba(217,119,6,0.08)" : "rgba(5,150,105,0.08)", border: `1px solid ${chip.match === false ? "rgba(217,119,6,0.18)" : "rgba(5,150,105,0.18)"}`, overflow: "hidden" }}>
              <div className="flex items-center" style={{ gap: 4, minWidth: 0 }}>
                <chip.icon className="w-3 h-3 shrink-0" style={{ color: chip.match === false ? "var(--stage-warn)" : "var(--status-signed-text)" }} />
                <span className="truncate" style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{chip.label}</span>
              </div>
              <span className="truncate" style={{ fontSize: 12, color: "var(--text-muted)" }}>{chip.sub}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: chip.match === false ? "var(--stage-warn)" : "var(--status-signed-text)" }}>{fitLabel(chip.match)}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border-divider)" }}>
        <p style={{ fontSize: 12, lineHeight: 1.6, color: "var(--text-secondary)" }}>{summary}</p>
      </div>
      <div className="flex items-center justify-between" style={{ padding: "8px 16px", borderTop: "1px solid var(--border-divider)" }}>
        <div className="flex items-center" style={{ gap: 4 }}>
          <Clock className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{insight ? `Generated ${new Date(insight.createdAt).toLocaleDateString()}` : "Generated from Supabase data"}</span>
        </div>
        <AIInsightFeedback value={feedback} onChange={handleFeedback} size="md" />
      </div>
    </div>
  );
}
