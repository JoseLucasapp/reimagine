import { useMemo } from "react";
import aiNudgeIcon from "@/assets/ai-nudge-icon.png";
import { useNavigate } from "react-router-dom";
import {
  Building2, Handshake, CheckCircle2, Clock, PauseCircle,
  ArrowRight, Plus,
} from "lucide-react";
import {
  getDashboardStats, getRecentActivity, getDealsByStatusCounts,
  getBrandSummaries, DealStatus,
} from "@/data/dashboardData";
import { dealRecords, getDealBrandById, KANBAN_COLUMNS, type DealRecord } from "@/data/dealsData";
import { cn } from "@/lib/utils";
import { calculateDealHealth, getDealNudges } from "@/lib/dealIntelligence";
import { getFollowUpQueue } from "@/lib/dealIntelligence";
import { useRuntimeDataVersion } from "@/application/data/runtimeStore";

/* ── GLASS CARD STYLE ── */
const glassCard: React.CSSProperties = {
  background: "var(--bg-surface)",
  border: "1px solid var(--border-subtle)",
  boxShadow: "var(--shadow-card)",
  borderRadius: 16,
  overflow: "hidden",
  padding: 20,
  transition: "background 0.30s ease, border-color 0.30s ease, box-shadow 0.30s ease",
};

const statCardConfig: {
  key: keyof ReturnType<typeof getDashboardStats>;
  label: string;
  icon: React.ElementType;
  trend: string;
  isCurrency?: boolean;
}[] = [
  { key: "totalActiveBrands", label: "Active Brands", icon: Building2, trend: "↑ 2 this mo" },
  { key: "totalDeals", label: "Total Deals", icon: Handshake, trend: "↑ 5 this mo" },
  { key: "dealsSigned", label: "Deals Signed", icon: CheckCircle2, trend: "↑ 3 this mo" },
  { key: "dealsInProgress", label: "In Progress", icon: Clock, trend: "↑ 200 this mo" },
  { key: "dealsOnHold", label: "On Hold", icon: PauseCircle, trend: "↓ 1 this mo" },
];

const STATUS_BAR_COLORS: Record<string, string> = {
  "Signed": "#10b981", "Lease Negotiations": "#3b82f6", "First LOI(s) Submitted": "#7bafc8",
  "Market Study": "#8b5cf6", "Site Tours": "#14b8a6", "LOI Negotiations": "#6366f1",
  "Kick Off": "#94a3b8", "On Hold": "#E18739",
};

const STATUS_CHART_COLORS: Record<string, string> = {
  "Signed": "#E18739",
  "In Progress": "#E18739",
  "First LOI(s) Submitted": "#E18739",
  "Market Study": "#E18739",
  "On Hold": "#E18739",
  "Kick Off": "#E18739",
  "Site Tours": "#E18739",
  "LOI Negotiations": "#E18739",
};

const BRAND_GRADIENTS = [
  "linear-gradient(135deg, #E18739, #c4622a)",
  "linear-gradient(135deg, #243c51, #1a5276)",
  "linear-gradient(135deg, #059669, #10b981)",
  "linear-gradient(135deg, #7c3aed, #8b5cf6)",
  "linear-gradient(135deg, #be185d, #ec4899)",
  "linear-gradient(135deg, #0d9488, #14b8a6)",
];

const STATUS_PILL_CLASS: Record<string, string> = {
  "Signed": "pill-signed", "Lease Negotiations": "pill-leases", "First LOI(s) Submitted": "pill-loi",
  "Market Study": "pill-market-study", "Site Tours": "pill-prop-tour",
  "On Hold": "pill-on-hold", "Kick Off": "pill-intro-call", "LOI Negotiations": "pill-loi-neg",
};

const STAGE_AVERAGES: Record<string, number> = {
  "Kick Off": 7, "Market Study": 14, "Site Tours": 10, "First LOI(s) Submitted": 21, "LOI Negotiations": 21, "Lease Negotiations": 30,
};

