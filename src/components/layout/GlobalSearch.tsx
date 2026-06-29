import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Building2, Handshake, Users, X } from "lucide-react";
import { globalSearch, SearchResult } from "@/data/dashboardData";
import { dealBrands, dealRecords } from "@/data/dealsData";
import { getVisibleBrandsForUser, getVisibleDealsForUser, useScopedUser } from "@/hooks/useUserRole";
import { useRuntimeDataVersion } from "@/application/data/runtimeStore";

const typeIcons: Record<string, React.ElementType> = {
  Brand: Building2,
  Deal: Handshake,
  Contact: Users,
};

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  const user = useScopedUser();
  const runtimeDataVersion = useRuntimeDataVersion();

  const visibleDeals = useMemo(() => {
    void runtimeDataVersion;
    return getVisibleDealsForUser(user, dealRecords);
  }, [runtimeDataVersion, user]);

  const visibleBrands = useMemo(() => {
    void runtimeDataVersion;
    return getVisibleBrandsForUser(user, dealBrands, visibleDeals);
  }, [runtimeDataVersion, user, visibleDeals]);

  const results = useMemo(() => {
    return globalSearch(query, visibleDeals, visibleBrands);
  }, [query, visibleDeals, visibleBrands]);

  const grouped = useMemo(() => {
    return results.reduce<Record<string, SearchResult[]>>((acc, r) => {
      (acc[r.type] ??= []).push(r);
      return acc;
    }, {});
  }, [results]);

  useEffect(() => {
    if (query.length < 2) setOpen(false);
  }, [query]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
        <input
          value={query}
          onChange={(e) => {
            const next = e.target.value;
            setQuery(next);
            setOpen(next.length >= 2);
          }}
          onFocus={() => setOpen(query.length >= 2)}
          placeholder="Search brands, deals, contacts..."
          className="glass-input w-full pl-9 pr-9 py-2 text-sm"
          aria-label="Search brands, deals, contacts"
        />
        {query && (
          <button onClick={() => { setQuery(""); setOpen(false); }} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} aria-label="Clear search">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div
          className="absolute top-full mt-2 w-full rounded-[14px] z-50 overflow-hidden max-h-80 overflow-y-auto"
          style={{
            background: "var(--bg-card-strong)",
            backdropFilter: "blur(24px) saturate(180%)",
            WebkitBackdropFilter: "blur(24px) saturate(180%)",
            border: "1px solid var(--border-card)",
            boxShadow: "var(--shadow-card-hover)",
          }}
        >
          {Object.entries(grouped).map(([type, items]) => {
            const Icon = typeIcons[type] || Search;
            return (
              <div key={type}>
                <div className="px-3 py-2 section-label" style={{ background: "var(--bg-table-header)" }}>
                  {type}s
                </div>
                {items.map((item) => (
                  <button
                    key={item.id}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors"
                    style={{ color: "var(--text-primary)" }}
                    onClick={() => { navigate(item.url); setQuery(""); setOpen(false); }}
                  >
                    <Icon className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{item.title}</p>
                      <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{item.subtitle}</p>
                    </div>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {open && results.length === 0 && query.length >= 2 && (
        <div
          className="absolute top-full mt-2 w-full rounded-[14px] z-50 p-6 text-center"
          style={{
            background: "var(--bg-card-strong)",
            backdropFilter: "blur(24px)",
            border: "1px solid var(--border-card)",
            boxShadow: "var(--shadow-card-hover)",
          }}
        >
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>No results for "{query}"</p>
        </div>
      )}
    </div>
  );
}
