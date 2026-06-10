import { getRuntimeConfig } from "@/config/env";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export class SupabaseHttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details: unknown,
  ) {
    super(message);
    this.name = "SupabaseHttpError";
  }
}

export type SupabaseRequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: JsonObject | JsonObject[];
  query?: URLSearchParams;
  accessToken?: string | null;
  prefer?: string;
};

function getBaseUrl(): string {
  const { supabaseUrl, isSupabaseConfigured } = getRuntimeConfig();
  if (!isSupabaseConfigured || !supabaseUrl) {
    throw new SupabaseHttpError("Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.", 0, null);
  }
  return supabaseUrl.replace(/\/$/, "");
}

function getAnonKey(): string {
  const { supabaseAnonKey, isSupabaseConfigured } = getRuntimeConfig();
  if (!isSupabaseConfigured || !supabaseAnonKey) {
    throw new SupabaseHttpError("Supabase anonymous key is not configured.", 0, null);
  }
  return supabaseAnonKey;
}

async function parseResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return response.text();
  }
  return response.json() as Promise<unknown>;
}

export async function supabaseRequest<T>(path: string, options: SupabaseRequestOptions = {}): Promise<T> {
  const baseUrl = getBaseUrl();
  const anonKey = getAnonKey();
  const method = options.method ?? "GET";
  const query = options.query?.toString();
  const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}${query ? `?${query}` : ""}`;

  const response = await fetch(url, {
    method,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${options.accessToken ?? anonKey}`,
      "Content-Type": "application/json",
      ...(options.prefer ? { Prefer: options.prefer } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const payload = await parseResponse(response);
  if (!response.ok) {
    throw new SupabaseHttpError(`Supabase request failed with status ${response.status}.`, response.status, payload);
  }

  return payload as T;
}

export function createSelectQuery(columns = "*"): URLSearchParams {
  const query = new URLSearchParams();
  query.set("select", columns);
  return query;
}
