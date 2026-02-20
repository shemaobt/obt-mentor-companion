import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/components/AuthProvider";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { useAuth } from "@/hooks/useAuth";
import Home from "@/pages/home";
import Portfolio from "@/pages/portfolio";
import Settings from "@/pages/settings";
import QRCodePage from "@/pages/qr-code";
import AdminFeedback from "@/pages/admin-feedback";
import AdminUsers from "@/pages/admin-users";
import AdminDocuments from "@/pages/admin-documents";
import AdminPortfolioView from "@/pages/admin-portfolio-view";
import AdminCompetencyRecalc from "@/pages/admin-competency-recalc";
import SupervisorUsers from "@/pages/supervisor-users";
import Login from "@/pages/login";
import Signup from "@/pages/signup";
import NotFound from "@/pages/not-found";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <Switch>
      {!isAuthenticated ? (
        <>
          <Route path="/signup" component={Signup} />
          <Route path="/login" component={Login} />
          <Route path="/" component={Login} />
        </>
      ) : (
        <>
          <Route path="/admin/feedback" component={AdminFeedback} />
          <Route path="/admin/users" component={AdminUsers} />
          <Route path="/admin/documents" component={AdminDocuments} />
          <Route path="/admin/competency-recalc" component={AdminCompetencyRecalc} />
          <Route path="/admin/portfolio/:userId" component={AdminPortfolioView} />
          <Route path="/supervisor/users" component={SupervisorUsers} />
          <Route path="/supervisor/users/:userId/portfolio" component={AdminPortfolioView} />
          <Route path="/portfolio" component={Portfolio} />
          <Route path="/settings" component={Settings} />
          <Route path="/qr-code" component={QRCodePage} />
          <Route path="/chat/:chatId" component={Home} />
          <Route path="/" component={Home} />
          <Route path="*" component={NotFound} />
        </>
      )}
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
