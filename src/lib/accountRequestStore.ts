import { getStoredSession } from "@/application/auth/session";
import type { UserRole } from "@/domain/entities";
import { supabaseFunctionRequest, supabaseRequest, type JsonObject } from "@/infrastructure/supabase/client";

export type RequestedAccountRole = Extract<UserRole, "broker" | "brand" | "deal">;
export type AccountRequestStatus = "pending" | "approved" | "rejected";

export type AccountRequest = {
  id: string;
  fullName: string;
  email: string;
  requestedRole: RequestedAccountRole;
  company: string | null;
  brandName: string | null;
  dealName: string | null;
  brandId: string | null;
  dealId: string | null;
  brokerName: string | null;
  message: string | null;
  status: AccountRequestStatus;
  adminNotes: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type AccountRequestRow = {
  id: string;
  full_name: string;
  email: string;
  requested_role: RequestedAccountRole;
  company: string | null;
  brand_name: string | null;
  deal_name: string | null;
  brand_id?: string | null;
  deal_id?: string | null;
  broker_name?: string | null;
  message: string | null;
  status: AccountRequestStatus;
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateAccountRequestInput = {
  fullName: string;
  email: string;
  requestedRole: RequestedAccountRole;
  company?: string;
  brandName?: string;
  dealName?: string;
  brandId?: string | null;
  dealId?: string | null;
  brokerName?: string | null;
  message?: string;
};

export type UpdateAccountRequestInput = Partial<CreateAccountRequestInput> & {
  status?: AccountRequestStatus;
  adminNotes?: string;
};

export type AccountRequestScopeOptions = {
  brands: Array<{ id: string; name: string }>;
  deals: Array<{ id: string; brandId: string; label: string; city: string; state: string }>;
};

export const requestedAccountRoleLabels: Record<RequestedAccountRole, string> = {
  broker: "Broker",
  brand: "Brand Level",
  deal: "Deal Level",
};

function trimToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed || null;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function mapAccountRequest(row: AccountRequestRow): AccountRequest {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    requestedRole: row.requested_role,
    company: row.company,
    brandName: row.brand_name,
    dealName: row.deal_name,
    brandId: row.brand_id ?? null,
    dealId: row.deal_id ?? null,
    brokerName: row.broker_name ?? null,
    message: row.message,
    status: row.status,
    adminNotes: row.admin_notes,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function createBody(input: CreateAccountRequestInput): JsonObject {
  return {
    full_name: input.fullName.trim(),
    email: normalizeEmail(input.email),
    requested_role: input.requestedRole,
    company: trimToNull(input.company),
    brand_name: trimToNull(input.brandName),
    deal_name: trimToNull(input.dealName),
    brand_id: trimToNull(input.brandId),
    deal_id: trimToNull(input.dealId),
    broker_name: trimToNull(input.brokerName),
    message: trimToNull(input.message),
  };
}

function updateBody(input: UpdateAccountRequestInput, reviewedBy?: string | null): JsonObject {
  const body: JsonObject = {};
  if (input.fullName !== undefined) body.full_name = input.fullName.trim();
  if (input.email !== undefined) body.email = normalizeEmail(input.email);
  if (input.requestedRole !== undefined) body.requested_role = input.requestedRole;
  if (input.company !== undefined) body.company = trimToNull(input.company);
  if (input.brandName !== undefined) body.brand_name = trimToNull(input.brandName);
  if (input.dealName !== undefined) body.deal_name = trimToNull(input.dealName);
  if (input.brandId !== undefined) body.brand_id = trimToNull(input.brandId);
  if (input.dealId !== undefined) body.deal_id = trimToNull(input.dealId);
  if (input.brokerName !== undefined) body.broker_name = trimToNull(input.brokerName);
  if (input.message !== undefined) body.message = trimToNull(input.message);
  if (input.adminNotes !== undefined) body.admin_notes = trimToNull(input.adminNotes);
  if (input.status !== undefined) {
    body.status = input.status;
    body.reviewed_by = reviewedBy ?? null;
    body.reviewed_at = new Date().toISOString();
  }
  return body;
}

function currentAccessToken(): string {
  const token = getStoredSession()?.accessToken;
  if (!token) throw new Error("Session expired. Log in again.");
  return token;
}

export async function createAccountRequest(input: CreateAccountRequestInput): Promise<AccountRequest> {
  const rows = await supabaseRequest<AccountRequestRow[]>("/rest/v1/account_requests", {
    method: "POST",
    body: createBody(input),
    prefer: "return=representation",
  });
  if (!rows[0]) throw new Error("Account request was not returned by Supabase.");
  return mapAccountRequest(rows[0]);
}

export async function loadAccountRequests(): Promise<AccountRequest[]> {
  const query = new URLSearchParams({
    select: "*",
    order: "created_at.desc",
  });
  const rows = await supabaseRequest<AccountRequestRow[]>("/rest/v1/account_requests", {
    query,
    accessToken: currentAccessToken(),
  });
  return rows.map(mapAccountRequest);
}

export async function loadAccountRequestScopeOptions(): Promise<AccountRequestScopeOptions> {
  const accessToken = currentAccessToken();
  const brandRows = await supabaseRequest<Array<{ id: string; name: string }>>("/rest/v1/brands", {
    query: new URLSearchParams({
      select: "id,name",
      order: "name.asc",
    }),
    accessToken,
  });
  const dealRows = await supabaseRequest<Array<{ id: string; brand_id: string; franchisee: string; city: string; state: string }>>("/rest/v1/deals", {
    query: new URLSearchParams({
      select: "id,brand_id,franchisee,city,state",
      order: "franchisee.asc",
    }),
    accessToken,
  });

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

export async function updateAccountRequest(id: string, input: UpdateAccountRequestInput): Promise<AccountRequest> {
  const session = getStoredSession();
  const query = new URLSearchParams({
    id: `eq.${id}`,
    select: "*",
  });
  const rows = await supabaseRequest<AccountRequestRow[]>("/rest/v1/account_requests", {
    method: "PATCH",
    query,
    body: updateBody(input, session?.profile.id),
    accessToken: currentAccessToken(),
    prefer: "return=representation",
  });
  if (!rows[0]) throw new Error("Account request was not returned by Supabase.");
  return mapAccountRequest(rows[0]);
}

export async function approveAccountRequest(id: string, input: UpdateAccountRequestInput): Promise<AccountRequest> {
  const response = await supabaseFunctionRequest<{ request: AccountRequestRow }>(
    "approve-account-request",
    {
      requestId: id,
      updates: updateBody(input, getStoredSession()?.profile.id),
    },
    currentAccessToken(),
  );
  return mapAccountRequest(response.request);
}
