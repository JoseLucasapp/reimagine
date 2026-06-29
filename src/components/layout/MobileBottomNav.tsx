import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, Grid3X3, Filter, Handshake, Settings } from "lucide-react";
import { canSeeRoute, useScopedUser, useUserRole } from "@/hooks/useUserRole";

const tabs = [
  { label: "Dashboard", to: "/", icon: LayoutDashboard },
  { label: "Brands", to: "/brands", icon: Grid3X3 },
  { label: "Prospects", to: "/bizdev", icon: Filter },
  { label: "Deals", to: "/deals", icon: Handshake },
  { label: "Settings", to: "/settings", icon: Settings },
];

export function MobileBottomNav() {
  const location = useLocation();
  const role = useUserRole();
  const user = useScopedUser();
  const visibleTabs = tabs.filter((tab) => canSeeRoute(user ?? role, tab.to));

  return (
    <nav className="mobile-bottom-nav">
      {visibleTabs.map((tab) => {
        const isActive =
          tab.to === "/"
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
