import { useEffect, useRef, useState } from "react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import { User, Menu, Search, X, Settings as SettingsIcon, LogOut } from "lucide-react";
import { GlobalSearch } from "./GlobalSearch";
import { NotificationsPopover } from "./NotificationsPopover";
import { dealRecords, getDealBrandById, dealBrands, getDealRecordById } from "@/data/dealsData";
import { useIsCompact } from "@/hooks/use-mobile";
import { useRecentDealsForBrand } from "@/hooks/useRecentDeals";
import { DealStatusBadge } from "@/components/DealStatusBadge";
import { useCurrentProfile } from "@/hooks/useUserRole";
import { signOutOfSupabase } from "@/infrastructure/supabase/auth";

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/brand": "Brands",
  "/deal": "Deals",
  "/brands": "Brands",
  "/bizdev": "Prospects",
  "/deals": "Deals",
  "/action-items": "Action Items",
  "/account-requests": "Account Requests",
  "/users": "Users",
  "/mapiq": "MapIQ",
  "/map": "MapIQ",
  "/space-requirements": "Space Requirements",
  "/one-off": "One-Off Deals",
  "/settings": "Settings",
};

type Crumb = { label: string; to?: string; brandId?: string; currentDealId?: string };

function useBreadcrumbs(): Crumb[] {
  const location = useLocation();
  const segments = location.pathname.split("/").filter(Boolean);

  const crumbs: Crumb[] = [];

  if (segments.length === 0) {
    crumbs.push({ label: "Dashboard" });
    return crumbs;
  }

  const base = "/" + segments[0];
  const baseTitle = pageTitles[base] || segments[0];
  
  if (segments.length === 1) {
    crumbs.push({ label: baseTitle });
    return crumbs;
  }

  crumbs.push({ label: baseTitle, to: base });

  if (segments[0] === "deals" && segments[1]) {
    const deal = dealRecords.find((d) => d.id === segments[1]);
    if (deal) {
      const brand = getDealBrandById(deal.brandId);
      if (brand) crumbs.push({
        label: brand.name,
        to: `/brands/${brand.id}/deals`,
        brandId: brand.id,
        currentDealId: deal.id,
      });
      crumbs.push({ label: deal.name ?? deal.franchisee });
    } else {
      crumbs.push({ label: segments[1] });
    }
  } else if (segments[0] === "brands" && segments[1]) {
    const brand = dealBrands.find((b) => b.id === segments[1]);
    crumbs.push({ label: brand?.name || segments[1] });
    if (segments[2] === "deals") crumbs.push({ label: "Deals" });
  } else {
    crumbs.push({ label: segments.slice(1).join("/") });
  }

  return crumbs;
}

// Brand crumb with hover dropdown listing recent deals for that brand.
function BrandCrumbWithRecents({ crumb }: { crumb: Crumb }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const openTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);
  const recentIds = useRecentDealsForBrand(crumb.brandId, crumb.currentDealId);
  const recentDeals = recentIds
    .map((id) => getDealRecordById(id))
    .filter((d): d is NonNullable<ReturnType<typeof getDealRecordById>> => !!d)
    .slice(0, 5);

  const clearTimers = () => {
    if (openTimer.current) { window.clearTimeout(openTimer.current); openTimer.current = null; }
    if (closeTimer.current) { window.clearTimeout(closeTimer.current); closeTimer.current = null; }
  };
  const handleEnter = () => {
    clearTimers();
    if (recentDeals.length === 0) return;
    openTimer.current = window.setTimeout(() => setOpen(true), 300);
  };
  const handleLeave = () => {
    clearTimers();
    closeTimer.current = window.setTimeout(() => setOpen(false), 120);
  };
  useEffect(() => () => clearTimers(), []);

  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <Link
        to={crumb.to!}
        className="hover:underline truncate"
        style={{ color: "var(--text-muted)", fontWeight: 400 }}
      >
        {crumb.label}
      </Link>
      {open && recentDeals.length > 0 && (
        <div
          role="menu"
          className="absolute z-50"
          style={{
            top: "calc(100% + 8px)", left: 0, minWidth: 280, maxWidth: 360,
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 12,
            boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
            padding: 8,
          }}
        >
          <div style={{
            fontSize: 12, fontWeight: 600, letterSpacing: "0.08em",
            textTransform: "uppercase", color: "var(--text-muted)",
            padding: "8px 12px",
          }}>
            Recent Deals
          </div>
          <div className="flex flex-col">
            {recentDeals.map((d) => (
              <button
                key={d.id}
                onClick={() => { setOpen(false); navigate(`/deals/${d.id}`); }}
                className="flex items-center justify-between transition-colors"
                style={{
                  gap: 12, padding: "8px 12px", borderRadius: 8,
                  background: "transparent", border: "none", cursor: "pointer",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(36,60,81,0.06)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                <span className="truncate" style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>
                  {d.name ?? d.franchisee}
                </span>
                <DealStatusBadge status={d.status} />
              </button>
            ))}
          </div>
        </div>
      )}
    </span>
  );
}

