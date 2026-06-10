import { NavLink as RouterNavLink, useLocation } from "react-router-dom";
import { Settings, User, Search } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", to: "/" },
  { label: "Map", to: "/map" },
  { label: "Deals", to: "/deals" },
  { label: "Franchisor", to: "/franchisor" },
  { label: "Franchisee", to: "/franchisee" },
];

export function TopNav() {
  const location = useLocation();

  return (
    <header className="h-14 border-b border-border bg-primary px-6 flex items-center justify-between shrink-0 z-50">
      {/* Left: Logo + Nav */}
      <div className="flex items-center gap-8">
        <RouterNavLink to="/" className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-brand-orange rounded flex items-center justify-center font-bold text-white text-base tracking-tight">
            R
          </div>
          <div className="hidden sm:flex flex-col leading-none">
            <span className="text-primary-foreground font-bold text-sm tracking-[0.15em] uppercase">
              Reimagine
            </span>
            <span className="text-brand-sky text-[12px] font-semibold tracking-[0.2em] uppercase">
              Commercial Real Estate
            </span>
          </div>
        </RouterNavLink>

        {/* Primary Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.to;
            return (
              <RouterNavLink
                key={item.to}
                to={item.to}
                className={cn(
                  "px-4 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors rounded",
                  isActive
                    ? "bg-brand-sky/20 text-brand-sky"
                    : "text-primary-foreground/60 hover:text-primary-foreground hover:bg-white/5"
                )}
              >
                {item.label}
              </RouterNavLink>
            );
          })}
        </nav>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        <button className="p-2 text-primary-foreground/60 hover:text-primary-foreground transition-colors rounded hover:bg-white/5">
          <Search className="w-4 h-4" />
        </button>
        <button className="p-2 text-primary-foreground/60 hover:text-primary-foreground transition-colors rounded hover:bg-white/5">
          <Settings className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2.5 ml-2 pl-3 border-l border-white/15">
          <div className="w-8 h-8 rounded bg-brand-sky/20 flex items-center justify-center text-brand-sky">
            <User className="w-4 h-4" />
          </div>
          <div className="hidden lg:block">
            <p className="text-xs font-semibold text-primary-foreground leading-tight">Admin</p>
            <p className="text-[12px] text-primary-foreground/50">admin@reimagineiq.com</p>
          </div>
        </div>
      </div>
    </header>
  );
}
