import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/index";
import NotFound from "./pages/NotFound";
import PinEntry from "./pages/parent/PinEntry";
import PinSetup from "./pages/parent/PinSetup";
import ParentLayout from "./components/ParentLayout";
import DashboardOverview from "./pages/parent/DashboardOverview";
import ActivityFeed from "./pages/parent/ActivityFeed";
import SafetyAlerts from "./pages/parent/SafetyAlerts";
import UsageAnalytics from "./pages/parent/UsageAnalytics";
import LearningIntelligence from "./pages/parent/LearningIntelligence";
import ScreenTimeControls from "./pages/parent/ScreenTimeControls";
import ParentSettings from "./pages/parent/ParentSettings";
import PolicySettings from "./pages/parent/PolicySettings";
import ProtectedRoute from "./components/ProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary";

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
                <PinEntry />
              </ErrorBoundary>
            }
          />
          <Route
            path="/parent/setup"
            element={
              <ErrorBoundary variant="parent">
                <PinSetup />
              </ErrorBoundary>
            }
          />
          
          {/* Protected Parent Dashboard Routes */}
          <Route
            path="/parent-dashboard"
            element={
              <ProtectedRoute>
                <ErrorBoundary variant="parent">
                  <ParentLayout />
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
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
