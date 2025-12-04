import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * Session middleware.
 *
 * Since we don't have auth, we use a simple session ID stored in a cookie.
 * This allows us to track holds and bookings per user.
 *
 * In production, you would:
 * - Use a proper session library (express-session)
 * - Store sessions in Redis for distributed deployments
 * - Integrate with your auth system
 */

declare global {
  namespace Express {
    interface Request {
      sessionId: string;
    }
  }
}

const SESSION_COOKIE_NAME = 'ticket_session';
const SESSION_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

export function sessionMiddleware(req: Request, res: Response, next: NextFunction): void {
  let sessionId = req.cookies?.[SESSION_COOKIE_NAME];

  if (!sessionId) {
    // Create new session
    sessionId = uuidv4();
    res.cookie(SESSION_COOKIE_NAME, sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_MAX_AGE,
    });
  }

  req.sessionId = sessionId;
  next();
}
