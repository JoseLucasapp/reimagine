import { getStoredSession } from "@/application/auth/session";
import type { UserRole } from "@/domain/entities";
import { ROLE_LABELS } from "@/domain/permissions";
import { supabaseFunctionRequest, supabaseRequest, type JsonObject } from "@/infrastructure/supabase/client";

export type AdminUserProfile = {
  id: string;
  email: string | null;
  fullName: string | null;
  username: string | null;
  role: UserRole;
  brandId: string | null;
  dealId: string | null;
  brokerName: string | null;
  createdAt: string;
  updatedAt: string;
};

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  username: string | null;
  role: UserRole;
  brand_id: string | null;
  deal_id: string | null;
  broker_name?: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminUserScopeOptions = {
  brands: Array<{ id: string; name: string }>;
  deals: Array<{ id: string; brandId: string; label: string; city: string; state: string }>;
};

export type AdminUserInput = {
  id?: string | null;
  email: string;
  fullName: string;
  username?: string | null;
  role: UserRole;
  brandId?: string | null;
  dealId?: string | null;
  brokerName?: string | null;
};

export const adminUserRoleOptions: UserRole[] = ["admin", "broker", "brand", "deal", "mapiq"];
export const adminUserRoleLabels = ROLE_LABELS;

function currentAccessToken(): string {
  const token = getStoredSession()?.accessToken;
  if (!token) throw new Error("Session expired. Log in again.");
  return token;
}

function mapProfile(row: ProfileRow): AdminUserProfile {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    username: row.username,
    role: row.role,
    brandId: row.brand_id,
    dealId: row.deal_id,
    brokerName: row.broker_name ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function loadAdminUsers(): Promise<AdminUserProfile[]> {
  const rows = await supabaseRequest<ProfileRow[]>("/rest/v1/profiles", {
    query: new URLSearchParams({
      select: "id,email,full_name,username,role,brand_id,deal_id,broker_name,created_at,updated_at",
      order: "full_name.asc.nullslast,email.asc",
    }),
    accessToken: currentAccessToken(),
  });
  return rows.map(mapProfile);
}

export async function loadAdminUserScopeOptions(): Promise<AdminUserScopeOptions> {
  const accessToken = currentAccessToken();
  const [brandRows, dealRows] = await Promise.all([
    supabaseRequest<Array<{ id: string; name: string }>>("/rest/v1/brands", {
      query: new URLSearchParams({
        select: "id,name",
        order: "name.asc",
      }),
      accessToken,
    }),
    supabaseRequest<Array<{ id: string; brand_id: string; franchisee: string; city: string; state: string }>>("/rest/v1/deals", {
      query: new URLSearchParams({
        select: "id,brand_id,franchisee,city,state",
        order: "franchisee.asc",
      }),
      accessToken,
    }),
  ]);

  return {
    brands: brandRows,
    deals: dealRows.map((row) => ({
      id: row.id,
      brandId: row.brand_id,
      label: row.franchisee,
      city: row.city,
      state: row.state,
    })),
  };
}

function nullable(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed || null;
}

export async function saveAdminUser(input: AdminUserInput): Promise<AdminUserProfile> {
  const response = await supabaseFunctionRequest<{ profile: ProfileRow; emailMode: "invite" | "none" }>(
    "admin-upsert-user",
    {
      id: nullable(input.id),
      email: input.email.trim().toLowerCase(),
      fullName: input.fullName.trim(),
      username: nullable(input.username),
      role: input.role,
      brandId: nullable(input.brandId),
      dealId: nullable(input.dealId),
      brokerName: nullable(input.brokerName),
    } satisfies JsonObject,
    currentAccessToken(),
  );
  return mapProfile(response.profile);
}
