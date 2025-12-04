import { v4 as uuidv4 } from 'uuid';
import { db, withTransaction } from '../db/database';
import { HOLD_CONFIG } from '../config';
import {
  Hold,
  TicketTier,
  TicketSelection,
  TicketInventory,
  LIMITS,
} from '@ticket-booking/shared';

/**
 * =============================================================================
 * HOLD SERVICE
 * =============================================================================
 *
 * Manages ticket holds - the core mechanism for preventing double-booking.
 * Holds are created when a user enters checkout (not during browsing).
 *
 * DOUBLE-BOOKING PREVENTION:
 * -------------------------
 * Available tickets = total - sold - held
 *
 * When two users try to book the same tickets simultaneously:
 * 1. Both read the same available count (e.g., 5 tickets)
 * 2. Both try to create holds for 3 tickets
 * 3. WITHOUT LOCKING: Both succeed, total held = 6 > available = 5 (BUG!)
 * 4. WITH LOCKING: Second request waits, sees only 2 available, fails gracefully
 *
 * SQLite's transaction mechanism ensures atomicity. The withTransaction()
 * wrapper uses BEGIN IMMEDIATE to acquire a write lock.
 */

interface HoldRow {
  id: string;
  session_id: string;
  concert_id: string;
  tier: string;
  quantity: number;
  created_at: string;
  expires_at: string;
  last_activity_at: string;
}

interface InventoryRow {
  concert_id: string;
  tier: string;
  total_quantity: number;
  sold_quantity: number;
}

function rowToHold(row: HoldRow): Hold {
  return {
    id: row.id,
    sessionId: row.session_id,
    concertId: row.concert_id,
    tier: row.tier as TicketTier,
    quantity: row.quantity,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    lastActivityAt: row.last_activity_at,
  };
}

/**
 * Get available quantity for a tier, accounting for sold and held tickets.
 */
function getAvailableQuantity(concertId: string, tier: TicketTier): number {
  const inventory = db.prepare(`
    SELECT total_quantity, sold_quantity FROM ticket_inventory
    WHERE concert_id = ? AND tier = ?
  `).get(concertId, tier) as InventoryRow | undefined;

  if (!inventory) {
    return 0;
  }

  const heldQuantity = db.prepare(`
    SELECT COALESCE(SUM(quantity), 0) as held FROM holds
    WHERE concert_id = ? AND tier = ? AND expires_at > datetime('now')
  `).get(concertId, tier) as { held: number };

  return inventory.total_quantity - inventory.sold_quantity - heldQuantity.held;
}

/**
 * Get all inventory for a concert with calculated available quantities.
 */
export function getInventory(concertId: string): TicketInventory[] {
  const rows = db.prepare(`
    SELECT concert_id, tier, total_quantity, sold_quantity FROM ticket_inventory
    WHERE concert_id = ?
  `).all(concertId) as InventoryRow[];

  return rows.map((row) => {
    const heldQuantity = db.prepare(`
      SELECT COALESCE(SUM(quantity), 0) as held FROM holds
      WHERE concert_id = ? AND tier = ? AND expires_at > datetime('now')
    `).get(concertId, row.tier) as { held: number };

    return {
      concertId: row.concert_id,
      tier: row.tier as TicketTier,
      totalQuantity: row.total_quantity,
      availableQuantity: row.total_quantity - row.sold_quantity - heldQuantity.held,
      soldQuantity: row.sold_quantity,
      heldQuantity: heldQuantity.held,
    };
  });
}

/**
 * Get all holds for a session.
 */
export function getHoldsForSession(sessionId: string): Hold[] {
  const rows = db.prepare(`
    SELECT * FROM holds WHERE session_id = ? AND expires_at > datetime('now')
  `).all(sessionId) as HoldRow[];

  return rows.map(rowToHold);
}

/**
 * Get holds for a specific concert and session.
 */
export function getHoldsForConcert(sessionId: string, concertId: string): Hold[] {
  const rows = db.prepare(`
    SELECT * FROM holds
    WHERE session_id = ? AND concert_id = ? AND expires_at > datetime('now')
  `).all(sessionId, concertId) as HoldRow[];

  return rows.map(rowToHold);
}

/**
 * Create or update holds for a session (called when entering checkout).
 * This is the CRITICAL function for double-booking prevention.
 */
