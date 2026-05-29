import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { AppShell } from './components/layout/AppShell';
import Dashboard from './pages/Dashboard';
import Leads from './pages/Leads';
import Pipeline from './pages/Pipeline';
import LeadDetail from './pages/LeadDetail';
import Tasks from './pages/Tasks';
import Automations from './pages/Automations';
import Webhooks from './pages/Webhooks';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import UsersPermissions from './pages/UsersPermissions';
import Login from './pages/Login';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/leads" element={<Leads />} />
              <Route path="/leads/:id" element={<LeadDetail />} />
              <Route path="/pipeline" element={<Pipeline />} />
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/automations" element={<Automations />} />
              <Route path="/webhooks" element={<Webhooks />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/users" element={<ProtectedRoute requiredAnyPermission={["page.users", "user.manage"]}><UsersPermissions /></ProtectedRoute>} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