function UserProfileMenu({
  displayName,
  displayEmail,
  initial,
  compact = false,
}: {
  displayName: string;
  displayEmail: string;
  initial: string;
  compact?: boolean;
}) {
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  const openSettings = () => {
    setOpen(false);
    navigate("/settings");
  };

  const logout = async () => {
    if (signingOut) return;
    setSigningOut(true);
    await signOutOfSupabase();
  };

  return (
    <div ref={ref} className="relative flex items-center" style={{ zIndex: 220 }}>
      <button
        type="button"
        aria-label="User menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex items-center transition-colors"
        style={{
          gap: 8,
          minHeight: compact ? 28 : 40,
          maxWidth: compact ? 32 : 260,
          borderRadius: compact ? "50%" : 10,
          background: "transparent",
          border: "none",
          padding: compact ? 0 : "4px 6px",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span
          className="flex shrink-0 items-center justify-center"
          style={{
            width: compact ? 28 : 32,
            height: compact ? 28 : 32,
            borderRadius: compact ? "50%" : 8,
            background: compact ? "rgba(36,60,81,0.08)" : "var(--bg-card)",
            backdropFilter: compact ? undefined : "blur(12px)",
            border: compact ? "none" : "1px solid var(--border-subtle)",
            boxShadow: compact ? undefined : "0 1px 4px rgba(36,60,81,0.06)",
            color: "var(--text-tertiary)",
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          {compact ? initial : <User className="w-4 h-4" />}
        </span>

        {!compact && (
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[12px] font-semibold" style={{ color: "var(--text-primary)", lineHeight: 1.4 }}>{displayName}</span>
            <span className="truncate text-[12px]" style={{ color: "var(--text-muted)", lineHeight: 1.4 }}>{displayEmail}</span>
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute"
          style={{
            right: 0,
            top: compact ? "calc(100% + 12px)" : "calc(100% + 10px)",
            width: compact ? 220 : 250,
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 14,
            boxShadow: "0 18px 42px rgba(0,0,0,0.30)",
            padding: 10,
            zIndex: 1000,
          }}
        >
          <button
            type="button"
            role="menuitem"
            onClick={openSettings}
            className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-sm"
            style={{ color: "var(--text-primary)" }}
          >
            <SettingsIcon className="h-4 w-4" style={{ color: "var(--text-muted)" }} />
            Settings
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={logout}
            disabled={signingOut}
            className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-sm disabled:opacity-60"
            style={{ color: "#b91c1c" }}
          >
            <LogOut className="h-4 w-4" />
            {signingOut ? "Logging out..." : "Logout"}
          </button>
        </div>
      )}
    </div>
  );
}

interface HeaderBarProps {
  onMobileMenuToggle?: () => void;
}

export function HeaderBar({ onMobileMenuToggle }: HeaderBarProps) {
  const crumbs = useBreadcrumbs();
  const isCompact = useIsCompact();
  const profile = useCurrentProfile();
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const location = useLocation();
  const displayName = profile?.fullName || profile?.username || profile?.email || "User";
  const displayEmail = profile?.email || "";
  const initial = displayName.trim()[0]?.toUpperCase() ?? "U";

  // Get page title for compact header
  const pageTitle = pageTitles[location.pathname] || crumbs[crumbs.length - 1]?.label || "";

  // Compact header (mobile + tablet < 1024px)
  if (isCompact) {
    return (
      <header
        className="h-[52px] px-[12px] flex items-center justify-between shrink-0 sticky top-0 z-30"
        style={{
          background: "var(--bg-header)",
          backdropFilter: "blur(20px) saturate(160%)",
          WebkitBackdropFilter: "blur(20px) saturate(160%)",
          borderBottom: "0.56px solid var(--border-header)",
          transition: "background 0.30s ease",
          zIndex: 120,
        }}
      >
        {/* Search overlay */}
        {mobileSearchOpen && (
          <div className="absolute inset-0 z-50 flex items-center px-3" style={{ background: "var(--bg-header)" }}>
            <GlobalSearch />
            <button
              onClick={() => setMobileSearchOpen(false)}
              className="ml-2 p-2"
              style={{ color: "var(--text-muted)" }}
              aria-label="Close search"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Left: hamburger */}
        <button
          onClick={onMobileMenuToggle}
          aria-label="Open menu"
          className="flex items-center justify-center"
          style={{ width: 32, height: 32, color: "var(--text-primary)" }}
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Center: page title */}
        <span style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>
          {pageTitle}
        </span>

        {/* Right: search + bell + avatar */}
        <div className="flex items-center gap-[8px]">
          <button
            onClick={() => setMobileSearchOpen(true)}
            aria-label="Search"
            className="flex items-center justify-center"
            style={{ width: 32, height: 32, color: "var(--text-tertiary)" }}
          >
            <Search className="w-4 h-4" />
          </button>
          <NotificationsPopover mobile />
          <UserProfileMenu displayName={displayName} displayEmail={displayEmail} initial={initial} compact />
        </div>
      </header>
    );
  }

  // Desktop header (>=1024px)
  return (
    <header
      className="h-[56px] px-[24px] flex items-center justify-between shrink-0 sticky top-0 z-30"
      style={{
        background: "var(--bg-header)",
        backdropFilter: "blur(20px) saturate(160%)",
        WebkitBackdropFilter: "blur(20px) saturate(160%)",
        borderBottom: "0.56px solid var(--border-header)",
        transition: "background 0.30s ease",
        zIndex: 120,
      }}
    >
      <nav className="flex items-center gap-[8px] text-[12px] min-w-0">
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <span key={i} className="flex items-center gap-[8px] min-w-0">
              {i > 0 && (
                <span style={{ color: "var(--text-muted)" }}>/</span>
              )}
              {crumb.to && !isLast ? (
                crumb.brandId ? (
                  <BrandCrumbWithRecents crumb={crumb} />
                ) : (
                  <Link
                    to={crumb.to}
                    className="hover:underline truncate"
                    style={{ color: "var(--text-muted)", fontWeight: 400 }}
                  >
                    {crumb.label}
                  </Link>
                )
              ) : (
                <span
                  className="truncate"
                  style={{
                    color: "var(--text-primary)",
                    fontWeight: isLast && crumbs.length > 1 ? 600 : 500,
                  }}
                >
                  {crumb.label}
                </span>
              )}
            </span>
          );
        })}
      </nav>

      <div className="flex items-center gap-[12px]">
        <div role="search">
          <GlobalSearch />
        </div>

        <NotificationsPopover />

        <div className="flex items-center gap-[8px] pl-[12px]" style={{ borderLeft: "1px solid var(--border-subtle)" }}>
          <UserProfileMenu displayName={displayName} displayEmail={displayEmail} initial={initial} />
        </div>
      </div>
    </header>
  );
}
