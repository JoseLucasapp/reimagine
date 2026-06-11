// Lightweight in-memory store for brand-level action items created during the current session.
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
    if (!raw) return [];
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
