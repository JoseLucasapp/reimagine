// ===== DEAL INTELLIGENCE — Pure frontend AI-like features =====

import { DealRecord, DealStatusNew, dealRecords, getDealBrandById } from "@/data/dealsData";

// ===== 1. DEAL HEALTH SCORE =====

export interface DealHealthResult {
  score: number;
  level: "good" | "warning" | "critical";
  reasons: string[];
  lastUpdatedDays: number;
}

const STAGE_BENCHMARKS: Record<DealStatusNew, number> = {
  "Kick Off": 7,
  "Market Study": 14,
  "Site Tours": 10,
  "First LOI(s) Submitted": 21,
  "LOI Negotiations": 21,
  "Lease Negotiations": 30,
  "Signed": 999,
  "On Hold": 999,
};

function daysSince(dateStr: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24)));
}

export function calculateDealHealth(deal: DealRecord): DealHealthResult {
  let score = 100;
  const reasons: string[] = [];

  const lastNoteDate = deal.notes[0]?.date;
  const lastUpdatedDays = lastNoteDate ? daysSince(lastNoteDate) : 999;

  if (lastUpdatedDays <= 7) {
    score += 10;
    reasons.push("Updated within last 7 days");
  }

  if (lastUpdatedDays > 14 && lastUpdatedDays <= 30) {
    score -= 15;
    reasons.push("No update in 14+ days");
  }

  if (lastUpdatedDays > 30) {
    score -= 20;
    reasons.push("No update in 30+ days");
  }

  if (lastUpdatedDays > 30 && deal.status !== "Signed") {
    score -= 10;
    reasons.push("Status unchanged for 30+ days");
  }

  if (!deal.documents.engagementLetter) {
    score -= 15;
    reasons.push("Engagement letter missing");
  }

  if (deal.status === "First LOI(s) Submitted" && deal.dateIntroCall) {
    const daysInPipeline = daysSince(deal.dateIntroCall);
    if (daysInPipeline > 30) {
      score -= 10;
      reasons.push("In LOI stage for 30+ days");
    }
  }

  if (deal.status === "Lease Negotiations" && deal.dateIntroCall) {
    const daysInPipeline = daysSince(deal.dateIntroCall);
    if (daysInPipeline > 45) {
      score -= 10;
      reasons.push("In Lease Negotiations stage for 45+ days");
    }
  }

  score = Math.max(0, Math.min(100, score));
  const level = score >= 75 ? "good" : score >= 40 ? "warning" : "critical";

  return { score, level, reasons, lastUpdatedDays };
}

// ===== 2. AI DEAL SUMMARY (template-based) =====

export function generateDealSummary(deal: DealRecord): string {
  const brand = getDealBrandById(deal.brandId);
  const brandName = brand?.name || "Unknown Brand";
  const lastNote = deal.notes[0];

  const statusDescriptions: Record<DealStatusNew, string> = {
    "Signed": `This ${brandName} deal with ${deal.franchisee} in ${deal.city}, ${deal.state} has been successfully signed.`,
    "Lease Negotiations": `This ${brandName} deal is currently in lease negotiations for ${deal.franchisee} in ${deal.city}, ${deal.state}.`,
    "LOI Negotiations": `LOI negotiations are underway for ${deal.franchisee}'s ${brandName} location in ${deal.city}, ${deal.state}.`,
    "First LOI(s) Submitted": `An LOI has been submitted for ${deal.franchisee}'s ${brandName} location in ${deal.city}, ${deal.state}.`,
    "Site Tours": `Site tours are being conducted for ${deal.franchisee}'s ${brandName} deal in ${deal.city}, ${deal.state}.`,
    "Market Study": `A market study is underway for ${deal.franchisee}'s ${brandName} opportunity in ${deal.city}, ${deal.state}.`,
    "Kick Off": `A kick-off call has been completed with ${deal.franchisee} for a ${brandName} opportunity in ${deal.city}, ${deal.state}.`,
    "On Hold": `This ${brandName} deal with ${deal.franchisee} in ${deal.city}, ${deal.state} is currently on hold.`,
  };

  let summary = statusDescriptions[deal.status];

  if (lastNote) {
    summary += ` The most recent activity (${new Date(lastNote.date).toLocaleDateString()}): "${lastNote.text}"`;
  }

  const nextSteps: Record<DealStatusNew, string> = {
    "Kick Off": "Next step: Initiate market study to identify viable locations in the target area.",
    "Market Study": "Next step: Schedule site tours once the market study identifies suitable locations.",
    "Site Tours": "Next step: Prepare and submit an LOI for the preferred property.",
    "First LOI(s) Submitted": "Next step: Await landlord response and prepare for LOI negotiations.",
    "LOI Negotiations": "Next step: Finalize LOI terms and move toward lease negotiations.",
    "Lease Negotiations": "Next step: Finalize lease terms and move toward execution.",
    "Signed": "Deal complete. Monitor for any post-signing items or additional location opportunities.",
    "On Hold": "Next step: Follow up on the hold reason and determine timeline to reactivate.",
  };

  summary += ` ${nextSteps[deal.status]}`;
  return summary;
}

