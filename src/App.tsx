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

const queryClient = new QueryClient();

const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(() => getStoredSession() !== null);

  const handleLogin = (session: AuthSession) => {
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
        <BrowserRouter>
          <AppLayout>
            <Routes>
              <Route
                path="*"
                element={
                  <RouteGuard>
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
                      <Route path="/tour-book-generator" element={<TourBookPage />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </RouteGuard>
                }
              />
            </Routes>
          </AppLayout>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
