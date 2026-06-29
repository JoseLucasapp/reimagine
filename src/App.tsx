import { lazy, Suspense, useEffect, useState } from "react";
import type { AuthSession } from "@/application/auth/session";
import { AUTH_SESSION_EVENT, getStoredSession, persistSession } from "@/application/auth/session";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import LoginPage from "./pages/LoginPage";
import { RouteGuard } from "@/components/access/RouteGuard";
import { AppDataProvider } from "@/application/data/AppDataProvider";

const queryClient = new QueryClient();

const PlatformHome = lazy(() => import("./pages/PlatformHome"));
const MapView = lazy(() => import("./pages/MapView"));
const DealsPage = lazy(() => import("./pages/Deals"));
const DealDetail = lazy(() => import("./pages/DealDetail"));
const BrandDeals = lazy(() => import("./pages/BrandDeals"));
const BrandsPage = lazy(() => import("./pages/Brands"));
const BizDevPage = lazy(() => import("./pages/BizDev"));
const SpaceRequirementsPage = lazy(() => import("./pages/SpaceRequirements"));
const OneOffDealsPage = lazy(() => import("./pages/OneOffDeals"));
const SettingsPage = lazy(() => import("./pages/Settings"));
const NotFound = lazy(() => import("./pages/NotFound"));
const TourBookPage = lazy(() => import("./pages/TourBookPage"));
const FranchisorDashboard = lazy(() => import("./pages/FranchisorDashboard"));
const FranchiseeDashboard = lazy(() => import("./pages/FranchiseeDashboard"));

function RouteLoadingFallback() {
  return (
    <div className="flex min-h-[420px] items-center justify-center px-6">
      <div
        className="rounded-xl px-5 py-4 text-sm font-semibold"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          boxShadow: "var(--shadow-card)",
          color: "var(--text-secondary)",
        }}
      >
        Loading page...
      </div>
    </div>
  );
}

function MainAppRoutes() {
  return (
    <AppLayout>
      <Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
          <Route path="/" element={<PlatformHome />} />
          <Route path="/brand" element={<FranchisorDashboard />} />
          <Route path="/deal" element={<FranchiseeDashboard />} />
          <Route path="/franchisor" element={<Navigate to="/brand" replace />} />
          <Route path="/franchisee" element={<Navigate to="/deal" replace />} />
          <Route path="/brands" element={<BrandsPage />} />
          <Route path="/brands/:brandId/deals" element={<BrandDeals />} />
          <Route path="/bizdev" element={<BizDevPage />} />
          <Route path="/deals" element={<DealsPage />} />
          <Route path="/deals/:dealId" element={<DealDetail />} />
          <Route path="/map" element={<MapView />} />
          <Route path="/space-requirements" element={<SpaceRequirementsPage />} />
          <Route path="/one-off" element={<OneOffDealsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </AppLayout>
  );
}

const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(() => getStoredSession() !== null);

  useEffect(() => {
    const syncSessionState = () => {
      setIsLoggedIn(getStoredSession() !== null);
    };
    window.addEventListener(AUTH_SESSION_EVENT, syncSessionState);
    return () => window.removeEventListener(AUTH_SESSION_EVENT, syncSessionState);
  }, []);

  const handleLogin = (session: AuthSession) => {
    // Persist the authenticated platform role. The default seeded account is Admin,
    // while real Brand Level and Deal Level accounts now open their own platforms.
    persistSession(session);
    setIsLoggedIn(true);
  };

  if (!isLoggedIn) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <LoginPage onLogin={handleLogin} />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AppDataProvider>
          <BrowserRouter>
            <Routes>
              <Route
                path="/tour-book-generator"
                element={
                  <RouteGuard>
                    <Suspense fallback={<RouteLoadingFallback />}>
                      <TourBookPage />
                    </Suspense>
                  </RouteGuard>
                }
              />
              <Route
                path="*"
                element={
                  <RouteGuard>
                    <MainAppRoutes />
                  </RouteGuard>
                }
              />
            </Routes>
          </BrowserRouter>
        </AppDataProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
