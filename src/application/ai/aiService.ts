import { getStoredSession } from "@/application/auth/session";
import { createSelectQuery, supabaseFunctionRequest, supabaseRequest, type JsonObject } from "@/infrastructure/supabase/client";
import type { AiFeedbackRating, AiInsight, AiInsightEntityType, AiInsightOutput, AiInsightType, GenerateAiInsightInput } from "./types";

type AiInsightRow = {
  id: string;
  insight_type: AiInsightType;
  entity_type: AiInsightEntityType;
  entity_id: string;
  prompt_version: string;
  input_hash: string;
  output: AiInsightOutput;
  model: string | null;
  status: "completed" | "failed";
  created_at: string;
  updated_at: string;
};

type GenerateAiInsightResponse = {
  insight: AiInsightRow;
  cached?: boolean;
};

type AiFeedbackRow = {
  rating: AiFeedbackRating;
};

function accessToken(): string | null {
  return getStoredSession()?.accessToken ?? null;
}

function currentUserId(): string | null {
  const token = accessToken();
  const payload = token?.split(".")[1];
  if (!payload) return null;

  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const decoded = JSON.parse(globalThis.atob(padded)) as { sub?: unknown };
    return typeof decoded.sub === "string" ? decoded.sub : null;
  } catch {
    return null;
  }
}

function mapInsight(row: AiInsightRow): AiInsight {
  return {
    id: row.id,
    insightType: row.insight_type,
    entityType: row.entity_type,
    entityId: row.entity_id,
    promptVersion: row.prompt_version,
    inputHash: row.input_hash,
    output: row.output,
    model: row.model,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getLatestAiInsight(type: AiInsightType, entityId: string, entityType: AiInsightEntityType = "deal"): Promise<AiInsight | null> {
  const query = createSelectQuery("*");
  query.set("insight_type", `eq.${type}`);
  query.set("entity_type", `eq.${entityType}`);
  query.set("entity_id", `eq.${entityId}`);
  query.set("status", "eq.completed");
  query.set("order", "created_at.desc");
  query.set("limit", "1");

  const rows = await supabaseRequest<AiInsightRow[]>("/rest/v1/ai_insights", {
    query,
    accessToken: accessToken(),
  });

  return rows[0] ? mapInsight(rows[0]) : null;
}

export async function generateAiInsight(input: GenerateAiInsightInput): Promise<AiInsight> {
  const result = await supabaseFunctionRequest<GenerateAiInsightResponse>(
    "generate-ai-insight",
    {
      type: input.type,
      entityType: input.entityType ?? "deal",
      entityId: input.entityId,
      force: input.force ?? false,
      context: input.context ?? {},
    } satisfies JsonObject,
    accessToken(),
  );

  return mapInsight(result.insight);
}

export async function getLatestAiFeedbackRating(insightId: string): Promise<AiFeedbackRating | null> {
  const userId = currentUserId();
  if (!userId) return null;

  const query = createSelectQuery("rating");
  query.set("insight_id", `eq.${insightId}`);
  query.set("user_id", `eq.${userId}`);
  query.set("order", "created_at.desc");
  query.set("limit", "1");

  const rows = await supabaseRequest<AiFeedbackRow[]>("/rest/v1/ai_feedback", {
    query,
    accessToken: accessToken(),
  });

  return rows[0]?.rating ?? null;
}

export async function submitAiFeedback(insightId: string, rating: AiFeedbackRating, comment?: string): Promise<void> {
  await supabaseRequest("/rest/v1/ai_feedback", {
    method: "POST",
    body: {
      insight_id: insightId,
      rating,
      comment: comment ?? null,
    },
    accessToken: accessToken(),
  });
}
