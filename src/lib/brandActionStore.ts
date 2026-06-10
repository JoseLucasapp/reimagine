// Lightweight in-memory store for brand-level action items (mock).
// Persists to sessionStorage so counters survive nav within a session.

export interface BrandActionItem {
  id: string;
  brandId: string;
  dealName?: string; // empty/brand-level when undefined
  actionTypeKey: string;
  actionTypeLabel: string;
  recipients: string[];
  message: string;
  urgency: string;
  requestedBy: string;
  timestamp: string; // ISO
  status: "pending" | "resolved";
}

const KEY = "rcre_brand_actions_v1";
type Listener = () => void;
const listeners = new Set<Listener>();

function read(): BrandActionItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return seed();
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function write(items: BrandActionItem[]) {
  sessionStorage.setItem(KEY, JSON.stringify(items));
  byBrandCache.clear();
  listeners.forEach((l) => l());
}

// Cache filtered snapshots so useSyncExternalStore gets stable references.
const byBrandCache = new Map<string, BrandActionItem[]>();

function seed(): BrandActionItem[] {
  // Seed with a couple of mock items so the counter isn't always 0.
  const now = Date.now();
  const seeded: BrandActionItem[] = [
    {
      id: `seed-${now}-1`,
      brandId: "br01",
      dealName: "James Thornton — Downtown Flagship",
      actionTypeKey: "update",
      actionTypeLabel: "Request Update",
      recipients: ["Sarah Chen"],
      message: "Need landlord response timing on the redline.",
      urgency: "high",
      requestedBy: "ME",
      timestamp: new Date(now - 1000 * 60 * 60 * 6).toISOString(),
      status: "pending",
    },
    {
      id: `seed-${now}-2`,
      brandId: "br01",
      dealName: "Westside Plaza",
      actionTypeKey: "file",
      actionTypeLabel: "Request File",
      recipients: ["Michael Torres"],
      message: "Please upload the latest LOI draft.",
      urgency: "normal",
      requestedBy: "ME",
      timestamp: new Date(now - 1000 * 60 * 60 * 26).toISOString(),
      status: "pending",
    },
  ];
  sessionStorage.setItem(KEY, JSON.stringify(seeded));
  return seeded;
}

export const brandActionStore = {
  getByBrand(brandId: string): BrandActionItem[] {
    const cached = byBrandCache.get(brandId);
    if (cached) return cached;
    const next = read().filter((i) => i.brandId === brandId);
    byBrandCache.set(brandId, next);
    return next;
  },
  openCountByBrand(brandId: string): number {
    return read().filter((i) => i.brandId === brandId && i.status === "pending").length;
  },
  add(item: Omit<BrandActionItem, "id" | "timestamp" | "status">): BrandActionItem {
    const next: BrandActionItem = {
      ...item,
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      status: "pending",
    };
    write([next, ...read()]);
    return next;
  },
  resolve(id: string) {
    write(read().map((i) => (i.id === id ? { ...i, status: "resolved" as const } : i)));
  },
  subscribe(l: Listener) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};
