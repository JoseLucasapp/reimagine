import { useState } from "react";
import { AppSidebar } from "./AppSidebar";
import { HeaderBar } from "./HeaderBar";
import { MobileBottomNav } from "./MobileBottomNav";
import { useIsMobile, useIsCompact } from "@/hooks/use-mobile";

function GlassBackground() {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
      <div
        className="absolute inset-0 transition-all duration-500"
        style={{ background: "var(--bg-scene)" }}
      />
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: 704, height: 704, top: -200, left: -152,
          background: "var(--orb-1)",
          filter: "blur(88px)",
          animation: "orb-drift 14s ease-in-out infinite alternate",
          animationDelay: "0s",
          transition: "opacity 0.40s ease",
        }}
      />
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: 496, height: 496, top: "20%", right: -96,
          background: "var(--orb-2)",
          filter: "blur(88px)",
          animation: "orb-drift 14s ease-in-out infinite alternate",
          animationDelay: "-5s",
          transition: "opacity 0.40s ease",
        }}
      />
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: 448, height: 448, bottom: 0, left: "20%",
          background: "var(--orb-3)",
          filter: "blur(88px)",
          animation: "orb-drift 14s ease-in-out infinite alternate",
          animationDelay: "-9s",
          transition: "opacity 0.40s ease",
        }}
      />
      <svg
        className="absolute bottom-0 right-0 pointer-events-none"
        width="520" height="420" viewBox="0 0 520 420"
        style={{ opacity: 0.035 }}
      >
        <rect x="80" y="40" width="180" height="260" stroke="currentColor" strokeWidth="1" fill="none" />
        <rect x="280" y="100" width="100" height="180" stroke="currentColor" strokeWidth="1" fill="none" />
        <rect x="400" y="60" width="72" height="128" stroke="currentColor" strokeWidth="1" fill="none" />
        <path d="M80 300 L260 300 L340 180" stroke="currentColor" strokeWidth="1" fill="none" />
      </svg>
    </div>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const isMobile = useIsMobile();
  const isCompact = useIsCompact(); // true for mobile + tablet (<1024px)

  return (
    <div className="h-screen flex overflow-hidden relative">
      <GlassBackground />
      <div className="relative z-10 flex w-full h-full">
        {/* Desktop sidebar (>=1024px) */}
        {!isCompact && (
          <AppSidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
        )}

        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <HeaderBar onMobileMenuToggle={() => setMenuOpen(!menuOpen)} />
          <main
            className="flex-1 overflow-auto"
            style={{
              background: "var(--bg-main)",
              paddingBottom: isMobile ? 72 : 0,
            }}
          >
            {children}
          </main>
        </div>
      </div>

      {/* Mobile + Tablet slide-over sidebar */}
      {isCompact && menuOpen && (
        <>
          <div className="mobile-sidebar-overlay" onClick={() => setMenuOpen(false)} />
          <div className="mobile-sidebar-drawer">
            <AppSidebar
              collapsed={false}
              onToggle={() => setMenuOpen(false)}
              onNavigate={() => setMenuOpen(false)}
            />
          </div>
        </>
      )}

      {/* Mobile bottom nav */}
      {isMobile && <MobileBottomNav />}
    </div>
  );
}
