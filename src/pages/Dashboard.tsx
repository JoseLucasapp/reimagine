import { useCallback, useEffect, useMemo, useState } from "react";
import aiNudgeIcon from "@/assets/ai-nudge-icon.png";
import { useNavigate } from "react-router-dom";
import {
  Building2, Handshake, CheckCircle2, Clock, PauseCircle,
  ArrowRight, Plus, RefreshCw,
} from "lucide-react";
import type { DealStatus, RecentActivity } from "@/data/dashboardData";
import { dealRecords, getDealBrandById, KANBAN_COLUMNS, type DealRecord } from "@/data/dealsData";
import { cn } from "@/lib/utils";
import { getDealNudges } from "@/lib/dealIntelligence";
import { useRuntimeDataVersion } from "@/application/data/runtimeStore";
import { generateAiInsight, getLatestAiInsight } from "@/application/ai/aiService";
import { getVisibleDealsForUser, useScopedUser, useUserRole } from "@/hooks/useUserRole";

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

type DashboardStats = {
  totalActiveBrands: number;
  totalDeals: number;
  dealsSigned: number;
  dealsInProgress: number;
  dealsOnHold: number;
  totalCommission: number;
};

type BrandSummary = {
  id: string;
  name: string;
  logoColor: string;
  activeDeals: number;
  totalSites: number;
  stages: DealStatus[];
};

const statCardConfig: {
  key: keyof DashboardStats;
  label: string;
  icon: React.ElementType;
  isCurrency?: boolean;
}[] = [
  { key: "totalActiveBrands", label: "Active Brands", icon: Building2 },
  { key: "totalDeals", label: "Total Deals", icon: Handshake },
  { key: "dealsSigned", label: "Deals Signed", icon: CheckCircle2 },
  { key: "dealsInProgress", label: "In Progress", icon: Clock },
  { key: "dealsOnHold", label: "On Hold", icon: PauseCircle },
];

const STATUS_BAR_COLORS: Record<string, string> = {
  "Signed": "#10b981", "Lease Negotiations": "#3b82f6",
  "Market Study": "#8b5cf6", "Site Tours": "#14b8a6", "LOI Negotiations": "#6366f1",
  "Kick Off": "#94a3b8", "On Hold": "#E18739",
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
  "Signed": "pill-signed", "Lease Negotiations": "pill-leases",
  "Market Study": "pill-market-study", "Site Tours": "pill-prop-tour",
  "On Hold": "pill-on-hold", "Kick Off": "pill-intro-call", "LOI Negotiations": "pill-loi-neg",
};

const STAGE_AVERAGES: Record<string, number> = {
  "Kick Off": 7, "Market Study": 14, "Site Tours": 10, "LOI Negotiations": 21, "Lease Negotiations": 30,
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

function parseDashboardDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getDealActivityDate(deal: DealRecord): Date | null {
  return (
    parseDashboardDate(deal.notes[0]?.date)
    ?? parseDashboardDate(deal.dateLeaseSigned)
    ?? parseDashboardDate(deal.dateIntroCall)
  );
}

function isSameMonth(date: Date | null, reference = new Date()): boolean {
  if (!date) return false;
  return date.getFullYear() === reference.getFullYear() && date.getMonth() === reference.getMonth();
}

function isSameWeek(date: Date | null, reference = new Date()): boolean {
  if (!date) return false;

  const start = new Date(reference);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());

  const end = new Date(start);
  end.setDate(start.getDate() + 7);

  return date >= start && date < end;
}

type DashboardMonthlyStats = Record<keyof DashboardStats, number>;

function getScopedDashboardStats(deals: DealRecord[]): DashboardStats {
  const active = deals.filter((deal) => !deal.isOneOff);
  return {
    totalActiveBrands: new Set(active.map((deal) => deal.brandId)).size,
    totalDeals: active.length,
    dealsSigned: active.filter((deal) => deal.status === "Signed").length,
    dealsInProgress: active.filter((deal) => deal.status !== "Signed" && deal.status !== "On Hold").length,
    dealsOnHold: active.filter((deal) => deal.status === "On Hold").length,
    totalCommission: active.reduce((sum, deal) => sum + deal.estimatedCommission, 0),
  };
}

