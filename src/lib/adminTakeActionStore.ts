import { getStoredSession } from "@/application/auth/session";
import { dealBrands, getDealBrandById, getDealRecordById } from "@/data/dealsData";
import type { TakeActionAudience, TakeActionStatus } from "@/domain/entities";
import { SupabaseHttpError, supabaseRequest, type JsonObject } from "@/infrastructure/supabase/client";

export type AdminActionSource = "deal" | "brand";
export type AdminActionStatus = TakeActionStatus | "pending";

export interface AdminTakeActionItem {
  id: string;
  source: AdminActionSource;
  sourceLabel: string;
  contextId: string;
  contextName: string;
  contextHref: string;
  title: string;
  body: string;
  status: AdminActionStatus;
  requestedBy: string;
  recipients: string[];
  audience?: TakeActionAudience;
  urgency?: string;
  timestamp: string;
  updatedAt?: string;
  responseBody?: string | null;
  respondedBy?: string | null;
  respondedAt?: string | null;
}

type TakeActionRow = {
  id: string;
  deal_id: string;
  audience: TakeActionAudience;
  status: TakeActionStatus;
  title: string;
  body: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  response_body?: string | null;
  responded_by?: string | null;
  responded_at?: string | null;
};

type BrandActionRow = {
  id: string;
  brand_id: string;
  deal_name: string | null;
  action_type_key: string;
  action_type_label: string;
  recipients: string[] | null;
  message: string | null;
  urgency: string;
  requested_by: string;
  status: "pending" | "resolved";
  created_at: string;
  updated_at?: string;
  response_body?: string | null;
  responded_by?: string | null;
  responded_at?: string | null;
};

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  username: string | null;
};

type LoadAllOptions = {
  includeDealActions?: boolean;
  includeBrandActions?: boolean;
};

function accessToken(): string {
  const token = getStoredSession()?.accessToken;
  if (!token) throw new Error("Session expired. Log in again before saving changes.");
  return token;
}

function currentProfileId(): string | null {
  return getStoredSession()?.profile.id ?? null;
}

function isMissingTable(error: unknown): boolean {
  return error instanceof SupabaseHttpError && error.status === 404;
}

function isMissingResponseColumns(error: unknown): boolean {
  if (!(error instanceof SupabaseHttpError) || error.status !== 400) return false;
  const details = JSON.stringify(error.details).toLowerCase();
  return (
    details.includes("response_body") ||
    details.includes("responded_by") ||
    details.includes("responded_at") ||
    details.includes("schema cache") ||
    details.includes("column")
  );
}

function missingResponseColumnsError(): Error {
  return new Error("Take Action response columns are missing. Run supabase/add-take-action-responses.sql before saving admin responses.");
}

function profileLabel(profile: ProfileRow | undefined, fallback = "Unknown user"): string {
  if (!profile) return fallback;
  return profile.full_name || profile.username || profile.email || fallback;
}

function mapDealRow(row: TakeActionRow, profiles: Map<string, ProfileRow>): AdminTakeActionItem {
  const deal = getDealRecordById(row.deal_id);
  const brand = deal ? getDealBrandById(deal.brandId) : undefined;
  const contextName = deal
    ? `${brand?.name ? `${brand.name} - ` : ""}${deal.name ?? deal.franchisee}`
    : `Deal ${row.deal_id}`;

  return {
    id: row.id,
    source: "deal",
    sourceLabel: "Deal",
    contextId: row.deal_id,
    contextName,
    contextHref: `/deals/${row.deal_id}`,
    title: row.title,
    body: row.body,
    status: row.status,
    requestedBy: row.created_by ? profileLabel(profiles.get(row.created_by), row.created_by) : "Unknown user",
    recipients: [row.audience],
    audience: row.audience,
    timestamp: row.created_at,
    updatedAt: row.updated_at,
    responseBody: row.response_body ?? null,
    respondedBy: row.responded_by ? profileLabel(profiles.get(row.responded_by), row.responded_by) : null,
    respondedAt: row.responded_at ?? null,
  };
}

