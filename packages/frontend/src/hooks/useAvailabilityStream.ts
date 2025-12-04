import { useEffect, useCallback } from 'react';
import type { TicketInventory } from '@ticket-booking/shared';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface AvailabilityEvent {
  type: 'initial' | 'availability';
  concertId: string;
  inventory: TicketInventory[];
  timestamp: string;
}

/**
 * Hook to subscribe to real-time availability updates via Server-Sent Events.
 *
 * How SSE works:
 * 1. Browser opens a long-lived HTTP connection to the server
 * 2. Server pushes data to client as events (one-way: server → client)
 * 3. EventSource API handles reconnection automatically if connection drops
 *
 * This is simpler than WebSockets when you only need server → client push.
 */
export function useAvailabilityStream(
  concertId: string | undefined,
  onInventoryUpdate: (inventory: TicketInventory[]) => void
): void {
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const data: AvailabilityEvent = JSON.parse(event.data);

        // Update inventory on both initial load and subsequent updates
        if (data.type === 'initial' || data.type === 'availability') {
          onInventoryUpdate(data.inventory);
        }
      } catch (err) {
        console.error('[SSE] Failed to parse message:', err);
      }
    },
    [onInventoryUpdate]
  );

  useEffect(() => {
    if (!concertId) return;

    const url = `${API_URL}/api/concerts/${concertId}/availability/stream`;

    console.log(`[SSE] Connecting to ${url}`);

    const eventSource = new EventSource(url);

    eventSource.onopen = () => {
      console.log('[SSE] Connection opened');
    };

    eventSource.onmessage = handleMessage;

    eventSource.onerror = () => {
      console.error('[SSE] Connection error - will auto-reconnect');
      // EventSource will automatically try to reconnect
    };

    // Cleanup on unmount or when concertId changes
    return () => {
      console.log('[SSE] Closing connection');
      eventSource.close();
    };
  }, [concertId, handleMessage]);
}
