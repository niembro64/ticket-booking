import { Router, Request, Response } from 'express';
import { getHoldsForSession } from '../services/holdService';
import { HOLD_CONFIG } from '../config';

const router = Router();

/**
 * GET /api/session
 * Get current session info, including active holds and config.
 *
 * Called on app load to restore state from previous session.
 */
router.get('/', (req: Request, res: Response) => {
  const holds = getHoldsForSession(req.sessionId);

  res.json({
    sessionId: req.sessionId,
    holds,
    config: HOLD_CONFIG,
  });
});

export default router;
