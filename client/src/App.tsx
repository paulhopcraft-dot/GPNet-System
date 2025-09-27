import React from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { UserProvider } from "@/components/UserContext";
import { SearchProvider } from "@/contexts/SearchContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Dashboard from "@/pages/Dashboard";
import WorkerPreEmploymentCheck from "@/pages/WorkerPreEmploymentCheck";
import AdminConsole from "@/pages/AdminConsole";
import ClientLogin from "@/pages/ClientLogin";
import AdminLogin from "@/pages/AdminLogin";
import WorkerForm from "@/pages/WorkerForm";
import InjuryFormPage from "@/pages/InjuryForm";
import RtwPlans from "@/pages/RtwPlans";
import Stakeholders from "@/pages/Stakeholders";
import FitForWorkAssessment from "@/pages/FitForWorkAssessment";
import RtwCompliance from "@/pages/RtwCompliance";
import NatalieDashboard from "@/pages/natalie-dashboard";
import ManagerDashboard from "@/pages/ManagerDashboard";
import CheckManagement from "@/pages/CheckManagement";
import MichelleDialogue from "@/pages/MichelleDialogue";
import Workers from "@/pages/Workers";
import Tickets from "@/pages/Tickets";
import NotFound from "@/pages/not-found";
import { MichelleWidget } from "@/components/MichelleWidget";

function Router() {
  return (
    <Switch>
      {/* Public Routes */}
      <Route path="/login/client" component={ClientLogin} />
      <Route path="/login/admin" component={AdminLogin} />
      <Route path="/form" component={WorkerForm} />
      
      {/* Protected Routes */}
      <Route path="/">
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      </Route>
      
      <Route path="/admin">
        <ProtectedRoute requireAdmin>
          <AdminConsole />
        </ProtectedRoute>
      </Route>
      
      <Route path="/natalie">
        <ProtectedRoute requireAdmin>
          <NatalieDashboard />
        </ProtectedRoute>
      </Route>
      
      <Route path="/manager">
        <ProtectedRoute>
          <ManagerDashboard 
            organizationId="org_demo_001" 
            managerEmail="manager@company.com" 
            managerName="Demo Manager" 
          />
        </ProtectedRoute>
      </Route>
      
      <Route path="/checks">
        <ProtectedRoute requireAdmin>
          <CheckManagement />
        </ProtectedRoute>
      </Route>
      
      <Route path="/michelle">
        <ProtectedRoute>
          <MichelleDialogue />
        </ProtectedRoute>
      </Route>
      
      <Route path="/workers">
        <ProtectedRoute>
          <Workers />
        </ProtectedRoute>
      </Route>
      
      <Route path="/tickets">
        <ProtectedRoute>
          <Tickets />
        </ProtectedRoute>
      </Route>
      
      <Route path="/injury">
        <ProtectedRoute>
          <InjuryFormPage />
        </ProtectedRoute>
      </Route>
      
      <Route path="/rtw-compliance">
        <ProtectedRoute>
          <RtwCompliance />
        </ProtectedRoute>
      </Route>
      
      <Route path="/cases/:ticketId/rtw-plans">
        <ProtectedRoute>
          <RtwPlans />
        </ProtectedRoute>
      </Route>
      
      <Route path="/cases/:ticketId/stakeholders">
        <ProtectedRoute>
          <Stakeholders />
        </ProtectedRoute>
      </Route>
      
      <Route path="/cases/:ticketId/assessment">
        <ProtectedRoute>
          <FitForWorkAssessment />
        </ProtectedRoute>
      </Route>
      
      <Route path="/worker/pre-employment-check" component={WorkerPreEmploymentCheck} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="gpnet-ui-theme">
        <UserProvider>
          <SearchProvider>
            <TooltipProvider>
              <Toaster />
              <Router />
              <MichelleWidget />
            </TooltipProvider>
          </SearchProvider>
        </UserProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
