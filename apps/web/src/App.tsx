import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { AppShell } from './components/layout/AppShell';
import Login from './pages/Login';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const DashboardPremium = lazy(() => import('./pages/DashboardPremium'));
const Leads = lazy(() => import('./pages/Leads'));
const Pipeline = lazy(() => import('./pages/Pipeline'));
const LeadDetail = lazy(() => import('./pages/LeadDetail'));
const LeadNew = lazy(() => import('./pages/LeadNew'));
const Tasks = lazy(() => import('./pages/Tasks'));
const Proposals = lazy(() => import('./pages/Proposals'));
const Automations = lazy(() => import('./pages/Automations'));
const Webhooks = lazy(() => import('./pages/Webhooks'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Ads = lazy(() => import('./pages/Ads'));
const AiAssistant = lazy(() => import('./pages/AiAssistant'));
const Settings = lazy(() => import('./pages/Settings'));
const Profile = lazy(() => import('./pages/Profile'));

function PageFallback() {
  return (
    <div className="flex min-h-[240px] items-center justify-center text-sm font-semibold text-graphite-soft" role="status">
      Carregando módulo...
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<PageFallback />}>
          <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route path="/" element={<ProtectedRoute requiredPermission="page.dashboard"><DashboardPremium /></ProtectedRoute>} />
              <Route path="/dashboard-classic" element={<ProtectedRoute requiredPermission="page.dashboard"><Dashboard /></ProtectedRoute>} />
              <Route path="/dashboard-premium" element={<ProtectedRoute requiredPermission="page.dashboard"><DashboardPremium /></ProtectedRoute>} />
              <Route path="/leads" element={<ProtectedRoute requiredAnyPermission={["page.leads", "lead.view"]}><Leads /></ProtectedRoute>} />
              <Route path="/leads/novo" element={<ProtectedRoute requiredAnyPermission={["page.leads", "lead.create"]}><LeadNew /></ProtectedRoute>} />
              <Route path="/leads/:id" element={<ProtectedRoute requiredAnyPermission={["page.lead_detail", "lead.view"]}><LeadDetail /></ProtectedRoute>} />
              <Route path="/pipeline" element={<ProtectedRoute requiredPermission="page.pipeline"><Pipeline /></ProtectedRoute>} />
              <Route path="/tasks" element={<ProtectedRoute requiredPermission="page.tasks"><Tasks /></ProtectedRoute>} />
              <Route path="/proposals" element={<ProtectedRoute requiredAnyPermission={["page.proposals", "proposal.view"]}><Proposals /></ProtectedRoute>} />
              <Route path="/automations" element={<ProtectedRoute requiredAnyPermission={["page.automations", "automation.manage"]}><Automations /></ProtectedRoute>} />
              <Route path="/webhooks" element={<ProtectedRoute requiredAnyPermission={["page.webhooks", "webhook.manage", "webhook.test"]}><Webhooks /></ProtectedRoute>} />
              <Route path="/analytics" element={<ProtectedRoute requiredAnyPermission={["page.analytics", "analytics.view", "tracking.view"]}><Analytics /></ProtectedRoute>} />
              <Route path="/ads" element={<ProtectedRoute requiredAnyPermission={["page.ads", "ads.view"]}><Ads /></ProtectedRoute>} />
              <Route path="/ai" element={<ProtectedRoute requiredAnyPermission={["page.ai_assistant"]}><AiAssistant /></ProtectedRoute>} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/settings" element={<ProtectedRoute requiredAnyPermission={["page.settings", "settings.manage", "user.manage"]}><Settings /></ProtectedRoute>} />
              <Route path="/users" element={<ProtectedRoute requiredAnyPermission={["user.manage"]}><Navigate to="/settings?tab=users" replace /></ProtectedRoute>} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