function getStageTimingColor(status: string, days: number): string {
  const avg = STAGE_AVERAGES[status];
  if (!avg) return "var(--text-muted)";
  if (days <= avg) return "var(--stage-ok)";
  if (days <= avg * 1.5) return "var(--stage-warn)";
  return "var(--stage-bad)";
}

function getStageTimingBg(status: string, days: number): string | undefined {
  const avg = STAGE_AVERAGES[status];
  if (!avg) return undefined;
  if (days <= avg) return undefined;
  if (days <= avg * 1.5) return "var(--stage-warn-bg)";
  return "var(--stage-bad-bg)";
}

function isVeryOverdue(status: string, days: number): boolean {
  const avg = STAGE_AVERAGES[status];
  if (!avg) return false;
  return days > avg * 1.5;
}

function isOverAverage(status: string, days: number): boolean {
  const avg = STAGE_AVERAGES[status];
  if (!avg) return false;
  return days > avg;
}

function getDaysInStage(deal: DealRecord): number {
  const lastNote = deal.notes[0];
  if (!lastNote) return 0;
  return Math.max(0, Math.round((Date.now() - new Date(lastNote.date).getTime()) / (1000 * 60 * 60 * 24)));
}

/* ── Section Label ── */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-[10px]" style={{ marginBottom: 14 }}>
      <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-muted)" }}>
        {children}
      </span>
    </div>
  );
}

/* ── RUNTIME ANALYTICS LABELS ── */
const PIPELINE_STAGE_LABELS: Record<string, string> = {
  "Kick Off": "Intro Call",
  "Market Study": "Mkt Study",
  "Site Tours": "Prop. Tour",
  "First LOI(s) Submitted": "LOI",
  "LOI Negotiations": "LOI Neg.",
  "Lease Negotiations": "Leases",
  Signed: "Signed",
  "On Hold": "On-Hold",
};

