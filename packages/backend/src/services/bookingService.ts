import { v4 as uuidv4 } from 'uuid';
import { db, withTransaction } from '../db/database';
import { releaseHolds, getHoldsForConcert } from './holdService';
import {
  Booking,
  BookingItem,
  BookingStatus,
  TicketSelection,
  TICKET_TIERS,
  LIMITS,
  TicketTier,
} from '@ticket-booking/shared';

/**
 * =============================================================================
 * BOOKING SERVICE
 * =============================================================================
 *
 * Handles the final booking/payment process. This is where holds are
 * converted to actual sales, and inventory is permanently decremented.
 *
 * PAYMENT SIMULATION:
 * ------------------
 * We simulate payment with a configurable failure rate (default 15%).
 * This demonstrates proper rollback handling:
 * - On success: Hold is released, inventory is decremented, booking confirmed
 * - On failure: Hold is KEPT (user can retry), no inventory change
 *
 * DOUBLE-BOOKING PREVENTION AT PAYMENT TIME:
 * ------------------------------------------
 * Even with holds, we do a final check at payment time to ensure:
 * 1. The hold still exists and hasn't expired
 * 2. The inventory is still available (belt + suspenders)
 *
 * This guards against edge cases like:
 * - Hold expired between user clicking "pay" and server processing
 * - Database corruption or bugs
 */

interface BookingRow {
  id: string;
  session_id: string;
  concert_id: string;
  total_amount: number;
  status: string;
  created_at: string;
  confirmed_at: string | null;
}

interface BookingItemRow {
  id: number;
  booking_id: string;
  tier: string;
  quantity: number;
  price_per_ticket: number;
  subtotal: number;
}

interface InventoryRow {
  concert_id: string;
  tier: string;
  total_quantity: number;
  sold_quantity: number;
}

function rowToBooking(row: BookingRow, items: BookingItemRow[]): Booking {
  return {
    id: row.id,
    sessionId: row.session_id,
    concertId: row.concert_id,
    totalAmount: row.total_amount,
    status: row.status as BookingStatus,
    createdAt: row.created_at,
    confirmedAt: row.confirmed_at,
    items: items.map((item) => ({
      tier: item.tier as TicketTier,
      quantity: item.quantity,
      pricePerTicket: item.price_per_ticket,
      subtotal: item.subtotal,
    })),
  };
}

/**
 * Simulate payment processing.
 * Returns true for success, false for failure.
 */
function simulatePayment(): boolean {
  // Random failure based on configured rate
  return Math.random() > LIMITS.PAYMENT_FAILURE_RATE;
}

/**
 * Process a booking/payment.
 *
 * This is the final step where:
 * 1. We verify the hold exists
 * 2. We verify inventory is available (double-check)
 * 3. We simulate payment
 * 4. On success: decrement inventory, create booking, release hold
 * 5. On failure: keep hold, return error with retry option
 */
