import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { authenticate } from '../lib/auth';
import type { AuthState } from '../types/auth';

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        initDataUnsafe?: Record<string, unknown>;
      };
    };
  }
}

interface AuthContextValue extends AuthState {
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function getInitDataRaw(): string | null {
  // window.Telegram.WebApp.initData — injected by telegram-web-app.js
  const tgInitData = window.Telegram?.WebApp?.initData;
  if (tgInitData) return tgInitData;

  // Fallback: parse from URL hash/search
  const hash = window.location.hash.slice(1);
  const search = window.location.search.slice(1);
  for (const raw of [hash, search]) {
    const params = new URLSearchParams(raw);
    const tgWebAppData = params.get('tgWebAppData');
    if (tgWebAppData) return tgWebAppData;
  }

  return null;
}

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
        const initDataRaw = getInitDataRaw();

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
          // Debug info for troubleshooting
          const debugInfo = [
            `TG obj: ${!!window.Telegram}`,
            `WebApp: ${!!window.Telegram?.WebApp}`,
            `initData len: ${window.Telegram?.WebApp?.initData?.length ?? 'N/A'}`,
            `hash: ${window.location.hash.slice(0, 50)}`,
          ].join(', ');
          throw new Error(`Not opened from Telegram (${debugInfo})`);
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