export default function Dashboard() {
  const navigate = useNavigate();
  const runtimeDataVersion = useRuntimeDataVersion();
  const stats = useMemo(() => { void runtimeDataVersion; return getDashboardStats(); }, [runtimeDataVersion]);
  const recentActivity = useMemo(() => { void runtimeDataVersion; return getRecentActivity(); }, [runtimeDataVersion]);
  const statusCounts = useMemo(() => { void runtimeDataVersion; return getDealsByStatusCounts(); }, [runtimeDataVersion]);
  const brandSummaries = useMemo(() => { void runtimeDataVersion; return getBrandSummaries(); }, [runtimeDataVersion]);

  const brokerLeaderboard = useMemo(() => {
    void runtimeDataVersion;
    const grouped = new Map<string, { deals: number; commission: number }>();
    for (const deal of dealRecords) {
      if (!deal.broker) continue;
      const current = grouped.get(deal.broker) ?? { deals: 0, commission: 0 };
      current.deals += 1;
      current.commission += deal.estimatedCommission;
      grouped.set(deal.broker, current);
    }

    return [...grouped.entries()]
      .map(([name, values], index) => ({
        rank: index + 1,
        initials: name
          .split(/\s+/)
          .map((part) => part[0])
          .join("")
          .slice(0, 2)
          .toUpperCase(),
        name,
        deals: values.deals,
        commission: values.commission,
        accent: ["#E18739", "#7bafc8", "#94a3b8"][index % 3],
      }))
      .sort((a, b) => b.commission - a.commission)
      .map((broker, index) => ({ ...broker, rank: index + 1 }))
      .slice(0, 3);
  }, [runtimeDataVersion]);

  const pipelineStages = useMemo(() => statusCounts.map(({ status, count }) => {
    const stageDeals = dealRecords.filter((deal) => deal.status === status && !deal.isOneOff);
    const worstDeal = [...stageDeals].sort((a, b) => getDaysInStage(b) - getDaysInStage(a))[0];
    const worstBrand = worstDeal ? getDealBrandById(worstDeal.brandId)?.name ?? worstDeal.franchisee : null;

    return {
      status,
      label: PIPELINE_STAGE_LABELS[status] ?? status,
      count,
      worst: worstBrand,
      worstDays: worstDeal ? getDaysInStage(worstDeal) : 0,
      dotColor: STATUS_BAR_COLORS[status] ?? "#94a3b8",
    };
  }), [statusCounts]);

  const pipelineTotal = pipelineStages.reduce((total, stage) => total + stage.count, 0);

  const dashboardNudges = useMemo(() => {
    void runtimeDataVersion;
    return getDealNudges().slice(0, 4).map((item) => {
    const deal = dealRecords.find((record) => record.id === item.id);
    return {
      id: `nudge-${item.id}`,
      brand: item.title.split(" — ")[0] ?? "Deal",
      location: deal ? `${deal.city}, ${deal.state}` : "",
      suggestion: item.suggestion,
      action: item.action,
      url: item.actionUrl,
    };
  });
  }, [runtimeDataVersion]);

  const forecast = useMemo(() => {
    void runtimeDataVersion;
    const active = dealRecords.filter((d) => !d.isOneOff);
    const confirmed = active.filter((d) => d.status === "Signed").reduce((a, d) => a + d.estimatedCommission, 0);
    const projected = active.filter((d) => d.status === "First LOI(s) Submitted" || d.status === "LOI Negotiations" || d.status === "Lease Negotiations").reduce((a, d) => a + d.estimatedCommission, 0) * 0.65;
    const pipelineCount = active.filter((d) => d.status === "First LOI(s) Submitted" || d.status === "LOI Negotiations" || d.status === "Lease Negotiations").length;
    return { confirmed, projected: Math.round(projected), pipelineCount };
  }, [runtimeDataVersion]);

  const fcTotal = forecast.confirmed + forecast.projected;
  const fcConfPct = fcTotal > 0 ? (forecast.confirmed / fcTotal) * 100 : 50;

  const chartRows = useMemo(() => {
    const signed = statusCounts.find((s) => s.status === "Signed")?.count || 0;
    const inProgress = statusCounts.filter((s) => ["Lease Negotiations", "LOI Negotiations", "Site Tours"].includes(s.status)).reduce((a, s) => a + s.count, 0);
    const loi = statusCounts.find((s) => s.status === "First LOI(s) Submitted")?.count || 0;
    const mktStudy = statusCounts.find((s) => s.status === "Market Study")?.count || 0;
    const onHold = statusCounts.find((s) => s.status === "On Hold")?.count || 0;
    const kickOff = statusCounts.find((s) => s.status === "Kick Off")?.count || 0;
    return [
      { label: "Signed", count: signed, key: "Signed" },
      { label: "In Progress", count: inProgress, key: "In Progress" },
      { label: "LOI", count: loi, key: "First LOI(s) Submitted" },
      { label: "Mkt Study", count: mktStudy, key: "Market Study" },
      { label: "On-Hold", count: onHold, key: "On Hold" },
      { label: "Intro Call", count: kickOff, key: "Kick Off" },
    ];
  }, [statusCounts]);

  const chartMax = Math.max(...chartRows.map((r) => r.count), 1);
  const chartTotal = chartRows.reduce((a, r) => a + r.count, 0);

  const brandCards = useMemo(() => {
    void runtimeDataVersion;
    return brandSummaries.map((brand) => {
      const brandDeals = dealRecords.filter((d) => d.brandId === brand.id && !d.isOneOff);
      const stageCounts: Record<string, number> = {};
      brandDeals.forEach((d) => { stageCounts[d.status] = (stageCounts[d.status] || 0) + 1; });
      return { ...brand, stageCounts };
    });
  }, [brandSummaries, runtimeDataVersion]);

  const formatCurrency = (val: number) => {
    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `${Math.round(val / 1000)}K`;
    return `${val}`;
  };

  const totalActiveDeals = dealRecords.filter((d) => !d.isOneOff).length;

  return (
    <div className="animate-fade-in dark:!bg-transparent">
    <div className="p-4 md:p-7" style={{ display: "flex", flexDirection: "column", gap: 18 }}>

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between" style={{ marginBottom: -4 }}>
        <h1 className="text-[22px] md:text-[24px]" style={{ fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
          Dashboard
        </h1>
        <span className="text-[12px] mt-1 sm:mt-0" style={{ fontWeight: 400, color: "var(--text-muted)" }}>
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        </span>
      </div>

      {/* ═══ 1. AI FOLLOW-UP QUEUE ═══ */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <SectionLabel>⚡ AI Follow-Up Queue</SectionLabel>
        <div
          className="flex overflow-x-auto ai-nudge-row"
          style={{ gap: 12, paddingBottom: 12, paddingTop: 4, marginBottom: -8, scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          <style>{`.ai-nudge-row::-webkit-scrollbar{display:none}`}</style>
          {dashboardNudges.map((card) => (
            <div
              key={card.id}
              className="shrink-0 relative cursor-pointer transition-all hover:-translate-y-px"
              style={{
                width: 260,
                background: "var(--nudge-card-bg)",
                border: "1.5px solid transparent",
                borderRadius: 12, boxShadow: "var(--shadow-card)",
                display: "flex", flexDirection: "column", overflow: "hidden",
                transition: "box-shadow 0.30s ease",
              }}
              onClick={() => navigate(card.url)}
            >
              <div style={{ borderRadius: 11, padding: 16, display: "flex", flexDirection: "column", gap: 8, position: "relative", zIndex: 1 }}>
              <div className="flex items-center">
                   <span style={{
                   fontSize: 12, fontWeight: 600, color: "var(--text-primary)",
                   background: "var(--pill-loi-bg)",
                   borderRadius: 20, padding: "2px 10px",
                   display: "inline-flex", alignItems: "center", gap: 4,
                 }}>
                   <img src={aiNudgeIcon} alt="" style={{ width: 12, height: 12 }} /> AI Nudge
                 </span>
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{card.brand}</p>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{card.location}</p>
              </div>
              <p style={{
                fontSize: 12, color: "var(--text-tertiary)", lineHeight: 1.5,
                display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden",
              }}>
                {card.suggestion}
              </p>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "0.02em", marginTop: 4 }}>
                {card.action}
              </span>
              </div>{/* close inner white div */}
            </div>
          ))}
        </div>
      </div>

      {/* ═══ STAT CARDS ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5" style={{ gap: 16 }}>
        {statCardConfig.map((cfg) => {
          const value = stats[cfg.key as keyof typeof stats];
          const Icon = cfg.icon;
          return (
            <div
              key={cfg.key}
              className="relative transition-all duration-200 hover:-translate-y-px"
              style={{
                ...glassCard,
                background: "var(--stat-card-bg)",
                border: `0.56px solid var(--stat-card-border)`,
                borderRadius: 16,
                padding: 24, minHeight: 112,
                display: "flex", flexDirection: "column", justifyContent: "space-between", position: "relative",
              }}
            >
              
              <div className="flex items-center justify-between">
                <div style={{ color: "#E18739" }}><Icon className="w-4 h-4" /></div>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--stat-value-color)", whiteSpace: "nowrap" }}>
                  {cfg.trend}
                </span>
              </div>
              <p style={{ fontSize: 32, fontWeight: 800, color: "var(--stat-value-color)", letterSpacing: "-0.03em", lineHeight: 1, marginTop: 8 }}>
                {cfg.isCurrency ? formatCurrency(value as number) : value}
              </p>
              <div className="mt-auto pt-2">
                <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                  {cfg.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ═══ 2. MAIN 2-COLUMN GRID ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr]" style={{ gap: 16, alignItems: "stretch", marginBottom: 0 }}>

        {/* LEFT — Recent Deal Activity */}
        <div style={{ ...glassCard, padding: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Header */}
          <div className="flex items-center justify-between shrink-0" style={{ padding: "18px 20px 14px", borderBottom: "1px solid var(--border-divider)" }}>
            <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.10em", textTransform: "uppercase" as const, color: "var(--text-muted)" }}>Recent Deal Activity</span>
            <button
              onClick={() => navigate("/deals")}
              style={{ fontSize: 12, fontWeight: 600, color: "var(--text-orange-ui)", letterSpacing: "0.02em" }}
              className="flex items-center gap-1 transition-opacity hover:opacity-75"
            >
              View All <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {/* Scrollable rows */}
          <div
            className="flex-1 overflow-y-auto deal-activity-scroll"
            style={{ padding: "6px 20px 16px" }}
          >
            <style>{`.deal-activity-scroll::-webkit-scrollbar{width:3px}.deal-activity-scroll::-webkit-scrollbar-thumb{background:rgba(36,60,81,0.12);border-radius:4px}.deal-activity-scroll::-webkit-scrollbar-track{background:transparent}`}</style>
            {recentActivity.slice(0, 8).map((activity, idx, arr) => {
              const pillClass = STATUS_PILL_CLASS[activity.status] || "pill-intro-call";
              const deal = dealRecords.find((d) => d.id === activity.id);
              const daysInStage = deal ? getDaysInStage(deal) : 0;
              const stageColor = getStageTimingColor(activity.status, daysInStage);
              const stageBg = getStageTimingBg(activity.status, daysInStage);
              const veryOverdue = isVeryOverdue(activity.status, daysInStage);
              const overAvg = isOverAverage(activity.status, daysInStage);
              const isLast = idx === arr.length - 1;

              return (
                <div
                  key={activity.id}
                  className="flex items-start gap-2.5 cursor-pointer transition-colors rounded-lg"
                  style={{ padding: "9px 0", borderBottom: isLast ? "none" : "1px solid var(--border-divider)" }}
                  onClick={() => navigate(`/deals/${activity.id}`)}
                >
                  <div className="shrink-0" style={{ width: 3, height: 36, borderRadius: 2, marginTop: 3, backgroundColor: STATUS_BAR_COLORS[activity.status] || "#94a3b8" }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 min-w-0" style={{ marginBottom: 1 }}>
                      <span className="truncate" style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>
                        {activity.brandName}
                      </span>
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>· {activity.franchiseeName}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 1 }}>
                      {activity.location}
                      {activity.status !== "Signed" && daysInStage > 0 && (
                        <span
                          style={{
                            marginLeft: 6, fontSize: 12,
                            fontWeight: veryOverdue ? 700 : 600,
                            color: stageColor,
                            ...(overAvg ? { background: stageBg, padding: "1px 5px", borderRadius: 4 } : {}),
                          }}
                        >
                          {daysInStage}d in stage
                        </span>
                      )}
                    </div>
                    {activity.lastNote && (
                      <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontStyle: "italic", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {activity.lastNote}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1 ml-2">
                    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-[20px] text-[12px] font-semibold", pillClass)}>
                      {activity.status}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {new Date(activity.date).toLocaleDateString("en-US", { month: "numeric", day: "numeric" })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="shrink-0" style={{ padding: "10px 20px", borderTop: "1px solid var(--border-divider)", textAlign: "center" }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Showing 8 of {totalActiveDeals} active deals —{" "}
              <button onClick={() => navigate("/deals")} style={{ fontWeight: 600, color: "var(--text-orange-ui)" }} className="hover:opacity-75 transition-opacity">
                View All →
              </button>
            </span>
          </div>
        </div>

        {/* RIGHT — Stacked: Status Chart + Forecast + Brokers */}
        <div className="flex flex-col" style={{ gap: 14 }}>

          {/* Card A: Deals by Status — target ~200px */}
          <div style={{ ...glassCard, padding: "16px 20px" }}>
            <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.10em", textTransform: "uppercase" as const, color: "var(--text-muted)", marginBottom: 10, display: "block" }}>Deals by Status</span>
            {chartRows.map((row) => {
              const pct = Math.max((row.count / chartMax) * 100, 4);
              return (
                <div key={row.key} className="flex items-center gap-2.5" style={{ marginBottom: 9 }}>
                  <span className="shrink-0" style={{ width: 100, fontSize: 12, fontWeight: 500, color: "var(--text-tertiary)" }}>{row.label}</span>
                   <div className="flex-1 overflow-hidden" style={{ height: 8, background: "var(--border-divider)", borderRadius: 4 }}>
                     <div className="h-full transition-all duration-500" style={{ width: `${pct}%`, background: "#E18739", borderRadius: 4 }} />
                   </div>
                   <span className="shrink-0 text-right" style={{ width: 28, fontSize: 14, fontWeight: 700, color: "var(--stat-value-color)" }}>{row.count}</span>
                </div>
              );
            })}
            <div style={{ borderTop: "1px solid var(--border-divider)", marginTop: 2, paddingTop: 8, textAlign: "center" }}>
              <span style={{ fontSize: 12, fontWeight: 400, color: "var(--text-muted)" }}>{chartTotal} total deals across {brandCards.length} brands</span>
            </div>
          </div>

          {/* Card B: Pipeline Forecast — target ~150px */}
          <div style={{ ...glassCard, padding: "16px 20px" }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.10em", textTransform: "uppercase" as const, color: "var(--text-muted)" }}>Pipeline Forecast</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--status-loi-text)", background: "var(--pill-loi-bg)", border: "1px solid var(--pill-loi-border)", borderRadius: 20, padding: "2px 8px" }}>
                90 DAYS
              </span>
            </div>
            <div className="flex" style={{ gap: 0 }}>
              <div className="flex-1" style={{ paddingRight: 16 }}>
                <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--status-signed-text)", marginBottom: 3 }}>Confirmed</p>
                <p style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em", lineHeight: 1 }}>
                  ${formatCurrency(forecast.confirmed).replace("$", "")}
                </p>
                <p style={{ fontSize: 12, fontWeight: 500, color: "var(--status-signed-text)", marginTop: 3 }}>+$48K this week</p>
              </div>
              <div style={{ width: 1, background: "var(--border-divider)", margin: "0 16px 0 0" }} />
              <div className="flex-1">
                <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--status-loi-text)", marginBottom: 3 }}>Projected</p>
                <p style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em", lineHeight: 1 }}>
                  ${formatCurrency(forecast.projected).replace("$", "")}
                </p>
                <p style={{ fontSize: 12, fontWeight: 400, color: "var(--text-muted)", marginTop: 3 }}>at 65% close rate</p>
              </div>
            </div>
            <div className="flex overflow-hidden" style={{ height: 6, background: "var(--border-divider)", borderRadius: 6, marginTop: 12 }}>
              <div style={{ width: `${fcConfPct}%`, background: "linear-gradient(90deg, #059669, #10b981)", height: "100%", borderRadius: "6px 0 0 6px" }} />
              <div style={{ width: `${100 - fcConfPct}%`, background: "linear-gradient(90deg, #7bafc8, #c0deed)", opacity: 0.7, height: "100%", borderRadius: "0 6px 6px 0" }} />
            </div>
            <p style={{ fontSize: 12, fontWeight: 400, color: "var(--text-muted)", marginTop: 6 }}>
              Based on {forecast.pipelineCount} active pipeline deals
            </p>
          </div>

          {/* Card C: Top Brokers — target ~162px */}
          <div style={{ ...glassCard, padding: "16px 20px" }}>
            <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.10em", textTransform: "uppercase" as const, color: "var(--text-muted)", marginBottom: 8, display: "block" }}>
              Top Brokers — This Month
            </span>
            {brokerLeaderboard.map((broker) => (
              <div
                key={broker.rank}
                className="flex items-center"
                style={{ gap: 10, padding: "8px 0", borderBottom: broker.rank < 3 ? "1px solid var(--border-divider)" : "none" }}
              >
                <span className="shrink-0" style={{ width: 18, fontSize: 14, fontWeight: 700, color: broker.rank === 1 ? "#E18739" : "var(--text-muted)" }}>
                  #{broker.rank}
                </span>
                <div className="shrink-0 flex items-center justify-center text-white" style={{ width: 28, height: 28, borderRadius: "50%", fontSize: 12, fontWeight: 700, background: "linear-gradient(135deg, #243c51, #1a5276)" }}>
                  {broker.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate" style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{broker.name}</p>
                  <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{broker.deals} deals</p>
                </div>
              </div>
            ))}
            <div style={{ borderTop: "1px solid var(--border-divider)", marginTop: 6, paddingTop: 6, textAlign: "right" }}>
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Current period</p>
            </div>
            <div style={{ borderTop: "1px solid var(--border-divider)", marginTop: 6, paddingTop: 8 }}>
              <button onClick={() => navigate("/deals")} style={{ fontSize: 12, fontWeight: 600, color: "var(--text-orange-ui)" }} className="hover:opacity-75 transition-opacity">
                View Full Leaderboard →
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ PIPELINE PULSE STRIP (replaces Kanban) ═══ */}
      <div style={{ ...glassCard, padding: "16px 20px" }}>
        {/* Header */}
        <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
          <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.10em", textTransform: "uppercase" as const, color: "var(--text-muted)" }}>
            Active Pipeline
          </span>
          <button
            onClick={() => navigate("/deals?view=kanban")}
            style={{ fontSize: 12, fontWeight: 600, color: "var(--text-orange-ui)" }}
            className="hover:opacity-75 transition-opacity"
          >
            View Full Kanban →
          </button>
        </div>

        {/* Stage segments */}
        <div className="pipeline-scroll-strip" style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 0 }}>
          {pipelineStages.map((stage, idx) => {
            const isSigned = stage.status === "Signed";
            const isLast = idx === pipelineStages.length - 1;
            const cssKeyByStatus: Record<string, string> = {
              "Kick Off": "intro",
              "Market Study": "market",
              "Site Tours": "tour",
              "First LOI(s) Submitted": "loi",
              "LOI Negotiations": "loi",
              "Lease Negotiations": "leases",
              Signed: "signed",
              "On Hold": "hold",
            };
            const cssKey = cssKeyByStatus[stage.status] ?? "intro";
            const pillBg = `var(--pill-${cssKey}-bg)`;
            const textColor = `var(--status-${cssKey}-text)`;

            // Determine worst deal severity
            let worstColor = "var(--text-muted)";
            if (stage.worst) {
              const avg = STAGE_AVERAGES[stage.status];
              if (avg) {
                if (stage.worstDays > avg * 1.5) worstColor = "var(--stage-bad)";
                else if (stage.worstDays > avg) worstColor = "var(--stage-warn)";
                else worstColor = "var(--stage-ok)";
              } else {
                worstColor = stage.worstDays > 30 ? "var(--stage-warn)" : "var(--text-muted)";
              }
            }

            return (
              <div
                key={stage.status}
                className="cursor-pointer transition-colors"
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  borderRight: isLast ? "none" : "1px solid var(--border-divider)",
                  ...(isSigned ? { borderLeft: "2px solid rgba(5,150,105,0.30)" } : {}),
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(36,60,81,0.04)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                onClick={() => navigate("/deals")}
              >
                {/* Row 1: label + count */}
                <div className="flex items-center justify-between" style={{ marginBottom: 5 }}>
                  <div className="flex items-center gap-1.5">
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: stage.dotColor, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)" }}>{stage.label}</span>
                  </div>
                  <span style={{
                    fontSize: 12, fontWeight: 700, color: textColor,
                    background: pillBg, padding: "1px 7px", borderRadius: 10,
                  }}>
                    {stage.count}
                  </span>
                </div>
                {/* Row 2: worst deal */}
                {isSigned ? (
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 500, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      Signed deals ready for post-signing review
                    </p>
                  </div>
                ) : stage.worst ? (
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {stage.worst}
                    </p>
                    <span style={{ fontSize: 12, fontWeight: 600, color: worstColor }}>{stage.worstDays}d</span>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {/* Bottom row: progress bar + stats */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between" style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border-divider)" }}>
          {/* Progress bar */}
          <div className="hidden sm:flex overflow-hidden" style={{ width: 340, height: 6, borderRadius: 4 }}>
            {pipelineStages.map((stage, idx) => {
              const w = pipelineTotal > 0 ? (stage.count / pipelineTotal) * 340 : 0;
              const isFirst = idx === 0;
              const isLastSeg = idx === pipelineStages.length - 1;
              return (
                <div
                  key={stage.status}
                  style={{
                    width: w, height: "100%",
                    background: stage.dotColor,
                    borderRadius: isFirst ? "4px 0 0 4px" : isLastSeg ? "0 4px 4px 0" : 0,
                  }}
                />
              );
            })}
          </div>
          <div className="flex items-center" style={{ gap: 20 }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{pipelineTotal} active deals across {pipelineStages.length} stages</span>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Avg. pipeline velocity: 94 days</span>
          </div>
        </div>
      </div>

      {/* ═══ BRAND QUICK ACCESS ═══ */}
      <div>
        <SectionLabel>Brand Quick Access</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" style={{ gap: 14 }}>
          {brandCards.slice(0, 6).map((brand, idx) => {
            const gradient = BRAND_GRADIENTS[idx % BRAND_GRADIENTS.length];
            const pillEntries = Object.entries(brand.stageCounts).sort((a, b) => b[1] - a[1]);
            return (
              <div
                key={brand.id}
                className="relative cursor-pointer group transition-all duration-200 hover:-translate-y-px"
                style={{ ...glassCard, padding: "14px 16px", minHeight: 86, display: "flex", flexDirection: "column", justifyContent: "space-between" }}
                onClick={() => navigate(`/brands/${brand.id}/deals`)}
              >
                <div className="flex items-center gap-2.5">
                  <div className="shrink-0 flex items-center justify-center text-white" style={{ width: 36, height: 36, borderRadius: 10, fontSize: 14, fontWeight: 800, background: gradient, boxShadow: "0 4px 12px rgba(0,0,0,0.18)" }}>
                    {(() => { const words = brand.name.split(/[\s|]+/); if (words.length >= 2) return words.map(w => w[0]).join("").slice(0, 2).toUpperCase(); const caps = brand.name.replace(/[^A-Z]/g, ""); return caps.length >= 2 ? caps.slice(0, 2) : brand.name.slice(0, 2).toUpperCase(); })()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate" style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.2 }}>{brand.name}</p>
                    <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 1 }}>{brand.activeDeals} deals · {brand.totalSites} site{brand.totalSites !== 1 ? "s" : ""}</p>
                  </div>
                  <ArrowRight className="w-3 h-3 shrink-0 transition-all duration-200 group-hover:translate-x-[3px]" style={{ color: "var(--text-muted)" }} />
                </div>
                <div className="flex flex-wrap gap-1" style={{ marginTop: 8, maxHeight: 22, overflow: "hidden" }}>
                  {pillEntries.slice(0, 4).map(([stage, count]) => {
                    const shortLabels: Record<string, string> = { "Signed": "Signed", "Lease Negotiations": "Leases", "LOI Negotiations": "LOI", "First LOI(s) Submitted": "LOI", "Market Study": "Mkt Study", "Site Tours": "Tour", "On Hold": "On-hold", "Kick Off": "Intro" };
                    const pillClass = STATUS_PILL_CLASS[stage] || "pill-intro-call";
                    return (
                      <span key={stage} className={cn("inline-flex items-center rounded-[10px]", pillClass)} style={{ fontSize: 12, fontWeight: 600, padding: "2px 6px" }}>
                        {shortLabels[stage] || stage} ×{count}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {Array.from({ length: Math.max(0, 6 - brandCards.length) }).map((_, i) => (
            <div
              key={`placeholder-${i}`}
              className="flex flex-col items-center justify-center cursor-pointer transition-all duration-200 group"
              style={{
                ...glassCard,
                border: "1.5px dashed var(--border-divider)",
                background: "var(--placeholder-card-bg)",
                minHeight: 86,
                padding: "14px 16px",
              }}
            >
              <Plus className="w-5 h-5 transition-colors group-hover:text-[var(--text-orange-ui)]" style={{ color: "var(--text-muted)" }} />
              <span className="mt-1 transition-colors group-hover:text-[var(--text-orange-ui)]" style={{ fontSize: 12, fontWeight: 500, color: "var(--text-muted)" }}>Add Brand</span>
            </div>
          ))}
        </div>
      </div>

    </div>
    </div>
  );
}
