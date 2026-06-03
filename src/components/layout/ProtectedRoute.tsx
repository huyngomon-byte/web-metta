import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { canAccessPath } from '@/lib/permissions';

export function ProtectedRoute() {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  const fallback = user.role === 'design' ? '/cms/pages' : '/dashboard';
  if (!canAccessPath(user, location.pathname)) return <Navigate to={fallback} replace />;
  return <Outlet />;
}
