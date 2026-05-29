import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './useAuth';

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-warm-white flex items-center justify-center text-graphite">
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm px-6 py-4">
          <p className="text-sm font-medium">Validando sessão...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;

  return <Outlet />;
}
