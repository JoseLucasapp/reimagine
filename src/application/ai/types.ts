import type { JsonObject, JsonValue } from "@/infrastructure/supabase/client";

export type AiInsightType =
  | "deal_summary"
  | "suggested_action"
  | "property_insight"
  | "dashboard_nudge"
  | "bizdev_follow_up"
  | "tour_book_draft";

export type AiInsightEntityType = "brand" | "deal" | "site" | "dashboard";
export type AiFeedbackRating = "up" | "down";

export type AiInsightOutput = {
  summary?: string;
  action?: string;
  urgency?: "low" | "normal" | "high";
  risks?: string[];
  nextActions?: string[];
  missingData?: string[];
  fitScore?: number;
  matches?: string[];
  recommendedNextAction?: string;
  nudges?: JsonObject[];
  confidence?: "low" | "medium" | "high";
  [key: string]: JsonValue | undefined;
};

export type AiInsight = {
  id: string;
  insightType: AiInsightType;
  entityType: AiInsightEntityType;
  entityId: string;
  promptVersion: string;
  inputHash: string;
  output: AiInsightOutput;
  model: string | null;
  status: "completed" | "failed";
  createdAt: string;
  updatedAt: string;
};

export type GenerateAiInsightInput = {
  type: AiInsightType;
  entityId: string;
  entityType?: AiInsightEntityType;
  force?: boolean;
  context?: JsonObject;
};
