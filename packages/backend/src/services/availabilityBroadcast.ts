import { EventEmitter } from 'events';
import type { Response } from 'express';
import { getInventory } from './holdService';

/**
 * =============================================================================
 * AVAILABILITY BROADCAST SERVICE
 * =============================================================================
 *
 * Uses Server-Sent Events (SSE) to push real-time availability updates to clients.
 *
 * How it works:
 * 1. Clients connect to /api/concerts/:id/availability/stream
 * 2. Server keeps connection open, sends events when inventory changes
 * 3. When holds are created/released or bookings confirmed, we broadcast
 *
 * This is simpler than WebSockets because:
 * - One-way communication (server → client only)
 * - Uses standard HTTP - no special protocol upgrade
 * - Browser's EventSource API handles reconnection automatically
 */

// Track connected clients per concert
const clients = new Map<string, Set<Response>>();

// Event emitter for internal broadcasts
const emitter = new EventEmitter();

/**
 * Add a client to receive updates for a concert
 */
export function addClient(concertId: string, res: Response): void {
  if (!clients.has(concertId)) {
    clients.set(concertId, new Set());
  }
  clients.get(concertId)!.add(res);

  console.log(`[SSE] Client connected to concert ${concertId}. Total: ${clients.get(concertId)!.size}`);
}

/**
 * Remove a client when they disconnect
 */
export function removeClient(concertId: string, res: Response): void {
  const concertClients = clients.get(concertId);
  if (concertClients) {
    concertClients.delete(res);
    console.log(`[SSE] Client disconnected from concert ${concertId}. Remaining: ${concertClients.size}`);

    if (concertClients.size === 0) {
      clients.delete(concertId);
    }
  }
}

/**
 * Broadcast availability update to all clients watching a concert
 */
export function broadcastAvailability(concertId: string): void {
  const concertClients = clients.get(concertId);
  if (!concertClients || concertClients.size === 0) {
    return; // No one listening
  }

  // Get current inventory
  const inventory = getInventory(concertId);

  // Format as SSE message
  const data = JSON.stringify({
    type: 'availability',
    concertId,
    inventory,
    timestamp: new Date().toISOString(),
  });

  const message = `data: ${data}\n\n`;

  // Send to all connected clients
  let sentCount = 0;
  for (const client of concertClients) {
    try {
      client.write(message);
      sentCount++;
    } catch {
      // Client disconnected, will be cleaned up
      concertClients.delete(client);
    }
  }

  console.log(`[SSE] Broadcast to ${sentCount} clients for concert ${concertId}`);
}

/**
 * Send initial data when client connects
 */
export function sendInitialData(concertId: string, res: Response): void {
  const inventory = getInventory(concertId);

  const data = JSON.stringify({
    type: 'initial',
    concertId,
    inventory,
    timestamp: new Date().toISOString(),
  });

  res.write(`data: ${data}\n\n`);
}

/**
 * Get count of connected clients (for debugging)
 */
export function getClientCount(concertId?: string): number {
  if (concertId) {
    return clients.get(concertId)?.size ?? 0;
  }
  let total = 0;
  for (const clientSet of clients.values()) {
    total += clientSet.size;
  }
  return total;
}

// Export emitter for internal use
export { emitter };
