import { getStoredSession } from "@/application/auth/session";
import { SupabaseHttpError, supabaseRequest, type JsonObject } from "@/infrastructure/supabase/client";
import { sendTakeActionNotification } from "@/lib/takeActionNotifications";

export interface BrandActionItem {
  id: string;
  brandId: string;
  dealName?: string;
  actionTypeKey: string;
  actionTypeLabel: string;
  recipients: string[];
  message: string;
  urgency: string;
  requestedBy: string;
  timestamp: string;
  status: "pending" | "resolved";
  updatedAt?: string;
  responseBody?: string | null;
  respondedBy?: string | null;
  respondedAt?: string | null;
}

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

type Listener = () => void;
const listeners = new Set<Listener>();
const byBrandCache = new Map<string, BrandActionItem[]>();
const EMPTY_ITEMS: BrandActionItem[] = [];

function accessToken(): string {
  const token = getStoredSession()?.accessToken;
  if (!token) throw new Error("Session expired. Log in again before saving changes.");
  return token;
}

function notify() {
  listeners.forEach((listener) => listener());
}

function mapRow(row: BrandActionRow): BrandActionItem {
  return {
    id: row.id,
    brandId: row.brand_id,
    dealName: row.deal_name ?? undefined,
    actionTypeKey: row.action_type_key,
    actionTypeLabel: row.action_type_label,
    recipients: row.recipients ?? [],
    message: row.message ?? "",
    urgency: row.urgency,
    requestedBy: row.requested_by,
    timestamp: row.created_at,
    status: row.status,
    updatedAt: row.updated_at,
    responseBody: row.response_body ?? null,
    respondedBy: row.responded_by ?? null,
    respondedAt: row.responded_at ?? null,
  };
}

function setBrandItems(brandId: string, items: BrandActionItem[]) {
  byBrandCache.set(brandId, items);
  notify();
}

function isMissingBrandActionTable(error: unknown): boolean {
  return error instanceof SupabaseHttpError && error.status === 404;
}

function missingTableError(): Error {
  return new Error("The brand_action_items table is missing. Run the latest Supabase schema before using action items.");
}

export const brandActionStore = {
  getByBrand(brandId: string): BrandActionItem[] {
    return byBrandCache.get(brandId) ?? EMPTY_ITEMS;
  },

  openCountByBrand(brandId: string): number {
    return (byBrandCache.get(brandId) ?? EMPTY_ITEMS).filter((item) => item.status === "pending").length;
  },

  async loadByBrand(brandId: string): Promise<void> {
    if (!brandId) return;
    const query = new URLSearchParams({
      brand_id: `eq.${brandId}`,
      select: "*",
      order: "created_at.desc",
    });
    try {
      const rows = await supabaseRequest<BrandActionRow[]>("/rest/v1/brand_action_items", {
        query,
        accessToken: accessToken(),
      });
      setBrandItems(brandId, rows.map(mapRow));
    } catch (error) {
      if (isMissingBrandActionTable(error)) {
        setBrandItems(brandId, EMPTY_ITEMS);
        return;
      }
      throw error;
    }
  },

  async add(item: Omit<BrandActionItem, "id" | "timestamp" | "status">): Promise<BrandActionItem> {
    let rows: BrandActionRow[];
    try {
      rows = await supabaseRequest<BrandActionRow[]>("/rest/v1/brand_action_items", {
        method: "POST",
        body: {
          brand_id: item.brandId,
          deal_name: item.dealName ?? null,
          action_type_key: item.actionTypeKey,
          action_type_label: item.actionTypeLabel,
          recipients: item.recipients,
          message: item.message,
          urgency: item.urgency,
          requested_by: item.requestedBy,
        } satisfies JsonObject,
        accessToken: accessToken(),
        prefer: "return=representation",
      });
    } catch (error) {
      if (isMissingBrandActionTable(error)) throw missingTableError();
      throw error;
    }

    if (!rows[0]) throw new Error("Supabase returned no brand action item.");
    const next = mapRow(rows[0]);
    await sendTakeActionNotification({
      recipients: item.recipients,
      actionTypeLabel: item.actionTypeLabel,
      message: item.message,
      requestedBy: item.requestedBy,
      contextName: item.dealName ?? "Brand action request",
      contextUrl: `${window.location.origin}/brands/${item.brandId}/deals`,
      urgency: item.urgency,
    }).catch((error) => {
      console.warn("Take Action email notification failed", error);
      return false;
    });
    const current = byBrandCache.get(item.brandId) ?? EMPTY_ITEMS;
    setBrandItems(item.brandId, [next, ...current]);
    return next;
  },

  async resolve(id: string): Promise<void> {
    const query = new URLSearchParams({ id: `eq.${id}` });
    let rows: BrandActionRow[];
    try {
      rows = await supabaseRequest<BrandActionRow[]>("/rest/v1/brand_action_items", {
        method: "PATCH",
        query,
        body: { status: "resolved" },
        accessToken: accessToken(),
        prefer: "return=representation",
      });
    } catch (error) {
      if (isMissingBrandActionTable(error)) throw missingTableError();
      throw error;
    }
    const updated = rows[0] ? mapRow(rows[0]) : null;
    if (!updated) return;

    const current = byBrandCache.get(updated.brandId) ?? EMPTY_ITEMS;
    setBrandItems(
      updated.brandId,
      current.map((item) => (item.id === updated.id ? updated : item)),
    );
  },

  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
