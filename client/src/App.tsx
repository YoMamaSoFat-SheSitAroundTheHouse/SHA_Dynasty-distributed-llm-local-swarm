import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import ChatPage from "./pages/ChatPage";
import TasksPage from "./pages/TasksPage";
import NodesPage from "./pages/NodesPage";
import CostsPage from "./pages/CostsPage";
import AuditsPage from "./pages/AuditsPage";
import OverviewPage from "./pages/OverviewPage";

function Router() {
  return (
    <Switch>
      <Route path="/" component={OverviewPage} />
      <Route path="/chat" component={ChatPage} />
      <Route path="/chat/:id" component={ChatPage} />
      <Route path="/tasks" component={TasksPage} />
      <Route path="/nodes" component={NodesPage} />
      <Route path="/costs" component={CostsPage} />
      <Route path="/audits" component={AuditsPage} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster theme="dark" position="bottom-right" />
          <DashboardLayout>
            <Router />
          </DashboardLayout>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