// ===== 3. SUGGESTED NEXT ACTION =====

export function generateSuggestedAction(deal: DealRecord): string {
  const health = calculateDealHealth(deal);
  const missingDocs: string[] = [];
  if (!deal.documents.engagementLetter) missingDocs.push("engagement letter");
  if (!deal.documents.signedLOI && (deal.status === "First LOI(s) Submitted" || deal.status === "LOI Negotiations" || deal.status === "Lease Negotiations" || deal.status === "Signed")) missingDocs.push("signed LOI");
  if (!deal.documents.floorPlan && (deal.status === "Lease Negotiations" || deal.status === "Signed")) missingDocs.push("floor plan");

  if (health.lastUpdatedDays > 30) {
    return `This deal hasn't been updated in ${health.lastUpdatedDays} days. Reach out to ${deal.franchisee} or the landlord for a status check.`;
  }

  if (missingDocs.length > 0 && deal.status !== "Kick Off") {
    return `Upload the missing ${missingDocs[0]} — this is needed before progressing further.`;
  }

  const actionsByStatus: Record<DealStatusNew, string> = {
    "Kick Off": `Begin the market study for ${deal.city}, ${deal.state} to identify viable locations for ${deal.franchisee}.`,
    "Market Study": `Once the market study is complete, schedule site tours for the top 3-4 locations in ${deal.city}.`,
    "Site Tours": `Prepare the LOI package for ${deal.franchisee}'s preferred property and submit to the landlord.`,
    "First LOI(s) Submitted": `Follow up with the landlord on the LOI response — it has been ${health.lastUpdatedDays} days since the last update.`,
    "LOI Negotiations": `Push to finalize LOI terms with the landlord and prepare for lease negotiations.`,
    "Lease Negotiations": `Push to finalize lease terms. Confirm all tenant improvement allowances and opening timeline with ${deal.franchisee}.`,
    "Signed": `Ensure all post-signing documentation is filed and commission agreement is in place.`,
    "On Hold": `Check in with ${deal.franchisee} on the hold reason. Consider if market conditions have changed enough to re-engage.`,
  };

  return actionsByStatus[deal.status];
}

// ===== 4. PIPELINE FORECAST =====

export interface PipelineForecast {
  confirmed: number;
  confirmedCount: number;
  projected: number;
  projectedCount: number;
  closeRate: number;
  pipelineDeals: number;
}

