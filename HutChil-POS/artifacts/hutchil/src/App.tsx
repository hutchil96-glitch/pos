import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AuthProvider } from "@/hooks/use-auth";
import { useEffect } from "react";

import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Sale from "@/pages/sale";
import Stock from "@/pages/stock";
import Costs from "@/pages/costs";
import History from "@/pages/history";
import Payroll from "@/pages/payroll";
import Audit from "@/pages/audit";
import Settings from "@/pages/settings";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/sale" component={Sale} />
      <Route path="/stock" component={Stock} />
      <Route path="/costs" component={Costs} />
      <Route path="/history" component={History} />
      <Route path="/payroll" component={Payroll} />
      <Route path="/audit" component={Audit} />
      <Route path="/settings" component={Settings} />
      <Route path="/">
        <Redirect to="/sale" />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