export function processBooking(
  sessionId: string,
  concertId: string,
  selections: TicketSelection[]
): { success: boolean; booking?: Booking; message: string; retryAllowed?: boolean } {
  return withTransaction(() => {
    const now = new Date();

    // Verify holds exist for all selected tickets
    const holds = getHoldsForConcert(sessionId, concertId);
    const holdsByTier = new Map(holds.map((h) => [h.tier, h]));

    for (const selection of selections) {
      if (selection.quantity === 0) continue;

      const hold = holdsByTier.get(selection.tier);
      if (!hold) {
        return {
          success: false,
          message: `No hold found for ${TICKET_TIERS[selection.tier].name} tickets. Your session may have expired.`,
          retryAllowed: false,
        };
      }

      if (hold.quantity < selection.quantity) {
        return {
          success: false,
          message: `Your hold for ${TICKET_TIERS[selection.tier].name} is only for ${hold.quantity} tickets, but you're trying to purchase ${selection.quantity}.`,
          retryAllowed: false,
        };
      }
    }

    // Double-check inventory availability (belt + suspenders)
    for (const selection of selections) {
      if (selection.quantity === 0) continue;

      const inventory = db.prepare(`
        SELECT total_quantity, sold_quantity FROM ticket_inventory
        WHERE concert_id = ? AND tier = ?
      `).get(concertId, selection.tier) as InventoryRow | undefined;

      if (!inventory) {
        return {
          success: false,
          message: `Invalid ticket tier: ${selection.tier}`,
          retryAllowed: false,
        };
      }

      const available = inventory.total_quantity - inventory.sold_quantity;
      if (available < selection.quantity) {
        return {
          success: false,
          message: `Only ${available} ${TICKET_TIERS[selection.tier].name} tickets available, but you requested ${selection.quantity}.`,
          retryAllowed: false,
        };
      }
    }

    // Simulate payment
    const paymentSuccess = simulatePayment();

    if (!paymentSuccess) {
      // Payment failed - keep the hold so user can retry
      return {
        success: false,
        message: 'Payment declined. Please try again or use a different payment method.',
        retryAllowed: true,
      };
    }

    // Payment succeeded - finalize the booking
    const bookingId = uuidv4();
    let totalAmount = 0;
    const bookingItems: BookingItem[] = [];

    // Calculate totals and prepare items
    for (const selection of selections) {
      if (selection.quantity === 0) continue;

      const tierInfo = TICKET_TIERS[selection.tier];
      const subtotal = tierInfo.price * selection.quantity;
      totalAmount += subtotal;

      bookingItems.push({
        tier: selection.tier,
        quantity: selection.quantity,
        pricePerTicket: tierInfo.price,
        subtotal,
      });
    }

    // Create booking record
    db.prepare(`
      INSERT INTO bookings (id, session_id, concert_id, total_amount, status, created_at, confirmed_at)
      VALUES (?, ?, ?, ?, 'CONFIRMED', ?, ?)
    `).run(
      bookingId,
      sessionId,
      concertId,
      totalAmount,
      now.toISOString(),
      now.toISOString()
    );

    // Create booking items and update inventory
    const insertItem = db.prepare(`
      INSERT INTO booking_items (booking_id, tier, quantity, price_per_ticket, subtotal)
      VALUES (?, ?, ?, ?, ?)
    `);

    const updateInventory = db.prepare(`
      UPDATE ticket_inventory
      SET sold_quantity = sold_quantity + ?
      WHERE concert_id = ? AND tier = ?
    `);

    for (const item of bookingItems) {
      insertItem.run(bookingId, item.tier, item.quantity, item.pricePerTicket, item.subtotal);

      /**
       * CRITICAL: Decrement inventory atomically.
       *
       * This UPDATE is within the transaction, so:
       * 1. If any part fails, the entire transaction rolls back
       * 2. No other transaction can modify this row until we commit
       * 3. sold_quantity accurately reflects all confirmed sales
       */
      updateInventory.run(item.quantity, concertId, item.tier);
    }

    // Release the holds - tickets are now sold
    releaseHolds(sessionId, concertId);

    const booking: Booking = {
      id: bookingId,
      sessionId,
      concertId,
      totalAmount,
      status: 'CONFIRMED',
      createdAt: now.toISOString(),
      confirmedAt: now.toISOString(),
      items: bookingItems,
    };

    return {
      success: true,
      booking,
      message: 'Payment successful! Your tickets have been booked.',
    };
  });
}

/**
 * Get all bookings for a session.
 */
export function getBookingsForSession(sessionId: string): Booking[] {
  const bookingRows = db.prepare(`
    SELECT * FROM bookings WHERE session_id = ? ORDER BY created_at DESC
  `).all(sessionId) as BookingRow[];

  return bookingRows.map((row) => {
    const items = db.prepare(`
      SELECT * FROM booking_items WHERE booking_id = ?
    `).all(row.id) as BookingItemRow[];

    return rowToBooking(row, items);
  });
}

/**
 * Get a specific booking by ID.
 */
export function getBookingById(bookingId: string): Booking | null {
  const row = db.prepare(`SELECT * FROM bookings WHERE id = ?`).get(bookingId) as
    | BookingRow
    | undefined;

  if (!row) return null;

  const items = db.prepare(`SELECT * FROM booking_items WHERE booking_id = ?`).all(
    bookingId
  ) as BookingItemRow[];

  return rowToBooking(row, items);
}