export function calculatePipelineForecast(): PipelineForecast {
  const signedDeals = dealRecords.filter((d) => d.status === "Signed" && !d.isOneOff);
  const pipelineDeals = dealRecords.filter((d) => (d.status === "First LOI(s) Submitted" || d.status === "LOI Negotiations" || d.status === "Lease Negotiations") && !d.isOneOff);

  const confirmed = signedDeals.reduce((sum, d) => sum + d.estimatedCommission, 0);
  const projected = pipelineDeals.reduce((sum, d) => sum + d.estimatedCommission, 0) * 0.65;

  return {
    confirmed,
    confirmedCount: signedDeals.length,
    projected: Math.round(projected),
    projectedCount: pipelineDeals.length,
    closeRate: 0.65,
    pipelineDeals: pipelineDeals.length,
  };
}

// ===== 5. DUPLICATE DETECTION =====

export interface DuplicateWarning {
  type: "franchisee" | "brand-city";
  existingDeal: DealRecord;
  message: string;
}

export function checkDuplicateDeal(
  franchisee: string,
  brandId: string,
  city: string,
  excludeDealId?: string
): DuplicateWarning | null {
  const existing = dealRecords.find(
    (d) =>
      d.id !== excludeDealId &&
      d.franchisee.toLowerCase() === franchisee.toLowerCase() &&
      d.brandId === brandId
  );

  if (existing) {
    const brand = getDealBrandById(existing.brandId);
    return {
      type: "franchisee",
      existingDeal: existing,
      message: `${existing.franchisee} already has an active ${brand?.name} deal in ${existing.city} opened on ${existing.dateIntroCall ? new Date(existing.dateIntroCall).toLocaleDateString() : "N/A"}. Is this a new location?`,
    };
  }

  const cityMatch = dealRecords.find(
    (d) =>
      d.id !== excludeDealId &&
      d.brandId === brandId &&
      d.city.toLowerCase() === city.toLowerCase()
  );

  if (cityMatch) {
    const brand = getDealBrandById(cityMatch.brandId);
    return {
      type: "brand-city",
      existingDeal: cityMatch,
      message: `${brand?.name} already has a deal in ${cityMatch.city} with ${cityMatch.franchisee} (${cityMatch.status}). Is this a new location?`,
    };
  }

  return null;
}

// ===== 6. BIZ DEV FOLLOW-UP INTELLIGENCE =====

import { BizDevRecord, bizDevRecords } from "@/data/bizDevData";

export interface FollowUpItem {
  record: BizDevRecord;
  reason: string;
  daysSinceContact: number;
  suggestion: string;
}

const CATEGORY_SUGGESTIONS: Record<string, string> = {
  "F&B": "Consider re-engaging with updated market study for their target territory and demographic analysis.",
  "Fitness": "Share recent successful fitness brand placements and current market availability in their target areas.",
  "Beauty": "Highlight trending beauty/wellness corridors with strong foot traffic data in their preferred markets.",
  "Health & Wellness": "Present new medical-retail hybrid spaces that are increasingly popular for wellness brands.",
  "Entertainment": "Showcase entertainment district developments and high-traffic venue locations.",
  "Pet Related": "Share growing pet services market data and co-tenancy opportunities near pet-friendly anchors.",
  "Medical": "Present available medical office spaces and healthcare corridor developments.",
  "Service": "Highlight service-oriented retail locations with strong residential density nearby.",
  "Automotive": "Present high-visibility automotive corridor locations with excellent ingress/egress.",
  "Education": "Share locations near residential communities with strong family demographics.",
  "Soft Goods": "Highlight retail spaces in lifestyle centers with compatible co-tenants.",
};