export function createOrUpdateHolds(
  sessionId: string,
  concertId: string,
  selections: TicketSelection[]
): { success: boolean; holds: Hold[]; message?: string; unavailable?: TicketSelection[] } {
  // Validate selections
  for (const selection of selections) {
    if (selection.quantity > LIMITS.MAX_TICKETS_PER_TIER) {
      return {
        success: false,
        holds: [],
        message: `Maximum ${LIMITS.MAX_TICKETS_PER_TIER} tickets per tier allowed`,
      };
    }
  }

  const totalQuantity = selections.reduce((sum, s) => sum + s.quantity, 0);
  if (totalQuantity > LIMITS.MAX_TICKETS_PER_ORDER) {
    return {
      success: false,
      holds: [],
      message: `Maximum ${LIMITS.MAX_TICKETS_PER_ORDER} tickets per order allowed`,
    };
  }

  /**
   * CRITICAL SECTION: This entire operation must be atomic.
   * Transaction prevents race conditions where two users could both
   * successfully hold more tickets than are actually available.
   */
  return withTransaction(() => {
    const unavailable: TicketSelection[] = [];
    const holdResults: Hold[] = [];
    const now = new Date();
    const expiresAt = new Date(now.getTime() + HOLD_CONFIG.holdDurationMs);

    for (const selection of selections) {
      if (selection.quantity === 0) {
        db.prepare(`
          DELETE FROM holds WHERE session_id = ? AND concert_id = ? AND tier = ?
        `).run(sessionId, concertId, selection.tier);
        continue;
      }

      // Get existing hold for this tier
      const existingHold = db.prepare(`
        SELECT * FROM holds WHERE session_id = ? AND concert_id = ? AND tier = ?
      `).get(sessionId, concertId, selection.tier) as HoldRow | undefined;

      // Calculate how many MORE tickets we need beyond what we already hold
      const currentlyHeld = existingHold?.quantity ?? 0;
      const additionalNeeded = selection.quantity - currentlyHeld;

      if (additionalNeeded > 0) {
        const available = getAvailableQuantity(concertId, selection.tier);
        if (additionalNeeded > available) {
          unavailable.push({ tier: selection.tier, quantity: selection.quantity });
          continue;
        }
      }

      if (existingHold) {
        db.prepare(`
          UPDATE holds SET quantity = ?, expires_at = ?, last_activity_at = ? WHERE id = ?
        `).run(selection.quantity, expiresAt.toISOString(), now.toISOString(), existingHold.id);

        holdResults.push({
          id: existingHold.id,
          sessionId,
          concertId,
          tier: selection.tier,
          quantity: selection.quantity,
          createdAt: existingHold.created_at,
          expiresAt: expiresAt.toISOString(),
          lastActivityAt: now.toISOString(),
        });
      } else {
        const holdId = uuidv4();
        db.prepare(`
          INSERT INTO holds (id, session_id, concert_id, tier, quantity, created_at, expires_at, last_activity_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(holdId, sessionId, concertId, selection.tier, selection.quantity, now.toISOString(), expiresAt.toISOString(), now.toISOString());

        holdResults.push({
          id: holdId,
          sessionId,
          concertId,
          tier: selection.tier,
          quantity: selection.quantity,
          createdAt: now.toISOString(),
          expiresAt: expiresAt.toISOString(),
          lastActivityAt: now.toISOString(),
        });
      }
    }

    if (unavailable.length > 0) {
      return {
        success: false,
        holds: holdResults,
        message: 'Some tickets are no longer available',
        unavailable,
      };
    }

    return { success: true, holds: holdResults };
  });
}

/**
 * Process a heartbeat from the client during checkout.
 * Extends the hold if user is active.
 */
export function processHeartbeat(
  sessionId: string,
  concertId: string,
  lastActivityAt: Date,
  isTabVisible: boolean
): { success: boolean; holds: Hold[]; expiresAt: string | null; message?: string } {
  return withTransaction(() => {
    const holds = db.prepare(`
      SELECT * FROM holds
      WHERE session_id = ? AND concert_id = ? AND expires_at > datetime('now')
    `).all(sessionId, concertId) as HoldRow[];

    if (holds.length === 0) {
      return { success: false, holds: [], expiresAt: null, message: 'No active holds found' };
    }

    const now = new Date();
    let newExpiresAt: Date;

    if (!isTabVisible) {
      // Tab not visible - use grace period only
      newExpiresAt = new Date(now.getTime() + HOLD_CONFIG.gracePeriodMs);
    } else {
      const timeSinceActivity = now.getTime() - lastActivityAt.getTime();
      if (timeSinceActivity > HOLD_CONFIG.inactivityTimeoutMs) {
        // User inactive - don't extend
        return {
          success: true,
          holds: holds.map(rowToHold),
          expiresAt: holds[0].expires_at,
          message: 'Inactivity detected - hold not extended',
        };
      }
      // Active user - extend hold
      newExpiresAt = new Date(now.getTime() + HOLD_CONFIG.holdDurationMs);
    }

    // Enforce hard cap
    const oldestHold = holds.reduce((oldest, h) =>
      new Date(h.created_at) < new Date(oldest.created_at) ? h : oldest
    );
    const hardCapEnd = new Date(new Date(oldestHold.created_at).getTime() + HOLD_CONFIG.hardCapMs);
    if (newExpiresAt > hardCapEnd) {
      newExpiresAt = hardCapEnd;
    }

    db.prepare(`
      UPDATE holds SET expires_at = ?, last_activity_at = ? WHERE session_id = ? AND concert_id = ?
    `).run(newExpiresAt.toISOString(), now.toISOString(), sessionId, concertId);

    const updatedHolds = db.prepare(`
      SELECT * FROM holds WHERE session_id = ? AND concert_id = ?
    `).all(sessionId, concertId) as HoldRow[];

    return { success: true, holds: updatedHolds.map(rowToHold), expiresAt: newExpiresAt.toISOString() };
  });
}

/**
 * Release all holds for a session and concert.
 */
export function releaseHolds(sessionId: string, concertId: string): void {
  db.prepare(`
    DELETE FROM holds WHERE session_id = ? AND concert_id = ?
  `).run(sessionId, concertId);
}

/**
 * Release all holds for a session (all concerts).
 */
export function releaseAllHolds(sessionId: string): void {
  db.prepare(`DELETE FROM holds WHERE session_id = ?`).run(sessionId);
}

/**
 * Clean up expired holds.
 * Called periodically by background job.
 */
export function cleanupExpiredHolds(): number {
  const result = db.prepare(`
    DELETE FROM holds WHERE expires_at <= datetime('now')
  `).run();

  return result.changes;
}

/**
 * Check if holds are about to expire (for warning messages).
 */
export function getExpiringHolds(sessionId: string, warningThresholdMs: number): Hold[] {
  const warningTime = new Date(Date.now() + warningThresholdMs);

  const rows = db.prepare(`
    SELECT * FROM holds
    WHERE session_id = ?
      AND expires_at > datetime('now')
      AND expires_at <= ?
  `).all(sessionId, warningTime.toISOString()) as HoldRow[];

  return rows.map(rowToHold);
}
