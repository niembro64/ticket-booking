import { HoldConfig } from '@ticket-booking/shared';

/**
 * =============================================================================
 * HOLD CONFIGURATION
 * =============================================================================
 *
 * Tickets are held when user enters checkout, not during browsing.
 * Holds are extended based on user activity and released on:
 * - Successful purchase
 * - User abandons checkout
 * - Timeout (no activity)
 */
export const HOLD_CONFIG: HoldConfig = {
  // Base hold duration: 10 minutes
  holdDurationMs: 10 * 60 * 1000,

  // Inactivity timeout: 3 minutes
  inactivityTimeoutMs: 3 * 60 * 1000,

  // Grace period when tab is hidden: 60 seconds
  gracePeriodMs: 60 * 1000,

  // Hard cap: 15 minutes (prevents indefinite holds)
  hardCapMs: 15 * 60 * 1000,

  // Warning before expiry: 60 seconds
  warningBeforeExpiryMs: 60 * 1000,

  // Heartbeat interval: 30 seconds
  heartbeatIntervalMs: 30 * 1000,
};

/**
 * Server configuration
 */
export const SERVER_CONFIG = {
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3001,
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
};

/**
 * Database configuration
 */
export const DB_CONFIG = {
  path: process.env.DB_PATH || './data/tickets.db',
};

/**
 * Background job configuration
 */
export const JOB_CONFIG = {
  // How often to clean up expired holds: every 10 seconds
  holdCleanupIntervalMs: 10 * 1000,
};
