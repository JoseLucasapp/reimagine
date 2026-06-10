import { useEffect, useState, useCallback } from "react";

const STORAGE_KEY = "rcre-recent-deals-by-brand";
const MAX_PER_BRAND = 5;

type RecentMap = Record<string, string[]>; // brandId -> dealId[] (most-recent first)

function read(): RecentMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function write(map: RecentMap) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

/** Record a visit to a deal under its brand. */
export function recordDealVisit(brandId: string, dealId: string) {
  if (!brandId || !dealId) return;
  const map = read();
  const list = (map[brandId] || []).filter((id) => id !== dealId);
  list.unshift(dealId);
  map[brandId] = list.slice(0, MAX_PER_BRAND);
  write(map);
}

/** Returns recently-viewed deal IDs for a brand, excluding the current deal. */
export function useRecentDealsForBrand(brandId: string | undefined, excludeDealId?: string) {
  const [ids, setIds] = useState<string[]>([]);

  const refresh = useCallback(() => {
    if (!brandId) { setIds([]); return; }
    const map = read();
    const list = (map[brandId] || []).filter((id) => id !== excludeDealId);
    setIds(list);
  }, [brandId, excludeDealId]);

  useEffect(() => { refresh(); }, [refresh]);

  return ids;
}
