import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense } from "react";
import Index from "./pages/index";
import ProtectedRoute from "./components/ProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary";
import SafeSuspenseFallback from "./components/SafeSuspenseFallback";

// Lazy-loaded routes for code splitting
const PinEntry = lazy(() => import("./pages/parent/PinEntry"));
const PinSetup = lazy(() => import("./pages/parent/PinSetup"));
const ParentLayout = lazy(() => import("./components/ParentLayout"));
const DashboardOverview = lazy(() => import("./pages/parent/DashboardOverview"));
const ActivityFeed = lazy(() => import("./pages/parent/ActivityFeed"));
const SafetyAlerts = lazy(() => import("./pages/parent/SafetyAlerts"));
const UsageAnalytics = lazy(() => import("./pages/parent/UsageAnalytics"));
const LearningIntelligence = lazy(() => import("./pages/parent/LearningIntelligence"));
const ScreenTimeControls = lazy(() => import("./pages/parent/ScreenTimeControls"));
const ParentSettings = lazy(() => import("./pages/parent/ParentSettings"));
const PolicySettings = lazy(() => import("./pages/parent/PolicySettings"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <Routes>
          {/* Child/Public Routes */}
          <Route
            path="/"
            element={
              <ErrorBoundary variant="child">
                <Index />
              </ErrorBoundary>
            }
          />
          
          {/* Parent Auth Entry */}
          <Route
            path="/parent"
            element={
              <ErrorBoundary variant="parent">
                <Suspense fallback={<SafeSuspenseFallback />}>
                  <PinEntry />
                </Suspense>
              </ErrorBoundary>
            }
          />
          <Route
            path="/parent/setup"
            element={
              <ErrorBoundary variant="parent">
                <Suspense fallback={<SafeSuspenseFallback />}>
                  <PinSetup />
                </Suspense>
              </ErrorBoundary>
            }
          />
          
          {/* Protected Parent Dashboard Routes */}
          <Route
            path="/parent-dashboard"
            element={
              <ProtectedRoute>
                <ErrorBoundary variant="parent">
                  <Suspense fallback={<SafeSuspenseFallback />}>
                    <ParentLayout />
                  </Suspense>
                </ErrorBoundary>
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="overview" replace />} />
            <Route path="overview" element={<DashboardOverview />} />
            <Route path="activity" element={<ActivityFeed />} />
            <Route path="safety" element={<SafetyAlerts />} />
            <Route path="analytics" element={<UsageAnalytics />} />
            <Route path="intelligence" element={<LearningIntelligence />} />
            <Route path="screen-time" element={<ScreenTimeControls />} />
            <Route path="settings" element={<ParentSettings />} />
            <Route path="policy" element={<PolicySettings />} />
          </Route>

          {/* Fallback */}
          <Route
            path="*"
            element={
              <Suspense fallback={<SafeSuspenseFallback />}>
                <NotFound />
              </Suspense>
            }
          />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
