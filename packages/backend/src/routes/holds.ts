import { Router, Request, Response } from 'express';
import {
  createOrUpdateHolds,
  getHoldsForSession,
  getHoldsForConcert,
  processHeartbeat,
  releaseHolds,
} from '../services/holdService';
import { HOLD_CONFIG } from '../config';
import {
  CreateHoldRequest,
  HeartbeatRequest,
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
 * GET /api/holds
 * Get all holds for the current session.
 */
router.get('/', (req: Request, res: Response) => {
  const holds = getHoldsForSession(req.sessionId);
  res.json({ holds, config: HOLD_CONFIG });
});

/**
 * POST /api/holds
 * Create or update holds for a concert (called when entering checkout).
 */
router.post('/', (req: Request, res: Response) => {
  const body = req.body as CreateHoldRequest;

  if (!body.concertId || typeof body.concertId !== 'string') {
    res.status(400).json({ error: 'Bad request', message: 'concertId is required' });
    return;
  }

  if (!validateSelections(body.selections)) {
    res.status(400).json({ error: 'Bad request', message: 'Invalid selections format' });
    return;
  }

  const result = createOrUpdateHolds(req.sessionId, body.concertId, body.selections);

  if (result.success) {
    res.json(result);
  } else {
    res.status(409).json(result); // 409 Conflict for inventory issues
  }
});

/**
 * POST /api/holds/:concertId/heartbeat
 * Process a heartbeat to extend holds during checkout.
 */
router.post('/:concertId/heartbeat', (req: Request, res: Response) => {
  const { concertId } = req.params;
  const body = req.body as HeartbeatRequest;

  const lastActivityAt = body.lastActivityAt
    ? new Date(body.lastActivityAt)
    : new Date();

  const result = processHeartbeat(
    req.sessionId,
    concertId,
    lastActivityAt,
    body.isTabVisible ?? true
  );

  res.json(result);
});

/**
 * DELETE /api/holds/:concertId
 * Release all holds for a concert.
 */
router.delete('/:concertId', (req: Request, res: Response) => {
  const { concertId } = req.params;
  releaseHolds(req.sessionId, concertId);
  res.json({ success: true, message: 'Holds released' });
});

/**
 * GET /api/holds/:concertId
 * Get holds for a specific concert.
 */
router.get('/:concertId', (req: Request, res: Response) => {
  const { concertId } = req.params;
  const holds = getHoldsForConcert(req.sessionId, concertId);
  res.json({ holds });
});

export default router;