function getScopedRecentActivity(deals: DealRecord[]): RecentActivity[] {
  return deals
    .filter((deal) => !deal.isOneOff)
    .map((deal) => {
      const brand = getDealBrandById(deal.brandId);
      const lastNote = deal.notes[0];
      return {
        id: deal.id,
        brandName: brand?.name ?? "Unknown",
        franchiseeName: deal.franchisee,
        location: `${deal.city}, ${deal.state}`,
        status: deal.status,
        lastNote: lastNote?.text || "",
        date: lastNote?.date || deal.dateLeaseSigned || deal.dateIntroCall || "",
      };
    })
    .sort((a, b) => (new Date(b.date).getTime() || 0) - (new Date(a.date).getTime() || 0))
    .slice(0, 10);
}

function getScopedDealsByStatusCounts(deals: DealRecord[]): { status: DealStatus; count: number }[] {
  const counts: Record<string, number> = {};
  KANBAN_COLUMNS.forEach((status) => { counts[status] = 0; });
  deals.filter((deal) => !deal.isOneOff).forEach((deal) => {
    counts[deal.status] = (counts[deal.status] || 0) + 1;
  });
  return KANBAN_COLUMNS.map((status) => ({ status, count: counts[status] || 0 }));
}

function getScopedBrandSummaries(deals: DealRecord[]): BrandSummary[] {
  const activeDeals = deals.filter((deal) => !deal.isOneOff);
  const brandIds = Array.from(new Set(activeDeals.map((deal) => deal.brandId)));
  return brandIds.map((brandId) => {
    const brand = getDealBrandById(brandId);
    const brandDeals = activeDeals.filter((deal) => deal.brandId === brandId);
    return {
      id: brandId,
      name: brand?.name ?? "Unknown",
      logoColor: brand?.logoColor ?? "#243c51",
      activeDeals: brandDeals.length,
      totalSites: brandDeals.reduce((sum, deal) => sum + deal.storeCount, 0),
      stages: [...new Set(brandDeals.map((deal) => deal.status))],
    };
  });
}

function getMonthlyDashboardStats(deals: DealRecord[]): DashboardMonthlyStats {
  const activeDeals = deals.filter((deal) => !deal.isOneOff);
  const dealsOpenedThisMonth = activeDeals.filter((deal) => isSameMonth(parseDashboardDate(deal.dateIntroCall)));
  const signedThisMonth = activeDeals.filter((deal) => deal.status === "Signed" && isSameMonth(parseDashboardDate(deal.dateLeaseSigned)));
  const inProgressThisMonth = activeDeals.filter((deal) => {
    if (deal.status === "Signed" || deal.status === "On Hold") return false;
    return isSameMonth(getDealActivityDate(deal));
  });
  const onHoldThisMonth = activeDeals.filter((deal) => deal.status === "On Hold" && isSameMonth(getDealActivityDate(deal)));
  const activeBrandIdsThisMonth = new Set(
    activeDeals
      .filter((deal) => isSameMonth(getDealActivityDate(deal)))
      .map((deal) => deal.brandId),
  );

  return {
    totalActiveBrands: activeBrandIdsThisMonth.size,
    totalDeals: dealsOpenedThisMonth.length,
    dealsSigned: signedThisMonth.length,
    dealsInProgress: inProgressThisMonth.length,
    dealsOnHold: onHoldThisMonth.length,
    totalCommission: signedThisMonth.reduce((sum, deal) => sum + deal.estimatedCommission, 0),
  };
}

function formatMonthlyStatTrend(value: number): string {
  return value > 0 ? `↑ ${value} this mo` : "0 this mo";
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
  "LOI Negotiations": "LOI Negotiations",
  "Lease Negotiations": "Leases",
  Signed: "Signed",
  "On Hold": "On-Hold",
};

const DASHBOARD_AI_ENTITY_ID = "00000000-0000-0000-0000-000000000001";

