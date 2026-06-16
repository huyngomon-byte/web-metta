import { Outlet } from 'react-router-dom';
import { AuthProvider } from '@/hooks/useAuth';

export default function AdminAuthLayout() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  );
}
