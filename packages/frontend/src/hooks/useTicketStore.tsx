import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import type { TicketTier, TicketSelection } from '@ticket-booking/shared';

/**
 * Global store for ticket selections.
 * Persists selections across navigation (e.g., back button from checkout).
 */

interface ConcertSelections {
  selections: Record<TicketTier, number>;
  total: number;
}

interface TicketStoreContextType {
  // Get selections for a concert
  getSelections: (concertId: string) => Record<TicketTier, number>;
  getTotal: (concertId: string) => number;
  getSelectionsArray: (concertId: string) => TicketSelection[];

  // Update selections
  setQuantity: (concertId: string, tier: TicketTier, quantity: number) => void;
  setSelections: (concertId: string, selections: Record<TicketTier, number>) => void;

  // Clear selections
  clearSelections: (concertId: string) => void;
  clearAllSelections: () => void;
}

const TicketStoreContext = createContext<TicketStoreContextType | null>(null);

const TIER_PRICES: Record<TicketTier, number> = {
  VIP: 10000,
  FRONT_ROW: 5000,
  GA: 1000,
};

const EMPTY_SELECTIONS: Record<TicketTier, number> = {
  VIP: 0,
  FRONT_ROW: 0,
  GA: 0,
};

export function TicketStoreProvider({ children }: { children: ReactNode }): JSX.Element {
  const [store, setStore] = useState<Map<string, ConcertSelections>>(new Map());

  const calculateTotal = useCallback((selections: Record<TicketTier, number>): number => {
    return Object.entries(selections).reduce((sum, [tier, qty]) => {
      return sum + TIER_PRICES[tier as TicketTier] * qty;
    }, 0);
  }, []);

  const getSelections = useCallback(
    (concertId: string): Record<TicketTier, number> => {
      return store.get(concertId)?.selections ?? { ...EMPTY_SELECTIONS };
    },
    [store]
  );

  const getTotal = useCallback(
    (concertId: string): number => {
      return store.get(concertId)?.total ?? 0;
    },
    [store]
  );

  const getSelectionsArray = useCallback(
    (concertId: string): TicketSelection[] => {
      const selections = getSelections(concertId);
      return Object.entries(selections)
        .filter(([, qty]) => qty > 0)
        .map(([tier, qty]) => ({
          tier: tier as TicketTier,
          quantity: qty,
        }));
    },
    [getSelections]
  );

  const setQuantity = useCallback(
    (concertId: string, tier: TicketTier, quantity: number) => {
      setStore((prev) => {
        const newStore = new Map(prev);
        const current = newStore.get(concertId) ?? {
          selections: { ...EMPTY_SELECTIONS },
          total: 0,
        };
        const newSelections = { ...current.selections, [tier]: quantity };
        newStore.set(concertId, {
          selections: newSelections,
          total: calculateTotal(newSelections),
        });
        return newStore;
      });
    },
    [calculateTotal]
  );

  const setSelections = useCallback(
    (concertId: string, selections: Record<TicketTier, number>) => {
      setStore((prev) => {
        const newStore = new Map(prev);
        newStore.set(concertId, {
          selections,
          total: calculateTotal(selections),
        });
        return newStore;
      });
    },
    [calculateTotal]
  );

  const clearSelections = useCallback((concertId: string) => {
    setStore((prev) => {
      const newStore = new Map(prev);
      newStore.delete(concertId);
      return newStore;
    });
  }, []);

  const clearAllSelections = useCallback(() => {
    setStore(new Map());
  }, []);

  return (
    <TicketStoreContext.Provider
      value={{
        getSelections,
        getTotal,
        getSelectionsArray,
        setQuantity,
        setSelections,
        clearSelections,
        clearAllSelections,
      }}
    >
      {children}
    </TicketStoreContext.Provider>
  );
}

export function useTicketStore(): TicketStoreContextType {
  const context = useContext(TicketStoreContext);
  if (!context) {
    throw new Error('useTicketStore must be used within a TicketStoreProvider');
  }
  return context;
}
