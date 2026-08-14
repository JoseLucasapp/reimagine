import { NavLink, useLocation } from "react-router-dom";
import { Compass, LayoutDashboard, Grid3X3, Filter, Handshake, Settings } from "lucide-react";
import { canSeeRoute, useScopedUser, useUserRole } from "@/hooks/useUserRole";

const tabs = [
  { label: "Dashboard", to: "/", icon: LayoutDashboard },
  { label: "Brands", to: "/brands", icon: Grid3X3 },
  { label: "Prospects", to: "/bizdev", icon: Filter },
  { label: "Deals", to: "/deals", icon: Handshake },
  { label: "MapIQ", to: "/map", icon: Compass },
  { label: "Settings", to: "/settings", icon: Settings },
];

export function MobileBottomNav() {
  const location = useLocation();
  const role = useUserRole();
  const user = useScopedUser();
  const scopedTabs = tabs.flatMap((tab) => {
    if (role === "brand") {
      if (tab.to === "/") return [];
      if (tab.to === "/brands") return [{ ...tab, to: "/brand" }];
      return [tab];
    }
    if (role === "deal") {
      if (tab.to === "/") return [];
      if (tab.to === "/deals") return [{ ...tab, to: "/deal" }];
      return [tab];
    }
    return [tab];
  });
  const visibleTabs = scopedTabs.filter((tab) => canSeeRoute(user ?? role, tab.to));

  return (
    <nav className="mobile-bottom-nav">
      {visibleTabs.map((tab) => {
        const isActive =
          tab.to === "/brand"
            ? location.pathname === "/brand" || location.pathname.startsWith("/brands/")
            : tab.to === "/"
            ? location.pathname === "/"
            : location.pathname.startsWith(tab.to);
        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={isActive ? "active" : ""}
            end={tab.to === "/"}
          >
            <tab.icon />
            <span>{tab.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
