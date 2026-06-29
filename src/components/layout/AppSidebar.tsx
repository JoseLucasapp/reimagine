import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Grid3X3, Filter, Handshake, Ruler, Star,
  Settings, Map, ChevronLeft, ChevronRight, Sun, Moon, Eye,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";
import { useIsCompact } from "@/hooks/use-mobile";
import { useIsRolePreview, useScopedUser, useUserRole, roleStore, ROLE_LABELS, canSeeRoute } from "@/hooks/useUserRole";
import { toast } from "sonner";
import logoFull from "@/assets/logo-full.png";
import logoFullDark from "@/assets/logo-full-dark.png";
import logoIcon from "@/assets/logo-icon.png";

type SidebarItem = {
  label: string;
  to: string;
  icon: LucideIcon;
};

const group1 = [
  { label: "Dashboard", to: "/", icon: LayoutDashboard },
  { label: "Brands", to: "/brands", icon: Grid3X3 },
  { label: "Prospects", to: "/bizdev", icon: Filter },
  { label: "Deals", to: "/deals", icon: Handshake },
] satisfies SidebarItem[];

const group2 = [
  { label: "Map", to: "/map", icon: Map },
  { label: "Space Reqs", to: "/space-requirements", icon: Ruler },
  { label: "One-Off Deals", to: "/one-off", icon: Star },
] satisfies SidebarItem[];

const bottomNav = [
  { label: "Settings", to: "/settings", icon: Settings },
] satisfies SidebarItem[];

interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
}

