import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { retrieveLaunchParams } from '@telegram-apps/sdk-react';
import { authenticate } from '../lib/auth';
import type { AuthState } from '../types/auth';

interface AuthContextValue extends AuthState {
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    token: null,
    user: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    async function doAuth() {
      try {
        const launchParams = retrieveLaunchParams();
        const initDataRaw = launchParams.initDataRaw as string | undefined;

        if (!initDataRaw) {
          if (import.meta.env.DEV) {
            setState({
              token: 'dev-token',
              user: { id: 'dev', first_name: 'Developer' },
              isLoading: false,
              error: null,
            });
            return;
          }
          throw new Error('No Telegram initData available');
        }

        const { token, user } = await authenticate(initDataRaw);
        setState({ token, user, isLoading: false, error: null });
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Auth failed';
        setState((prev) => ({ ...prev, isLoading: false, error: message }));
      }
    }

    doAuth();
  }, []);

  const logout = () => {
    setState({ token: null, user: null, isLoading: false, error: null });
  };

  return (
    <AuthContext.Provider value={{ ...state, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
