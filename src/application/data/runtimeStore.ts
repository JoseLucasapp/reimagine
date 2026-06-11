import { useSyncExternalStore } from "react";

type RuntimeListener = () => void;

let runtimeDataVersion = 0;
const listeners = new Set<RuntimeListener>();

export function notifyRuntimeDataChanged(): void {
  runtimeDataVersion += 1;
  listeners.forEach((listener) => listener());
}

export function subscribeRuntimeData(listener: RuntimeListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getRuntimeDataVersion(): number {
  return runtimeDataVersion;
}

export function useRuntimeDataVersion(): number {
  return useSyncExternalStore(subscribeRuntimeData, getRuntimeDataVersion, getRuntimeDataVersion);
}
