import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { getSession } from '../services/api';
import type { Hold, HoldConfig } from '@ticket-booking/shared';

interface SessionContextType {
  sessionId: string | null;
  holds: Hold[];
  config: HoldConfig | null;
  loading: boolean;
  refreshSession: () => Promise<void>;
  updateHolds: (holds: Hold[]) => void;
}

const SessionContext = createContext<SessionContextType | null>(null);

export function SessionProvider({ children }: { children: ReactNode }): JSX.Element {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [holds, setHolds] = useState<Hold[]>([]);
  const [config, setConfig] = useState<HoldConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    try {
      const session = await getSession();
      setSessionId(session.sessionId);
      setHolds(session.holds);
      setConfig(session.config);
    } catch (error) {
      console.error('Failed to load session:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateHolds = useCallback((newHolds: Hold[]) => {
    setHolds(newHolds);
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  return (
    <SessionContext.Provider
      value={{ sessionId, holds, config, loading, refreshSession, updateHolds }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextType {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}
