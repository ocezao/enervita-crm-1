import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { userHasAnyPermission, userHasPermission } from './permissions';
import { useAuth } from './useAuth';

type ProtectedRouteProps = {
  children?: ReactNode;
  requiredPermission?: string;
  requiredAnyPermission?: string[];
};

export function ProtectedRoute({ children, requiredPermission, requiredAnyPermission }: ProtectedRouteProps) {
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

  const hasRequiredPermission = requiredPermission ? userHasPermission(user, requiredPermission) : true;
  const hasRequiredAnyPermission = requiredAnyPermission?.length ? userHasAnyPermission(user, requiredAnyPermission) : true;

  if (!hasRequiredPermission || !hasRequiredAnyPermission) {
    return (
      <div className="p-8">
        <div className="rounded-2xl border border-alert-red/20 bg-white p-6 shadow-sm">
          <p className="text-sm font-bold uppercase tracking-wide text-alert-red">403</p>
          <h1 className="mt-2 text-2xl font-bold text-graphite">Sem permissão</h1>
          <p className="mt-2 text-sm text-gray-500">Você não tem permissão para acessar esta área.</p>
        </div>
      </div>
    );
  }

  return children ? <>{children}</> : <Outlet />;
}