type DashboardNudgeCard = {
  id: string;
  brand: string;
  location: string;
  suggestion: string;
  action: string;
  url: string;
  urgency?: "low" | "normal" | "high";
  source: "ai" | "fallback";
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function textValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function urgencyValue(value: unknown): "low" | "normal" | "high" | undefined {
  if (value === "low" || value === "normal" || value === "high") return value;
  return undefined;
}

function normalizeAiDashboardNudges(output: unknown): DashboardNudgeCard[] {
  if (!isRecord(output) || !Array.isArray(output.nudges)) return [];

  return output.nudges
    .filter(isRecord)
    .map((nudge, index) => {
      const dealId = textValue(nudge.dealId) || textValue(nudge.deal_id);
      const title = textValue(nudge.title);
      const brand = textValue(nudge.brand) || title.split(" — ")[0] || "Deal";
      const suggestion = textValue(nudge.suggestion) || textValue(nudge.summary);
      const action = textValue(nudge.action) || "Review Deal →";
      const rawUrl = textValue(nudge.actionUrl) || textValue(nudge.action_url) || textValue(nudge.url);

      return {
        id: `ai-dashboard-nudge-${dealId || index}`,
        brand,
        location: textValue(nudge.location),
        suggestion,
        action,
        url: rawUrl || (dealId ? `/deals/${dealId}` : "/deals"),
        urgency: urgencyValue(nudge.urgency),
        source: "ai" as const,
      };
    })
    .filter((nudge) => nudge.suggestion.length > 0)
    .slice(0, 4);
}

export default function Dashboard() {
  const navigate = useNavigate();
  const runtimeDataVersion = useRuntimeDataVersion();
  const role = useUserRole();
  const user = useScopedUser();
  const dashboardDeals = useMemo(() => {
    void runtimeDataVersion;
    const activeDeals = dealRecords.filter((deal) => !deal.isOneOff);
    if (role === "admin") return activeDeals;
    return getVisibleDealsForUser(user ?? role, activeDeals);
  }, [role, runtimeDataVersion, user]);
  const stats = useMemo(() => getScopedDashboardStats(dashboardDeals), [dashboardDeals]);
  const monthlyStats = useMemo(() => getMonthlyDashboardStats(dashboardDeals), [dashboardDeals]);
  const recentActivity = useMemo(() => getScopedRecentActivity(dashboardDeals), [dashboardDeals]);
  const statusCounts = useMemo(() => getScopedDealsByStatusCounts(dashboardDeals), [dashboardDeals]);
  const brandSummaries = useMemo(() => getScopedBrandSummaries(dashboardDeals), [dashboardDeals]);

  const pipelineStages = useMemo(() => statusCounts.map(({ status, count }) => {
    const stageDeals = dashboardDeals.filter((deal) => deal.status === status && !deal.isOneOff);
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
  }), [dashboardDeals, statusCounts]);

  const pipelineTotal = pipelineStages.reduce((total, stage) => total + stage.count, 0);

  const fallbackDashboardNudges = useMemo<DashboardNudgeCard[]>(() => {
    const visibleDealIds = new Set(dashboardDeals.map((deal) => deal.id));
    return getDealNudges()
      .filter((item) => visibleDealIds.has(item.id))
      .slice(0, 4)
      .map((item) => {
        const deal = dashboardDeals.find((record) => record.id === item.id);
        return {
          id: `fallback-nudge-${item.id}`,
          brand: item.title.split(" — ")[0] ?? "Deal",
          location: deal ? `${deal.city}, ${deal.state}` : "",
          suggestion: item.suggestion,
          action: item.action,
          url: item.actionUrl,
          source: "fallback",
        };
      });
  }, [dashboardDeals]);

  const [aiDashboardNudges, setAiDashboardNudges] = useState<DashboardNudgeCard[] | null>(null);
  const [dashboardAiLoading, setDashboardAiLoading] = useState(false);
  const [dashboardAiError, setDashboardAiError] = useState<string | null>(null);

  const loadDashboardAiNudges = useCallback(async (force = false) => {
    setDashboardAiLoading(true);
    setDashboardAiError(null);

    try {
      const insight = force
        ? await generateAiInsight({
          type: "dashboard_nudge",
          entityType: "dashboard",
          entityId: DASHBOARD_AI_ENTITY_ID,
          force: true,
        })
        : (await getLatestAiInsight("dashboard_nudge", DASHBOARD_AI_ENTITY_ID, "dashboard"))
          ?? await generateAiInsight({
            type: "dashboard_nudge",
            entityType: "dashboard",
            entityId: DASHBOARD_AI_ENTITY_ID,
          });

      const cards = normalizeAiDashboardNudges(insight.output);
      if (!cards.length) throw new Error("AI returned no dashboard nudges.");
      setAiDashboardNudges(cards);
    } catch (error) {
      console.error("Dashboard AI nudges failed", error);
      setAiDashboardNudges(null);
      setDashboardAiError("Using rules fallback until AI is available.");
    } finally {
      setDashboardAiLoading(false);
    }
  }, []);

  useEffect(() => {
    if (role !== "admin") {
      setAiDashboardNudges(null);
      setDashboardAiError(null);
      return;
    }
    void loadDashboardAiNudges(false);
  }, [loadDashboardAiNudges, role, runtimeDataVersion]);

  const dashboardNudges = role === "admin" && aiDashboardNudges?.length ? aiDashboardNudges : fallbackDashboardNudges;

  const forecast = useMemo(() => {
    const active = dashboardDeals.filter((deal) => !deal.isOneOff);
    const signedDeals = active.filter((deal) => deal.status === "Signed");
    const onHoldDeals = active.filter((deal) => deal.status === "On Hold");
    const pipelineDeals = active.filter((deal) =>
      ["LOI Negotiations", "Lease Negotiations"].includes(deal.status),
    );

    const closedOutcomeCount = signedDeals.length + onHoldDeals.length;
    const closeRate = closedOutcomeCount > 0 ? Math.round((signedDeals.length / closedOutcomeCount) * 100) : 0;
    const confirmed = signedDeals.reduce((sum, deal) => sum + deal.estimatedCommission, 0);
    const confirmedThisWeek = signedDeals
      .filter((deal) => isSameWeek(parseDashboardDate(deal.dateLeaseSigned)))
      .reduce((sum, deal) => sum + deal.estimatedCommission, 0);
    const projected = pipelineDeals.reduce((sum, deal) => sum + deal.estimatedCommission, 0) * (closeRate / 100);

    return {
      confirmed,
      confirmedThisWeek,
      closeRate,
      projected: Math.round(projected),
      pipelineCount: pipelineDeals.length,
    };
  }, [dashboardDeals]);

  const fcTotal = forecast.confirmed + forecast.projected;
  const fcConfPct = fcTotal > 0 ? (forecast.confirmed / fcTotal) * 100 : 50;

  const chartRows = useMemo(() => {
    const signed = statusCounts.find((s) => s.status === "Signed")?.count || 0;
    const inProgress = statusCounts.filter((s) => ["Lease Negotiations", "Site Tours"].includes(s.status)).reduce((a, s) => a + s.count, 0);
    const loi = statusCounts.find((s) => s.status === "LOI Negotiations")?.count || 0;
    const mktStudy = statusCounts.find((s) => s.status === "Market Study")?.count || 0;
    const onHold = statusCounts.find((s) => s.status === "On Hold")?.count || 0;
    const kickOff = statusCounts.find((s) => s.status === "Kick Off")?.count || 0;
    return [
      { label: "Signed", count: signed, key: "Signed" },
      { label: "In Progress", count: inProgress, key: "In Progress" },
      { label: "LOI Negotiations", count: loi, key: "LOI Negotiations" },
      { label: "Mkt Study", count: mktStudy, key: "Market Study" },
      { label: "On-Hold", count: onHold, key: "On Hold" },
      { label: "Intro Call", count: kickOff, key: "Kick Off" },
    ];
  }, [statusCounts]);

  const chartMax = Math.max(...chartRows.map((r) => r.count), 1);
  const chartTotal = chartRows.reduce((a, r) => a + r.count, 0);
  const chartValueRows = useMemo(() => {
    const valueFor = (statuses: string[]) => dashboardDeals
      .filter((deal) => statuses.includes(deal.status) && !deal.isOneOff)
      .reduce((sum, deal) => sum + deal.estimatedCommission, 0);
    return [
      { label: "Signed", value: valueFor(["Signed"]), key: "Signed" },
      { label: "In Progress", value: valueFor(["Lease Negotiations", "Site Tours"]), key: "In Progress" },
      { label: "LOI Negotiations", value: valueFor(["LOI Negotiations"]), key: "LOI Negotiations" },
      { label: "Mkt Study", value: valueFor(["Market Study"]), key: "Market Study" },
      { label: "On-Hold", value: valueFor(["On Hold"]), key: "On Hold" },
      { label: "Intro Call", value: valueFor(["Kick Off"]), key: "Kick Off" },
    ];
  }, [dashboardDeals]);
  const chartValueMax = Math.max(...chartValueRows.map((row) => row.value), 1);
  const chartValueTotal = chartValueRows.reduce((sum, row) => sum + row.value, 0);

  const brandCards = useMemo(() => {
    return brandSummaries.map((brand) => {
      const brandDeals = dashboardDeals.filter((d) => d.brandId === brand.id && !d.isOneOff);
      const stageCounts: Record<string, number> = {};
      brandDeals.forEach((d) => { stageCounts[d.status] = (stageCounts[d.status] || 0) + 1; });
      return { ...brand, stageCounts };
    });
  }, [brandSummaries, dashboardDeals]);

  const formatCurrency = (val: number) => {
    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `${Math.round(val / 1000)}K`;
    return `${val}`;
  };

  const totalActiveDeals = dashboardDeals.filter((d) => !d.isOneOff).length;

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
        <div className="flex items-center justify-between gap-3" style={{ marginBottom: 14 }}>
          <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-muted)" }}>
            ⚡ AI Follow-Up Queue
            {dashboardAiError ? <span style={{ marginLeft: 8, letterSpacing: "0", textTransform: "none", color: "var(--text-tertiary)" }}>{dashboardAiError}</span> : null}
          </span>
          {role === "admin" && (
            <button
              type="button"
              onClick={() => void loadDashboardAiNudges(true)}
              disabled={dashboardAiLoading}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold transition-opacity hover:opacity-75 disabled:cursor-not-allowed disabled:opacity-60"
              style={{ borderColor: "var(--border-subtle)", color: "var(--text-primary)", background: "var(--bg-surface)" }}
            >
              <RefreshCw className={cn("h-3 w-3", dashboardAiLoading && "animate-spin")} />
              {dashboardAiLoading ? "Generating" : "Regenerate AI"}
            </button>
          )}
        </div>
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
                   <img src={aiNudgeIcon} alt="" style={{ width: 12, height: 12 }} /> {card.source === "ai" ? "AI Nudge" : "AI Fallback"}
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
                  {formatMonthlyStatTrend(monthlyStats[cfg.key])}
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
              const deal = dashboardDeals.find((d) => d.id === activity.id);
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
                      {parseDashboardDate(activity.date)?.toLocaleDateString("en-US", { month: "numeric", day: "numeric" }) ?? "—"}
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
                  <span className="shrink-0" style={{ width: 128, fontSize: 12, fontWeight: 500, lineHeight: 1.15, color: "var(--text-tertiary)" }}>{row.label}</span>
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
                <p style={{ fontSize: 12, fontWeight: 500, color: "var(--status-signed-text)", marginTop: 3 }}>+${formatCurrency(forecast.confirmedThisWeek)} this week</p>
              </div>
              <div style={{ width: 1, background: "var(--border-divider)", margin: "0 16px 0 0" }} />
              <div className="flex-1">
                <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--status-loi-text)", marginBottom: 3 }}>Projected</p>
                <p style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em", lineHeight: 1 }}>
                  ${formatCurrency(forecast.projected).replace("$", "")}
                </p>
                <p style={{ fontSize: 12, fontWeight: 400, color: "var(--text-muted)", marginTop: 3 }}>at {forecast.closeRate}% close rate</p>
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

          {/* Card C: Pipeline Value by Status */}
          <div style={{ ...glassCard, padding: "16px 20px" }}>
            <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.10em", textTransform: "uppercase" as const, color: "var(--text-muted)", marginBottom: 8, display: "block" }}>
              Pipeline Value by Status
            </span>
            {chartValueRows.map((row) => {
              const pct = Math.max((row.value / chartValueMax) * 100, row.value > 0 ? 4 : 0);
              return (
                <div key={row.key} className="flex items-center gap-2.5" style={{ marginBottom: 9 }}>
                  <span className="shrink-0" style={{ width: 128, fontSize: 12, fontWeight: 500, lineHeight: 1.15, color: "var(--text-tertiary)" }}>{row.label}</span>
                  <div className="flex-1 overflow-hidden" style={{ height: 8, background: "var(--border-divider)", borderRadius: 4 }}>
                    <div className="h-full transition-all duration-500" style={{ width: `${pct}%`, background: "#E18739", borderRadius: 4 }} />
                  </div>
                  <span className="shrink-0 text-right" style={{ width: 72, fontSize: 14, fontWeight: 700, color: "var(--stat-value-color)" }}>
                    ${formatCurrency(row.value).replace("$", "")}
                  </span>
                </div>
              );
            })}
            <div style={{ borderTop: "1px solid var(--border-divider)", marginTop: 2, paddingTop: 8 }}>
              <div className="flex items-center justify-between">
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  ${formatCurrency(chartValueTotal).replace("$", "")} total value
                </span>
                <button onClick={() => navigate("/deals")} style={{ fontSize: 12, fontWeight: 600, color: "var(--text-orange-ui)" }} className="hover:opacity-75 transition-opacity">
                  View Deals →
                </button>
              </div>
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
                <div className="flex flex-wrap gap-1" style={{ marginTop: 8, maxHeight: 48, overflow: "hidden" }}>
                  {pillEntries.slice(0, 4).map(([stage, count]) => {
                    const shortLabels: Record<string, string> = { "Signed": "Signed", "Lease Negotiations": "Leases", "LOI Negotiations": "LOI Negotiations", "Market Study": "Mkt Study", "Site Tours": "Tour", "On Hold": "On-hold", "Kick Off": "Intro" };
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