function mapBrandRow(row: BrandActionRow, profiles: Map<string, ProfileRow>): AdminTakeActionItem {
  const brand = dealBrands.find((item) => item.id === row.brand_id);

  return {
    id: row.id,
    source: "brand",
    sourceLabel: "Brand",
    contextId: row.brand_id,
    contextName: row.deal_name ? `${brand?.name ?? "Brand"} - ${row.deal_name}` : brand?.name ?? `Brand ${row.brand_id}`,
    contextHref: `/brands/${row.brand_id}/deals`,
    title: row.action_type_label,
    body: row.message ?? "",
    status: row.status,
    requestedBy: row.requested_by,
    recipients: row.recipients ?? [],
    urgency: row.urgency,
    timestamp: row.created_at,
    updatedAt: row.updated_at,
    responseBody: row.response_body ?? null,
    respondedBy: row.responded_by ? profileLabel(profiles.get(row.responded_by), row.responded_by) : null,
    respondedAt: row.responded_at ?? null,
  };
}

async function loadProfiles(token: string): Promise<Map<string, ProfileRow>> {
  const rows = await supabaseRequest<ProfileRow[]>("/rest/v1/profiles", {
    query: new URLSearchParams({
      select: "id,email,full_name,username",
    }),
    accessToken: token,
  }).catch(() => [] as ProfileRow[]);

  return new Map(rows.map((profile) => [profile.id, profile]));
}

async function patchWithResponse<TRow>(
  path: string,
  id: string,
  body: JsonObject,
): Promise<TRow[]> {
  const query = new URLSearchParams({ id: `eq.${id}` });
  try {
    return await supabaseRequest<TRow[]>(path, {
      method: "PATCH",
      query,
      body,
      accessToken: accessToken(),
      prefer: "return=representation",
    });
  } catch (error) {
    if (isMissingResponseColumns(error)) throw missingResponseColumnsError();
    throw error;
  }
}

export function isOpenAdminAction(item: AdminTakeActionItem): boolean {
  return item.status === "pending" || item.status === "open" || item.status === "in_progress";
}

export const adminTakeActionStore = {
  async loadAll(options: LoadAllOptions = {}): Promise<AdminTakeActionItem[]> {
    const includeDealActions = options.includeDealActions ?? true;
    const includeBrandActions = options.includeBrandActions ?? true;
    const token = accessToken();
    const profiles = await loadProfiles(token);
    const dealRows = includeDealActions
      ? await supabaseRequest<TakeActionRow[]>("/rest/v1/take_action_items", {
          query: new URLSearchParams({
            select: "*",
            order: "created_at.desc",
          }),
          accessToken: token,
        }).catch((error) => {
          if (isMissingTable(error)) return [] as TakeActionRow[];
          throw error;
        })
      : [];
    const brandRows = includeBrandActions
      ? await supabaseRequest<BrandActionRow[]>("/rest/v1/brand_action_items", {
          query: new URLSearchParams({
            select: "*",
            order: "created_at.desc",
          }),
          accessToken: token,
        }).catch((error) => {
          if (isMissingTable(error)) return [] as BrandActionRow[];
          throw error;
        })
      : [];

    return [
      ...dealRows.map((row) => mapDealRow(row, profiles)),
      ...brandRows.map((row) => mapBrandRow(row, profiles)),
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  },

  async respond(item: AdminTakeActionItem, responseBody: string): Promise<void> {
    const respondedAt = new Date().toISOString();
    const respondedBy = currentProfileId();
    const responsePayload = {
      status: "resolved",
      response_body: responseBody,
      responded_by: respondedBy,
      responded_at: respondedAt,
    } satisfies JsonObject;

    if (item.source === "deal") {
      await patchWithResponse<TakeActionRow>("/rest/v1/take_action_items", item.id, responsePayload);
      return;
    }

    await patchWithResponse<BrandActionRow>("/rest/v1/brand_action_items", item.id, responsePayload);
  },
};
