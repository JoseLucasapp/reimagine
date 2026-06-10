import { useMemo } from "react";
import { getFollowUpQueue } from "@/lib/dealIntelligence";
import { Zap, Clock } from "lucide-react";
import aiNudgeIcon from "@/assets/ai-nudge-icon.png";

export function BizDevFollowUpQueue() {
  const items = useMemo(() => getFollowUpQueue(), []);

  if (items.length === 0) return null;

  return (
    <div style={{ marginBottom: 8 }}>
      {/* Section label */}
      <div className="flex items-center gap-[8px]" style={{ marginBottom: 12 }}>
        <div className="flex items-center gap-[8px]">
          <Zap className="w-4 h-4" style={{ color: "#E18739" }} />
          <span className="text-[12px] font-semibold uppercase" style={{ letterSpacing: "0.12em", color: "#94a3b8" }}>
            AI Follow-Up Queue
          </span>
        </div>
        <div className="flex-1 h-px" style={{ background: "rgba(36,60,81,0.07)" }} />
      </div>

      {/* Scrollable strip */}
      <div className="flex gap-[12px] overflow-x-auto pb-[8px] follow-up-strip" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
        <style>{`.follow-up-strip::-webkit-scrollbar { display: none; }`}</style>
        {items.map((item) => (
          <div
            key={item.record.id}
            className="relative flex-shrink-0 transition-all hover:-translate-y-px"
            style={{
              width: 260,
              background: "var(--nudge-card-bg)",
              border: "1.5px solid transparent",
              borderRadius: 12,
              boxShadow: "var(--shadow-card)",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{
                fontSize: 12, fontWeight: 600, color: "var(--ai-badge-color)",
                background: "var(--ai-badge-bg)",
                borderRadius: 20, padding: "2px 10px",
                display: "inline-flex", alignItems: "center", gap: 4,
                width: "fit-content",
              }}>
                <img src={aiNudgeIcon} alt="" style={{ width: 12, height: 12 }} /> AI Nudge
              </span>

              <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{item.record.companyName}</p>

              <div className="flex items-center gap-[8px]" style={{ fontSize: 12, fontWeight: 500, color: "#d97706" }}>
                <Clock className="w-[12px] h-[12px]" />
                Last contact: {item.daysSinceContact}d ago
              </div>

              <p style={{ fontSize: 12, color: "var(--text-tertiary)", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {item.suggestion}
              </p>

              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "0.02em" }}>
                Log Outreach →
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
