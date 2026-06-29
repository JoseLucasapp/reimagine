import { getStoredSession } from "@/application/auth/session";
import { getRuntimeConfig } from "@/config/env";
import { refreshStoredSession, SupabaseHttpError } from "@/infrastructure/supabase/client";

export const DEAL_DOCUMENTS_BUCKET = "deal-documents";
export const MAX_DEAL_DOCUMENT_UPLOAD_BYTES = 25 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
  "text/csv",
]);

export type UploadDealDocumentFileInput = {
  dealId: string;
  documentKey: string;
  file: File;
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

function accessToken(): string {
  const token = getStoredSession()?.accessToken;
  if (!token) throw new Error("Session expired. Log in again before uploading files.");
  return token;
}

function safeSegment(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "file";
}

function encodeStoragePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

async function readError(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) return response.json();
  return response.text();
}

function assertValidDocumentFile(file: File): void {
  if (file.size > MAX_DEAL_DOCUMENT_UPLOAD_BYTES) {
    throw new Error("File is too large. Upload a file up to 25 MB.");
  }

  if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error("Unsupported file type. Upload PDF, Word, Excel, PowerPoint, image, TXT, or CSV files.");
  }
}

export function fileNameFromStorageValue(value: string): string {
  try {
    const url = new URL(value);
    const lastSegment = url.pathname.split("/").filter(Boolean).pop();
    return lastSegment ? decodeURIComponent(lastSegment) : value;
  } catch {
    return value;
  }
}

export async function uploadDealDocumentFile({ dealId, documentKey, file }: UploadDealDocumentFileInput): Promise<string> {
  assertValidDocumentFile(file);

  const baseUrl = getBaseUrl();
  const anonKey = getAnonKey();
  const token = accessToken();
  const safeFileName = safeSegment(file.name);
  const path = `${safeSegment(dealId)}/${safeSegment(documentKey)}/${Date.now()}-${safeFileName}`;
  const encodedPath = encodeStoragePath(path);

  const uploadWithToken = (accessToken: string) =>
    fetch(`${baseUrl}/storage/v1/object/${DEAL_DOCUMENTS_BUCKET}/${encodedPath}`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": file.type || "application/octet-stream",
        "Cache-Control": "3600",
        "x-upsert": "true",
      },
      body: file,
    });

  let response = await uploadWithToken(token);
  if (response.status === 401) {
    const refreshedToken = await refreshStoredSession();
    if (refreshedToken) response = await uploadWithToken(refreshedToken);
  }

  if (!response.ok) {
    throw new SupabaseHttpError(`Supabase storage upload failed with status ${response.status}.`, response.status, await readError(response));
  }

  return `${baseUrl}/storage/v1/object/public/${DEAL_DOCUMENTS_BUCKET}/${encodedPath}`;
}
