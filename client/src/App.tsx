import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { UserProvider } from "@/components/UserContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Dashboard from "@/pages/Dashboard";
import AdminConsole from "@/pages/AdminConsole";
import ClientLogin from "@/pages/ClientLogin";
import AdminLogin from "@/pages/AdminLogin";
import WorkerForm from "@/pages/WorkerForm";
import InjuryFormPage from "@/pages/InjuryForm";
import RtwPlans from "@/pages/RtwPlans";
import Stakeholders from "@/pages/Stakeholders";
import FitForWorkAssessment from "@/pages/FitForWorkAssessment";
import RtwCompliance from "@/pages/RtwCompliance";
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
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="gpnet-ui-theme">
        <UserProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
            <MichelleWidget />
          </TooltipProvider>
        </UserProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
