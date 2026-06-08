import { createContext, useContext, useMemo, useState } from 'react';
import { currentUser, login, logout } from '@/services/authService';
import type { AdminUser } from '@/types/user';

interface AuthContextValue {
  user: AdminUser | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(() => currentUser());
  const value = useMemo<AuthContextValue>(() => ({
    user,
    signIn: async (email, password) => setUser(await login(email, password)),
    signOut: async () => {
      await logout();
      setUser(null);
    }
  }), [user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
