import type { Brand, Deal, Prospect, TakeActionItem, TourBook } from "@/domain/entities";
import { createSelectQuery, supabaseRequest, type JsonObject } from "./client";

export type RepositoryListOptions = {
  accessToken?: string | null;
};

export type ReimagineRepositories = {
  brands: { list(options?: RepositoryListOptions): Promise<Brand[]> };
  deals: { list(options?: RepositoryListOptions): Promise<Deal[]> };
  prospects: { list(options?: RepositoryListOptions): Promise<Prospect[]> };
  tourBooks: { list(options?: RepositoryListOptions): Promise<TourBook[]> };
  takeActions: {
    list(options?: RepositoryListOptions): Promise<TakeActionItem[]>;
    create(input: Omit<TakeActionItem, "id" | "createdAt" | "updatedAt">, options?: RepositoryListOptions): Promise<TakeActionItem>;
  };
};

function listRows<T>(table: string, options?: RepositoryListOptions): Promise<T[]> {
  return supabaseRequest<T[]>(`/rest/v1/${table}`, {
    query: createSelectQuery("*"),
    accessToken: options?.accessToken,
  });
}

function insertRow<T>(table: string, body: JsonObject, options?: RepositoryListOptions): Promise<T> {
  return supabaseRequest<T[]>(`/rest/v1/${table}`, {
    method: "POST",
    body,
    accessToken: options?.accessToken,
    prefer: "return=representation",
  }).then((rows) => rows[0]);
}

export function createSupabaseRepositories(): ReimagineRepositories {
  return {
    brands: { list: (options) => listRows<Brand>("brands", options) },
    deals: { list: (options) => listRows<Deal>("deals", options) },
    prospects: { list: (options) => listRows<Prospect>("prospects", options) },
    tourBooks: { list: (options) => listRows<TourBook>("tour_books", options) },
    takeActions: {
      list: (options) => listRows<TakeActionItem>("take_action_items", options),
      create: (input, options) => insertRow<TakeActionItem>("take_action_items", input as unknown as JsonObject, options),
    },
  };
}
