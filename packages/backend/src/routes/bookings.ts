import { Router, Request, Response } from 'express';
import { createOrUpdateHolds, getHoldsForConcert } from '../services/holdService';
import { processBooking, getBookingsForSession, getBookingById } from '../services/bookingService';
import { HOLD_CONFIG } from '../config';
import {
  CheckoutRequest,
  PaymentRequest,
  TicketSelection,
  isTicketTier,
} from '@ticket-booking/shared';

const router = Router();

/**
 * Validate ticket selections.
 */
function validateSelections(selections: unknown): selections is TicketSelection[] {
  if (!Array.isArray(selections)) return false;

  for (const selection of selections) {
    if (typeof selection !== 'object' || selection === null) return false;
    if (!isTicketTier(selection.tier)) return false;
    if (typeof selection.quantity !== 'number' || selection.quantity < 0) return false;
  }

  return true;
}

/**
 * POST /api/bookings/checkout
 * Enter checkout - creates holds for the selected tickets.
 */
router.post('/checkout', (req: Request, res: Response) => {
  const body = req.body as CheckoutRequest;

  if (!body.concertId || typeof body.concertId !== 'string') {
    res.status(400).json({ error: 'Bad request', message: 'concertId is required' });
    return;
  }

  if (!validateSelections(body.selections)) {
    res.status(400).json({ error: 'Bad request', message: 'Invalid selections format' });
    return;
  }

  const filteredSelections = body.selections.filter((s) => s.quantity > 0);

  if (filteredSelections.length === 0) {
    res.status(400).json({ error: 'Bad request', message: 'No tickets selected' });
    return;
  }

  // Create holds for the selected tickets
  const result = createOrUpdateHolds(req.sessionId, body.concertId, filteredSelections);

  if (result.success) {
    const expiresAt =
      result.holds.length > 0
        ? result.holds.reduce((min, h) =>
            new Date(h.expiresAt) < new Date(min.expiresAt) ? h : min
          ).expiresAt
        : new Date(Date.now() + HOLD_CONFIG.holdDurationMs).toISOString();

    res.json({
      success: true,
      checkoutSessionId: `checkout-${Date.now()}`,
      holds: result.holds,
      expiresAt,
    });
  } else {
    res.status(409).json({
      success: false,
      checkoutSessionId: '',
      holds: result.holds,
      expiresAt: '',
      message: result.message,
      unavailable: result.unavailable,
    });
  }
});

/**
 * POST /api/bookings/payment
 * Process payment and finalize booking.
 */
router.post('/payment', (req: Request, res: Response) => {
  const body = req.body as PaymentRequest;

  if (!body.concertId || typeof body.concertId !== 'string') {
    res.status(400).json({ error: 'Bad request', message: 'concertId is required' });
    return;
  }

  // Get selections from existing holds
  const holds = getHoldsForConcert(req.sessionId, body.concertId);

  if (holds.length === 0) {
    res.status(400).json({
      success: false,
      message: 'No active holds found. Your session may have expired. Please try again.',
      retryAllowed: false,
    });
    return;
  }

  const selections: TicketSelection[] = holds.map((h) => ({
    tier: h.tier,
    quantity: h.quantity,
  }));

  const result = processBooking(req.sessionId, body.concertId, selections);

  if (result.success) {
    res.json(result);
  } else {
    const status = result.retryAllowed ? 402 : 409;
    res.status(status).json(result);
  }
});

/**
 * GET /api/bookings
 * Get all bookings for the current session.
 */
router.get('/', (req: Request, res: Response) => {
  const bookings = getBookingsForSession(req.sessionId);
  res.json({ bookings });
});

/**
 * GET /api/bookings/:id
 * Get a specific booking by ID.
 */
router.get('/:id', (req: Request, res: Response) => {
  const booking = getBookingById(req.params.id);

  if (!booking) {
    res.status(404).json({ error: 'Not found', message: 'Booking not found' });
    return;
  }

  if (booking.sessionId !== req.sessionId) {
    res.status(403).json({ error: 'Forbidden', message: 'Not your booking' });
    return;
  }

  res.json({ booking });
});

export default router;
