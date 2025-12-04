import { Router, Request, Response } from 'express';
import { getAllConcerts, getConcertById } from '../services/concertService';
import { getInventory } from '../services/holdService';

const router = Router();

/**
 * GET /api/concerts
 * Get all concerts.
 */
router.get('/', (_req: Request, res: Response) => {
  const concerts = getAllConcerts();
  res.json({ concerts });
});

/**
 * GET /api/concerts/:id
 * Get a concert by ID with inventory information.
 */
router.get('/:id', (req: Request, res: Response) => {
  const concert = getConcertById(req.params.id);

  if (!concert) {
    res.status(404).json({ error: 'Not found', message: 'Concert not found' });
    return;
  }

  const inventory = getInventory(concert.id);
  res.json({ concert, inventory });
});

export default router;
