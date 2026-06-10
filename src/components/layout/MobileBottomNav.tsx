import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, Grid3X3, Filter, Handshake } from "lucide-react";

const tabs = [
  { label: "Dashboard", to: "/", icon: LayoutDashboard },
  { label: "Brands", to: "/brands", icon: Grid3X3 },
  { label: "Prospects", to: "/bizdev", icon: Filter },
  { label: "Deals", to: "/deals", icon: Handshake },
];

export function MobileBottomNav() {
  const location = useLocation();

  return (
    <nav className="mobile-bottom-nav">
      {tabs.map((tab) => {
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
            <tab.icon style={{ width: 20, height: 20 }} />
            <span>{tab.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