export function getFollowUpQueue(): FollowUpItem[] {
  const items: FollowUpItem[] = [];
  const now = Date.now();

  for (const r of bizDevRecords) {
    if (!r.reachOut4 && r.reachOut3) {
      const daysSince3rd = Math.round((now - new Date(r.reachOut3).getTime()) / (1000 * 60 * 60 * 24));
      if (daysSince3rd >= 14) {
        items.push({
          record: r,
          reason: `4th outreach pending — last contact ${daysSince3rd} days ago`,
          daysSinceContact: daysSince3rd,
          suggestion: CATEGORY_SUGGESTIONS[r.category] || "Follow up with an updated value proposition.",
        });
        continue;
      }
    }

    if (r.status === "1 - In-Active Client") {
      const daysSinceAdded = Math.round((now - new Date(r.dateAdded).getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceAdded <= 90) {
        const lastContact = r.reachOut4 || r.reachOut3 || r.reachOut2 || r.reachOut1 || r.dateAdded;
        const dsc = Math.round((now - new Date(lastContact).getTime()) / (1000 * 60 * 60 * 24));
        items.push({
          record: r,
          reason: `Recently inactive — added ${daysSinceAdded} days ago`,
          daysSinceContact: dsc,
          suggestion: CATEGORY_SUGGESTIONS[r.category] || "Consider re-engaging with a fresh approach.",
        });
      }
    }
  }

  return items.sort((a, b) => b.daysSinceContact - a.daysSinceContact);
}

// ===== 7. DEAL NUDGES FOR DASHBOARD =====

export interface DealNudgeItem {
  type: "deal";
  id: string;
  title: string;
  suggestion: string;
  action: string;
  actionUrl: string;
}

export function getDealNudges(): DealNudgeItem[] {
  const items: DealNudgeItem[] = [];
  const activeDeals = dealRecords.filter((d) => !d.isOneOff && d.status !== "Signed");

  for (const deal of activeDeals) {
    const brand = getDealBrandById(deal.brandId);
    const brandName = brand?.name || "Unknown";
    const health = calculateDealHealth(deal);
    const timeInStage = getTimeInStage(deal);
    const benchmark = STAGE_BENCHMARKS[deal.status];

    if (benchmark < 999 && timeInStage > benchmark * 1.5) {
      const ratio = (timeInStage / benchmark).toFixed(1);
      items.push({
        type: "deal",
        id: deal.id,
        title: `${brandName} — ${deal.city}, ${deal.state}`,
        suggestion: `${deal.status} stage for ${timeInStage} days — ${ratio}× above average. Consider following up on the ${deal.status === "First LOI(s) Submitted" ? "counter-LOI with the landlord" : "next steps with " + deal.franchisee}.`,
        action: "Log Update →",
        actionUrl: `/deals/${deal.id}`,
      });
      continue;
    }

    if (!deal.documents.engagementLetter && deal.status !== "Kick Off") {
      items.push({
        type: "deal",
        id: deal.id,
        title: `${brandName} — ${deal.city}, ${deal.state}`,
        suggestion: `Engagement letter has not been filed. This deal cannot advance to LOI without it on record.`,
        action: "Upload Document →",
        actionUrl: `/deals/${deal.id}`,
      });
      continue;
    }

    if (health.lastUpdatedDays >= 7 && health.lastUpdatedDays <= 20 && deal.status === "Site Tours") {
      items.push({
        type: "deal",
        id: deal.id,
        title: `${brandName} — ${deal.city}, ${deal.state}`,
        suggestion: `Franchisee toured ${deal.storeCount} properties ${health.lastUpdatedDays} days ago — no update logged since. Follow up on site preference.`,
        action: "Add Note →",
        actionUrl: `/deals/${deal.id}`,
      });
      continue;
    }
  }

  return items.sort((a, b) => a.title.localeCompare(b.title)).slice(0, 4);
}

// ===== 8. STAGE TIMING =====

export function getTimeInStage(deal: DealRecord): number {
  const lastNote = deal.notes[0];
  if (!lastNote) return deal.dateIntroCall ? daysSince(deal.dateIntroCall) : 0;
  return daysSince(lastNote.date);
}

export function getStageBenchmark(status: DealStatusNew): number {
  return STAGE_BENCHMARKS[status];
}

export function getStageTimingColor(deal: DealRecord): "green" | "amber" | "red" {
  if (deal.status === "Signed" || deal.status === "On Hold") return "green";
  const time = getTimeInStage(deal);
  const benchmark = STAGE_BENCHMARKS[deal.status];
  if (time <= benchmark) return "green";
  if (time <= benchmark * 1.5) return "amber";
  return "red";
}
