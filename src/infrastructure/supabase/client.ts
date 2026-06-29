import { getStoredSession, persistSession } from "@/application/auth/session";
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
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: JsonObject | JsonObject[];
  query?: URLSearchParams;
  accessToken?: string | null;
  prefer?: string;
};

type RefreshTokenResponse = {
  access_token?: unknown;
  refresh_token?: unknown;
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

async function refreshStoredSession(): Promise<string | null> {
  const session = getStoredSession();
  if (!session?.refreshToken) return null;

  const baseUrl = getBaseUrl();
  const anonKey = getAnonKey();
  const response = await fetch(`${baseUrl}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refresh_token: session.refreshToken }),
  });

  const payload = (await parseResponse(response)) as RefreshTokenResponse;
  if (!response.ok || typeof payload.access_token !== "string") return null;

  const nextRefreshToken = typeof payload.refresh_token === "string" ? payload.refresh_token : session.refreshToken;
  persistSession({ ...session, accessToken: payload.access_token, refreshToken: nextRefreshToken });
  return payload.access_token;
}

async function executeRequest<T>(url: string, anonKey: string, options: SupabaseRequestOptions, accessToken: string | null | undefined): Promise<{ response: Response; payload: unknown }> {
  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken ?? anonKey}`,
      "Content-Type": "application/json",
      ...(options.prefer ? { Prefer: options.prefer } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await parseResponse(response);
  return { response, payload };
}

export async function supabaseRequest<T>(path: string, options: SupabaseRequestOptions = {}): Promise<T> {
  const baseUrl = getBaseUrl();
  const anonKey = getAnonKey();
  const query = options.query?.toString();
  const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}${query ? `?${query}` : ""}`;
  const initialToken = options.accessToken ?? null;

  let { response, payload } = await executeRequest<T>(url, anonKey, options, initialToken);

  if (response.status === 401 && initialToken) {
    const refreshedToken = await refreshStoredSession();
    if (refreshedToken) {
      ({ response, payload } = await executeRequest<T>(url, anonKey, options, refreshedToken));
    }
  }

  if (!response.ok) {
    throw new SupabaseHttpError(`Supabase request failed with status ${response.status}.`, response.status, payload);
  }

  return payload as T;
}


export async function supabaseFunctionRequest<T>(functionName: string, body: JsonObject, accessToken?: string | null): Promise<T> {
  const baseUrl = getBaseUrl();
  const anonKey = getAnonKey();
  const response = await fetch(`${baseUrl}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken ?? anonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = await parseResponse(response);

  if (!response.ok) {
    throw new SupabaseHttpError(`Supabase function ${functionName} failed with status ${response.status}.`, response.status, payload);
  }

  return payload as T;
}

export function createSelectQuery(columns = "*"): URLSearchParams {
  const query = new URLSearchParams();
  query.set("select", columns);
  return query;
}
