import { getStoredSession } from "@/application/auth/session";
import type { TakeActionAudience, TakeActionStatus } from "@/domain/entities";
import { SupabaseHttpError, supabaseRequest } from "@/infrastructure/supabase/client";

export interface DealActionItem {
  id: string;
  dealId: string;
  audience: TakeActionAudience;
  status: TakeActionStatus;
  title: string;
  body: string;
  createdBy: string | null;
  timestamp: string;
  updatedAt: string;
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

type Listener = () => void;

const listeners = new Set<Listener>();
const byDealCache = new Map<string, DealActionItem[]>();
const EMPTY_ITEMS: DealActionItem[] = [];
const BULK_LOAD_CHUNK_SIZE = 75;

function accessToken(): string {
  const token = getStoredSession()?.accessToken;
  if (!token) throw new Error("Session expired. Log in again before saving changes.");
  return token;
}

function notify() {
  listeners.forEach((listener) => listener());
}

function mapRow(row: TakeActionRow): DealActionItem {
  return {
    id: row.id,
    dealId: row.deal_id,
    audience: row.audience,
    status: row.status,
    title: row.title,
    body: row.body,
    createdBy: row.created_by,
    timestamp: row.created_at,
    updatedAt: row.updated_at,
    responseBody: row.response_body ?? null,
    respondedBy: row.responded_by ?? null,
    respondedAt: row.responded_at ?? null,
  };
}

function isMissingTable(error: unknown): boolean {
  return error instanceof SupabaseHttpError && error.status === 404;
}

function setDealItems(dealId: string, items: DealActionItem[]) {
  byDealCache.set(dealId, items);
  notify();
}

function setManyDealItems(dealIds: string[], items: DealActionItem[]) {
  const grouped = new Map<string, DealActionItem[]>();
  items.forEach((item) => {
    const current = grouped.get(item.dealId) ?? [];
    current.push(item);
    grouped.set(item.dealId, current);
  });
  dealIds.forEach((dealId) => {
    byDealCache.set(dealId, grouped.get(dealId) ?? EMPTY_ITEMS);
  });
  notify();
}

function uniqueDealIds(dealIds: string[]): string[] {
  return Array.from(new Set(dealIds.filter(Boolean)));
}

export const dealActionStore = {
  getByDeal(dealId: string): DealActionItem[] {
    return byDealCache.get(dealId) ?? EMPTY_ITEMS;
  },

  async loadByDeal(dealId: string): Promise<void> {
    if (!dealId) return;
    const rows = await supabaseRequest<TakeActionRow[]>("/rest/v1/take_action_items", {
      query: new URLSearchParams({
        deal_id: `eq.${dealId}`,
        select: "*",
        order: "created_at.desc",
      }),
      accessToken: accessToken(),
    }).catch((error) => {
      if (isMissingTable(error)) return [] as TakeActionRow[];
      throw error;
    });
    setDealItems(dealId, rows.map(mapRow));
  },

  async loadByDeals(dealIds: string[]): Promise<void> {
    const uniqueIds = uniqueDealIds(dealIds);
    if (uniqueIds.length === 0) return;

    const rows: TakeActionRow[] = [];
    for (let index = 0; index < uniqueIds.length; index += BULK_LOAD_CHUNK_SIZE) {
      const chunk = uniqueIds.slice(index, index + BULK_LOAD_CHUNK_SIZE);
      const chunkRows = await supabaseRequest<TakeActionRow[]>("/rest/v1/take_action_items", {
        query: new URLSearchParams({
          deal_id: `in.(${chunk.join(",")})`,
          select: "*",
          order: "created_at.desc",
        }),
        accessToken: accessToken(),
      }).catch((error) => {
        if (isMissingTable(error)) return [] as TakeActionRow[];
        throw error;
      });
      rows.push(...chunkRows);
    }

    setManyDealItems(uniqueIds, rows.map(mapRow));
  },

  async resolve(id: string): Promise<void> {
    const rows = await supabaseRequest<TakeActionRow[]>("/rest/v1/take_action_items", {
      method: "PATCH",
      query: new URLSearchParams({ id: `eq.${id}` }),
      body: { status: "resolved" },
      accessToken: accessToken(),
      prefer: "return=representation",
    });
    const updated = rows[0] ? mapRow(rows[0]) : null;
    if (!updated) return;
    const current = byDealCache.get(updated.dealId) ?? EMPTY_ITEMS;
    setDealItems(updated.dealId, current.map((item) => (item.id === updated.id ? updated : item)));
  },

  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