export function AppSidebar({ collapsed, onToggle, onNavigate }: AppSidebarProps) {
  const location = useLocation();
  const { toggle, isDark } = useTheme();
  const isCompact = useIsCompact();
  const role = useUserRole();
  const user = useScopedUser();
  const isPreviewing = useIsRolePreview();

  // In compact mode (mobile/tablet drawer), always show full sidebar
  const effectiveCollapsed = isCompact ? false : collapsed;
  const showLabels = !effectiveCollapsed;

  // Filter nav items by what the active role can access.
  const visibleGroup1 = group1.filter((i) => canSeeRoute(user ?? role, i.to));
  const visibleGroup2 = group2.filter((i) => canSeeRoute(user ?? role, i.to));
  const visibleBottomNav = bottomNav.filter((i) => canSeeRoute(user ?? role, i.to));

  const handleExitPreview = () => {
    roleStore.resetToAdmin();
    toast.success(`Now viewing as ${ROLE_LABELS.admin}`);
  };

  const isActive = (path: string) =>
    location.pathname === path || (path !== "/" && location.pathname.startsWith(path));

  const renderLinks = (items: SidebarItem[]) =>
    items.map((item) => {
      const active = isActive(item.to);
      return (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/"}
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-[16px] rounded-[8px] text-[14px] font-medium transition-all duration-200 relative min-h-[40px]",
            active ? "font-semibold" : "",
            !showLabels && "justify-center"
          )}
          style={active ? {
            padding: showLabels ? "8px 12px" : "8px",
            background: "rgba(225,135,57,0.20)",
            color: isDark ? "#fbbf24" : "#92400E",
            border: "1px solid rgba(225,135,57,0.20)",
          } : {
            padding: showLabels ? "8px 12px" : "8px",
            border: "1px solid transparent",
            color: "var(--sidebar-nav-default)",
          }}
          title={!showLabels ? item.label : undefined}
        >
          {active && (
            <div
              className="absolute left-0 top-1/2"
              style={{ width: 3, height: 16, background: "#E18739", borderRadius: "0 2px 2px 0", transform: "translateY(-50%)" }}
            />
          )}
          <item.icon className="w-4 h-4 shrink-0" />
          {showLabels && <span className="truncate">{item.label}</span>}
        </NavLink>
      );
    });

  return (
    <aside
      className={cn(
        "h-full flex flex-col shrink-0 relative z-40",
        isCompact ? "w-full" : effectiveCollapsed ? "w-[56px]" : "w-[196px]"
      )}
      style={{
        background: "var(--bg-surface)",
        borderRight: isCompact ? "none" : "1px solid var(--border-subtle)",
        boxShadow: isCompact ? "none" : "var(--shadow-sidebar)",
        transition: "background 0.30s ease, width 0.3s ease",
      }}
    >
      {/* Logo */}
      <div className="h-[56px] flex items-center px-3 shrink-0" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        {effectiveCollapsed ? (
          <img src={logoIcon} alt="Reimagine" className="w-[32px] h-[32px] mx-auto" />
        ) : (
          <img src={isDark ? logoFullDark : logoFull} alt="Reimagine Commercial Real Estate" className="h-[28px] w-auto" />
        )}
      </div>

      {/* Nav groups */}
      <nav className="flex-1 py-4 px-[12px] overflow-y-auto" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {showLabels && (
          <p className="px-[12px] text-[12px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--sidebar-section-label)", marginTop: 0, marginBottom: 4 }}>
            Main
          </p>
        )}
        {renderLinks(visibleGroup1)}
        {visibleGroup2.length > 0 && (
          <>
            {showLabels && (
              <p className="px-[12px] text-[12px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--sidebar-section-label)", marginTop: 16, marginBottom: 4 }}>
                Tools
              </p>
            )}
            {renderLinks(visibleGroup2)}
          </>
        )}
      </nav>

      {/* Bottom: toggle + settings + collapse */}
      <div className="px-[12px] pb-4 space-y-1 pt-[12px]" style={{ borderTop: "1px solid var(--border-divider)" }}>
        {/* Theme toggle */}
        <button
          onClick={toggle}
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          className={cn("flex items-center w-full rounded-[8px] min-h-[40px]", showLabels ? "justify-between" : "justify-center")}
          style={{
            padding: showLabels ? "8px 12px" : "8px",
            background: "var(--toggle-row-bg)",
            border: "1px solid var(--toggle-row-border)",
            marginBottom: 8,
            transition: "background 0.25s ease, border-color 0.25s ease",
          }}
        >
          <div className="flex items-center gap-[8px]">
            {isDark ? (
              <Moon className="w-4 h-4" style={{ color: "#c0deed" }} />
            ) : (
              <Sun className="w-4 h-4" style={{ color: "#E18739" }} />
            )}
            {showLabels && (
              <span style={{ fontSize: 12, fontWeight: 500, color: isDark ? "rgba(255,255,255,0.60)" : "var(--text-secondary)" }}>
                {isDark ? "Dark Mode" : "Light Mode"}
              </span>
            )}
          </div>
          {showLabels && (
            <div
              className="relative shrink-0"
              style={{ width: 32, height: 20, borderRadius: 9999, background: "var(--toggle-track)", transition: "background 0.25s ease" }}
            >
              <div
                className="absolute top-[2px] rounded-full bg-white"
                style={{
                  width: 16, height: 16,
                  left: isDark ? 16 : 2,
                  boxShadow: "0 1px 4px rgba(0,0,0,0.20)",
                  transition: "left 0.25s ease",
                }}
              />
            </div>
          )}
        </button>

        {/* Role preview banner — shown when a non-admin role is active */}
        {isPreviewing && (
          <div
            style={{
              marginBottom: 8,
              padding: showLabels ? "8px 12px" : 8,
              borderRadius: 8,
              border: "1px solid rgba(225,135,57,0.32)",
              background: "rgba(225,135,57,0.10)",
              display: "flex",
              flexDirection: showLabels ? "column" : "row",
              alignItems: showLabels ? "stretch" : "center",
              justifyContent: "center",
              gap: 4,
            }}
            title={!showLabels ? `Viewing as: ${ROLE_LABELS[role]}` : undefined}
          >
            {showLabels ? (
              <>
                <div className="flex items-center" style={{ gap: 8 }}>
                  <Eye style={{ width: 12, height: 12, color: "#E18739", flexShrink: 0 }} />
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      color: isDark ? "#fbbf24" : "#92400E",
                    }}
                  >
                    Viewing as
                  </span>
                </div>
                <div className="flex items-center justify-between" style={{ gap: 8 }}>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--text-primary)",
                      lineHeight: 1.2,
                    }}
                  >
                    {ROLE_LABELS[role]}
                  </span>
                  <button
                    type="button"
                    onClick={handleExitPreview}
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#E18739",
                      cursor: "pointer",
                      textDecoration: "underline",
                      textUnderlineOffset: 2,
                    }}
                  >
                    Exit
                  </button>
                </div>
              </>
            ) : (
              <Eye style={{ width: 16, height: 16, color: "#E18739" }} />
            )}
          </div>
        )}

        {renderLinks(visibleBottomNav)}

        {/* Collapse button only on desktop */}
        {!isCompact && (
          <button
            onClick={onToggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex items-center gap-[12px] px-[12px] py-[8px] rounded-[8px] text-[14px] font-medium transition-colors w-full min-h-[40px]"
            style={{ color: "var(--text-muted)" }}
          >
            {collapsed ? <ChevronRight className="w-4 h-4 shrink-0" /> : <ChevronLeft className="w-4 h-4 shrink-0" />}
            {!collapsed && <span>Collapse</span>}
          </button>
        )}
      </div>
    </aside>
  );
}
