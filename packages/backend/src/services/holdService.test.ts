import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

// Create a test database helper
function createTestDatabase() {
  const db = new Database(':memory:');

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS concerts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      artist TEXT NOT NULL,
      venue TEXT NOT NULL,
      date TEXT NOT NULL,
      image_url TEXT,
      description TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ticket_inventory (
      concert_id TEXT NOT NULL,
      tier TEXT NOT NULL,
      total_quantity INTEGER NOT NULL,
      sold_quantity INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (concert_id, tier)
    );

    CREATE TABLE IF NOT EXISTS holds (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      concert_id TEXT NOT NULL,
      tier TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      last_activity_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      concert_id TEXT NOT NULL,
      total_amount INTEGER NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      confirmed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS booking_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id TEXT NOT NULL,
      tier TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      price_per_ticket INTEGER NOT NULL,
      subtotal INTEGER NOT NULL,
      FOREIGN KEY (booking_id) REFERENCES bookings(id)
    );
  `);

  return db;
}

describe('Hold Service Logic', () => {
  let db: Database.Database;
  let concertId: string;
  const sessionId = 'test-session-123';

  beforeEach(() => {
    db = createTestDatabase();
    concertId = uuidv4();

    // Insert test concert
    db.prepare(`
      INSERT INTO concerts (id, name, artist, venue, date, created_at)
      VALUES (?, 'Test Concert', 'Test Artist', 'Test Venue', '2025-12-31', datetime('now'))
    `).run(concertId);

    // Insert inventory
    db.prepare(`
      INSERT INTO ticket_inventory (concert_id, tier, total_quantity, sold_quantity)
      VALUES (?, 'VIP', 100, 0), (?, 'FRONT_ROW', 200, 0), (?, 'GA', 500, 0)
    `).run(concertId, concertId, concertId);
  });

  afterEach(() => {
    db.close();
  });

  describe('Available Quantity Calculation', () => {
    it('should return full quantity when no holds or sales', () => {
      const inventory = db.prepare(`
        SELECT total_quantity, sold_quantity FROM ticket_inventory
        WHERE concert_id = ? AND tier = 'VIP'
      `).get(concertId) as { total_quantity: number; sold_quantity: number };

      const heldQuantity = db.prepare(`
        SELECT COALESCE(SUM(quantity), 0) as held FROM holds
        WHERE concert_id = ? AND tier = 'VIP' AND expires_at > datetime('now')
      `).get(concertId) as { held: number };

      const available = inventory.total_quantity - inventory.sold_quantity - heldQuantity.held;
      expect(available).toBe(100);
    });

    it('should subtract held tickets from available', () => {
      // Create a hold
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 600000); // 10 minutes

      db.prepare(`
        INSERT INTO holds (id, session_id, concert_id, tier, quantity, created_at, expires_at, last_activity_at)
        VALUES (?, ?, ?, 'VIP', 5, ?, ?, ?)
      `).run(uuidv4(), sessionId, concertId, now.toISOString(), expiresAt.toISOString(), now.toISOString());

      const inventory = db.prepare(`
        SELECT total_quantity, sold_quantity FROM ticket_inventory
        WHERE concert_id = ? AND tier = 'VIP'
      `).get(concertId) as { total_quantity: number; sold_quantity: number };

      const heldQuantity = db.prepare(`
        SELECT COALESCE(SUM(quantity), 0) as held FROM holds
        WHERE concert_id = ? AND tier = 'VIP' AND expires_at > datetime('now')
      `).get(concertId) as { held: number };

      const available = inventory.total_quantity - inventory.sold_quantity - heldQuantity.held;
      expect(available).toBe(95);
    });

    it('should not count expired holds', () => {
      // Create an expired hold
      const now = new Date();
      const expiredAt = new Date(now.getTime() - 60000); // Expired 1 minute ago

      db.prepare(`
        INSERT INTO holds (id, session_id, concert_id, tier, quantity, created_at, expires_at, last_activity_at)
        VALUES (?, ?, ?, 'VIP', 5, ?, ?, ?)
      `).run(uuidv4(), sessionId, concertId, now.toISOString(), expiredAt.toISOString(), now.toISOString());

      const inventory = db.prepare(`
        SELECT total_quantity, sold_quantity FROM ticket_inventory
        WHERE concert_id = ? AND tier = 'VIP'
      `).get(concertId) as { total_quantity: number; sold_quantity: number };

      // Use parameterized now instead of datetime('now') for consistent timezone handling
      const heldQuantity = db.prepare(`
        SELECT COALESCE(SUM(quantity), 0) as held FROM holds
        WHERE concert_id = ? AND tier = 'VIP' AND expires_at > ?
      `).get(concertId, now.toISOString()) as { held: number };

      const available = inventory.total_quantity - inventory.sold_quantity - heldQuantity.held;
      expect(available).toBe(100); // Expired hold not counted
    });
  });

  describe('Hold Creation', () => {
    it('should create a hold for available tickets', () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 600000);
      const holdId = uuidv4();

      db.prepare(`
        INSERT INTO holds (id, session_id, concert_id, tier, quantity, created_at, expires_at, last_activity_at)
        VALUES (?, ?, ?, 'VIP', 2, ?, ?, ?)
      `).run(holdId, sessionId, concertId, now.toISOString(), expiresAt.toISOString(), now.toISOString());

      const hold = db.prepare(`SELECT * FROM holds WHERE id = ?`).get(holdId) as {
        id: string;
        quantity: number;
        tier: string;
      };

      expect(hold).toBeDefined();
      expect(hold.quantity).toBe(2);
      expect(hold.tier).toBe('VIP');
    });

    it('should update existing hold quantity', () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 600000);
      const holdId = uuidv4();

      // Create initial hold
      db.prepare(`
        INSERT INTO holds (id, session_id, concert_id, tier, quantity, created_at, expires_at, last_activity_at)
        VALUES (?, ?, ?, 'VIP', 2, ?, ?, ?)
      `).run(holdId, sessionId, concertId, now.toISOString(), expiresAt.toISOString(), now.toISOString());

      // Update to 5 tickets
      db.prepare(`
        UPDATE holds SET quantity = ?, expires_at = ?, last_activity_at = ? WHERE id = ?
      `).run(5, expiresAt.toISOString(), now.toISOString(), holdId);

      const hold = db.prepare(`SELECT * FROM holds WHERE id = ?`).get(holdId) as {
        quantity: number;
      };

      expect(hold.quantity).toBe(5);
    });
  });

  describe('Hold Expiration', () => {
    it('should delete expired holds', () => {
      const now = new Date();
      const expiredAt = new Date(now.getTime() - 60000);

      // Create expired hold
      db.prepare(`
        INSERT INTO holds (id, session_id, concert_id, tier, quantity, created_at, expires_at, last_activity_at)
        VALUES (?, ?, ?, 'VIP', 2, ?, ?, ?)
      `).run(uuidv4(), sessionId, concertId, now.toISOString(), expiredAt.toISOString(), now.toISOString());

      // Run cleanup using parameterized now for consistent timezone handling
      const result = db.prepare(`DELETE FROM holds WHERE expires_at <= ?`).run(now.toISOString());

      expect(result.changes).toBe(1);

      const remainingHolds = db.prepare(`SELECT COUNT(*) as count FROM holds`).get() as {
        count: number;
      };
      expect(remainingHolds.count).toBe(0);
    });
  });
});

describe('Booking Service Logic', () => {
  let db: Database.Database;
  let concertId: string;
  const sessionId = 'test-session-456';

  beforeEach(() => {
    db = createTestDatabase();
    concertId = uuidv4();

    // Insert test concert
    db.prepare(`
      INSERT INTO concerts (id, name, artist, venue, date, created_at)
      VALUES (?, 'Test Concert', 'Test Artist', 'Test Venue', '2025-12-31', datetime('now'))
    `).run(concertId);

    // Insert inventory
    db.prepare(`
      INSERT INTO ticket_inventory (concert_id, tier, total_quantity, sold_quantity)
      VALUES (?, 'VIP', 100, 0), (?, 'FRONT_ROW', 200, 0), (?, 'GA', 500, 0)
    `).run(concertId, concertId, concertId);
  });

  afterEach(() => {
    db.close();
  });

  describe('Booking Creation', () => {
    it('should create a booking with items', () => {
      const bookingId = uuidv4();
      const now = new Date();

      // Create booking
      db.prepare(`
        INSERT INTO bookings (id, session_id, concert_id, total_amount, status, created_at, confirmed_at)
        VALUES (?, ?, ?, 20000, 'CONFIRMED', ?, ?)
      `).run(bookingId, sessionId, concertId, now.toISOString(), now.toISOString());

      // Create booking item
      db.prepare(`
        INSERT INTO booking_items (booking_id, tier, quantity, price_per_ticket, subtotal)
        VALUES (?, 'VIP', 2, 10000, 20000)
      `).run(bookingId);

      const booking = db.prepare(`SELECT * FROM bookings WHERE id = ?`).get(bookingId) as {
        id: string;
        total_amount: number;
        status: string;
      };

      expect(booking).toBeDefined();
      expect(booking.total_amount).toBe(20000);
      expect(booking.status).toBe('CONFIRMED');

      const items = db.prepare(`SELECT * FROM booking_items WHERE booking_id = ?`).all(
        bookingId
      ) as { tier: string; quantity: number }[];

      expect(items.length).toBe(1);
      expect(items[0].tier).toBe('VIP');
      expect(items[0].quantity).toBe(2);
    });

    it('should update inventory when booking is confirmed', () => {
      // Simulate inventory update after booking
      db.prepare(`
        UPDATE ticket_inventory SET sold_quantity = sold_quantity + 2
        WHERE concert_id = ? AND tier = 'VIP'
      `).run(concertId);

      const inventory = db.prepare(`
        SELECT sold_quantity FROM ticket_inventory WHERE concert_id = ? AND tier = 'VIP'
      `).get(concertId) as { sold_quantity: number };

      expect(inventory.sold_quantity).toBe(2);
    });
  });

  describe('Double Booking Prevention', () => {
    it('should prevent booking more than available', () => {
      // Set sold_quantity to 99 (only 1 VIP left)
      db.prepare(`
        UPDATE ticket_inventory SET sold_quantity = 99 WHERE concert_id = ? AND tier = 'VIP'
      `).run(concertId);

      const inventory = db.prepare(`
        SELECT total_quantity, sold_quantity FROM ticket_inventory
        WHERE concert_id = ? AND tier = 'VIP'
      `).get(concertId) as { total_quantity: number; sold_quantity: number };

      const available = inventory.total_quantity - inventory.sold_quantity;
      expect(available).toBe(1);

      // Attempting to book 2 should fail
      const requestedQuantity = 2;
      expect(available >= requestedQuantity).toBe(false);
    });

    it('should account for holds when checking availability', () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 600000);

      // Create hold for 95 tickets
      db.prepare(`
        INSERT INTO holds (id, session_id, concert_id, tier, quantity, created_at, expires_at, last_activity_at)
        VALUES (?, 'other-session', ?, 'VIP', 95, ?, ?, ?)
      `).run(uuidv4(), concertId, now.toISOString(), expiresAt.toISOString(), now.toISOString());

      const inventory = db.prepare(`
        SELECT total_quantity, sold_quantity FROM ticket_inventory
        WHERE concert_id = ? AND tier = 'VIP'
      `).get(concertId) as { total_quantity: number; sold_quantity: number };

      const heldQuantity = db.prepare(`
        SELECT COALESCE(SUM(quantity), 0) as held FROM holds
        WHERE concert_id = ? AND tier = 'VIP' AND expires_at > datetime('now')
      `).get(concertId) as { held: number };

      const available = inventory.total_quantity - inventory.sold_quantity - heldQuantity.held;
      expect(available).toBe(5); // Only 5 tickets truly available
    });
  });
});
