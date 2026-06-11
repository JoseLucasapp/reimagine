import { useState } from "react";
import type { AuthSession } from "@/application/auth/session";
import { getStoredSession, persistSession } from "@/application/auth/session";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import Dashboard from "./pages/Dashboard";
import MapView from "./pages/MapView";
import DealsPage from "./pages/Deals";
import DealDetail from "./pages/DealDetail";
import BrandDeals from "./pages/BrandDeals";
import BrandsPage from "./pages/Brands";
import BizDevPage from "./pages/BizDev";
import SpaceRequirementsPage from "./pages/SpaceRequirements";
import OneOffDealsPage from "./pages/OneOffDeals";
import SettingsPage from "./pages/Settings";
import NotFound from "./pages/NotFound";
import TourBookPage from "./pages/TourBookPage";
import LoginPage from "./pages/LoginPage";
import { RouteGuard } from "@/components/access/RouteGuard";
import { AppDataProvider } from "@/application/data/AppDataProvider";

const queryClient = new QueryClient();

function MainAppRoutes() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
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
    </AppLayout>
  );
}

const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(() => getStoredSession() !== null);

  const handleLogin = (session: AuthSession) => {
    // The app should open in Admin preview by default after login. Users can
    // still switch to Brand Level or Deal Level from Settings.
    persistSession({ ...session, role: "admin" });
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
                    <TourBookPage />
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
