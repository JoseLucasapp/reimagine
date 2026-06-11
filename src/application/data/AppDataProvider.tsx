import { useEffect, useState } from "react";
import { getStoredSession } from "@/application/auth/session";
import { getRuntimeConfig } from "@/config/env";
import { loadRuntimeAppData } from "@/application/data/loadRuntimeAppData";

interface AppDataProviderProps {
  children: React.ReactNode;
}

export function AppDataProvider({ children }: AppDataProviderProps) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        if (!getRuntimeConfig().isSupabaseConfigured) {
          throw new Error("Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
        }

        const session = getStoredSession();
        if (!session?.accessToken) {
          throw new Error("Session expired. Refresh the page and log in again.");
        }
        await loadRuntimeAppData({ accessToken: session.accessToken });
        if (active) setStatus("ready");
      } catch (err) {
        if (!active) return;
        setStatus("error");
        setError(err instanceof Error ? err.message : "Unable to load workspace data.");
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  if (status === "ready") return <>{children}</>;

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: "var(--bg-main)", fontFamily: "Inter, system-ui, sans-serif" }}>
      <div
        className="w-full max-w-md rounded-2xl text-center"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          boxShadow: "var(--shadow-card)",
          padding: 32,
        }}
      >
        <p className="text-sm font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>
          {status === "loading" ? "Loading workspace" : "Workspace unavailable"}
        </p>
        <h1 className="mt-3 text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
          {status === "loading" ? "Syncing data..." : "Could not load real data"}
        </h1>
        {status === "error" && <p className="mt-3 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>{error}</p>}
      </div>
    </div>
  );
}
