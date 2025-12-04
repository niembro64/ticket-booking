import { Router, Request, Response } from 'express';
import { getAllConcerts, getConcertById } from '../services/concertService';
import { getInventory } from '../services/holdService';
import {
  addClient,
  removeClient,
  sendInitialData,
} from '../services/availabilityBroadcast';

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
 * GET /api/concerts/:id/availability/stream
 * Server-Sent Events endpoint for real-time availability updates.
 *
 * SSE Protocol:
 * - Response headers tell browser to expect a stream
 * - Data is sent as "data: {...}\n\n" formatted messages
 * - Connection stays open until client disconnects
 */
router.get('/:id/availability/stream', (req: Request, res: Response) => {
  const concertId = req.params.id;
  const concert = getConcertById(concertId);

  if (!concert) {
    res.status(404).json({ error: 'Not found', message: 'Concert not found' });
    return;
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  // Send initial data immediately
  sendInitialData(concertId, res);

  // Register this client for updates
  addClient(concertId, res);

  // Clean up on disconnect
  req.on('close', () => {
    removeClient(concertId, res);
  });

  // Keep connection alive with periodic heartbeat
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 30000);

  req.on('close', () => {
    clearInterval(heartbeat);
  });
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
