import { cleanupExpiredHolds } from './holdService';
import { JOB_CONFIG } from '../config';

/**
 * =============================================================================
 * HOLD CLEANUP BACKGROUND JOB
 * =============================================================================
 *
 * This job runs periodically to clean up expired holds.
 *
 * WHY IS THIS NEEDED?
 * ------------------
 * Holds expire after a timeout (configured in HOLD_CONFIG). When they expire,
 * the tickets should become available for other users. We need a mechanism
 * to actually delete expired hold records so the inventory calculations
 * reflect the true available quantity.
 *
 * TWO APPROACHES:
 * 1. Lazy cleanup: Check expiry on every inventory query
 *    - Pro: No background job needed
 *    - Con: Adds latency to queries, expired holds linger in DB
 *
 * 2. Background job: Periodically sweep expired holds
 *    - Pro: Queries stay fast, database stays clean
 *    - Con: Small delay before tickets become available (up to interval time)
 *
 * We use approach #2 with a 10-second interval. This means:
 * - Tickets become available at most 10 seconds after hold expiry
 * - Database stays clean
 * - Read queries are fast
 *
 * PRODUCTION CONSIDERATIONS:
 * -------------------------
 * In production with multiple server instances, you would:
 * - Use a distributed lock (Redis SETNX) to ensure only one instance runs cleanup
 * - Or use a dedicated job queue (Bull, Agenda) for reliability
 * - Or use database-native scheduled tasks (pg_cron for Postgres)
 */

let cleanupInterval: NodeJS.Timeout | null = null;

/**
 * Start the background cleanup job.
 */
export function startHoldCleanupJob(): void {
  if (cleanupInterval) {
    console.log('Hold cleanup job already running');
    return;
  }

  console.log(
    `Starting hold cleanup job (interval: ${JOB_CONFIG.holdCleanupIntervalMs}ms)`
  );

  cleanupInterval = setInterval(() => {
    try {
      const cleaned = cleanupExpiredHolds();
      if (cleaned > 0) {
        console.log(`Cleaned up ${cleaned} expired hold(s)`);
      }
    } catch (error) {
      console.error('Error in hold cleanup job:', error);
    }
  }, JOB_CONFIG.holdCleanupIntervalMs);

  // Run immediately on start
  const initialClean = cleanupExpiredHolds();
  if (initialClean > 0) {
    console.log(`Initial cleanup: removed ${initialClean} expired hold(s)`);
  }
}

/**
 * Stop the background cleanup job.
 */
export function stopHoldCleanupJob(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    console.log('Hold cleanup job stopped');
  }
}
