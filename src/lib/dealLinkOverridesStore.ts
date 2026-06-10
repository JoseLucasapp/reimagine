// Local-only overrides for deal quick-links (Market Study URL + Map URL).
// Mock-data friendly: persists per deal id in localStorage and notifies
// subscribers within the same tab so the UI updates without a reload.
import { useSyncExternalStore } from "react";

export interface DealLinkOverrides {
  marketStudyUrl?: string;
  mapUrl?: string;
}

const KEY = "rcre_deal_link_overrides";
const EVENT = "rcre:deal-link-overrides-change";
type Listener = () => void;
const listeners = new Set<Listener>();

function readAll(): Record<string, DealLinkOverrides> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

let cache: Record<string, DealLinkOverrides> = readAll();

function emit() {
  cache = readAll();
  listeners.forEach((l) => l());
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) emit();
  });
  window.addEventListener(EVENT, emit as EventListener);
}

export const dealLinkOverridesStore = {
  get(dealId: string): DealLinkOverrides {
    return cache[dealId] || {};
  },
  set(dealId: string, value: DealLinkOverrides) {
    if (typeof window === "undefined") return;
    const next = { ...readAll(), [dealId]: value };
    localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(EVENT));
  },
  subscribe(l: Listener) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
};

export function useDealLinkOverrides(dealId: string): DealLinkOverrides {
  return useSyncExternalStore(
    dealLinkOverridesStore.subscribe,
    () => cache[dealId] || EMPTY,
    () => EMPTY,
  );
}

const EMPTY: DealLinkOverrides = {};
