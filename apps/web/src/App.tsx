import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { AppShell } from './components/layout/AppShell';
import Dashboard from './pages/Dashboard';
import Leads from './pages/Leads';
import Pipeline from './pages/Pipeline';
import LeadDetail from './pages/LeadDetail';
import Tasks from './pages/Tasks';
import Proposals from './pages/Proposals';
import Automations from './pages/Automations';
import Webhooks from './pages/Webhooks';
import Analytics from './pages/Analytics';
import Ads from './pages/Ads';
import Settings from './pages/Settings';
import Login from './pages/Login';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route path="/" element={<ProtectedRoute requiredPermission="page.dashboard"><Dashboard /></ProtectedRoute>} />
              <Route path="/leads" element={<ProtectedRoute requiredAnyPermission={["page.leads", "lead.view"]}><Leads /></ProtectedRoute>} />
              <Route path="/leads/:id" element={<ProtectedRoute requiredAnyPermission={["page.lead_detail", "lead.view"]}><LeadDetail /></ProtectedRoute>} />
              <Route path="/pipeline" element={<ProtectedRoute requiredPermission="page.pipeline"><Pipeline /></ProtectedRoute>} />
              <Route path="/tasks" element={<ProtectedRoute requiredPermission="page.tasks"><Tasks /></ProtectedRoute>} />
              <Route path="/proposals" element={<ProtectedRoute requiredAnyPermission={["page.proposals", "proposal.view"]}><Proposals /></ProtectedRoute>} />
              <Route path="/automations" element={<ProtectedRoute requiredAnyPermission={["page.automations", "automation.manage"]}><Automations /></ProtectedRoute>} />
              <Route path="/webhooks" element={<ProtectedRoute requiredAnyPermission={["page.webhooks", "webhook.manage", "webhook.test"]}><Webhooks /></ProtectedRoute>} />
              <Route path="/analytics" element={<ProtectedRoute requiredAnyPermission={["page.analytics", "analytics.view", "tracking.view"]}><Analytics /></ProtectedRoute>} />
              <Route path="/ads" element={<ProtectedRoute requiredAnyPermission={["page.ads", "ads.view"]}><Ads /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute requiredAnyPermission={["page.settings", "settings.manage", "user.manage"]}><Settings /></ProtectedRoute>} />
              <Route path="/users" element={<ProtectedRoute requiredAnyPermission={["user.manage"]}><Navigate to="/settings?tab=users" replace /></ProtectedRoute>} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
