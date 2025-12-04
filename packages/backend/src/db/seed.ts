import { v4 as uuidv4 } from 'uuid';
import { db, initializeDatabase } from './database';
import { TicketTier } from '@ticket-booking/shared';

/**
 * Seed data for demo concerts.
 * Run with: npm run db:seed
 */

interface SeedConcert {
  id: string;
  name: string;
  artist: string;
  venue: string;
  date: string;
  imageUrl: string;
  description: string;
  inventory: Record<TicketTier, number>;
}

const SEED_CONCERTS: SeedConcert[] = [
  {
    id: uuidv4(),
    name: 'Good Luck Getting In',
    artist: 'The Velvet Rope Society',
    venue: 'Secret Location, Undisclosed',
    date: '2025-02-14T21:00:00Z',
    imageUrl: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800',
    description: 'The most exclusive show of the year. Only 10 tickets exist. If you\'re reading this, you\'re probably already too late. No refunds, no regrets.',
    inventory: { VIP: 2, FRONT_ROW: 3, GA: 5 },
  },
  {
    id: uuidv4(),
    name: 'Neon Nights Tour',
    artist: 'The Synthwave Collective',
    venue: 'Madison Square Garden, New York',
    date: '2025-03-15T20:00:00Z',
    imageUrl: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800',
    description: 'Experience the ultimate synthwave journey with The Synthwave Collective. Featuring stunning visuals and classic 80s-inspired electronic music.',
    inventory: { VIP: 50, FRONT_ROW: 100, GA: 500 },
  },
  {
    id: uuidv4(),
    name: 'Acoustic Sessions',
    artist: 'Emma Rivers',
    venue: 'The Fillmore, San Francisco',
    date: '2025-04-02T19:30:00Z',
    imageUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800',
    description: 'An intimate evening with Grammy-nominated singer-songwriter Emma Rivers. Stripped-down acoustic performances of her greatest hits.',
    inventory: { VIP: 30, FRONT_ROW: 60, GA: 300 },
  },
  {
    id: uuidv4(),
    name: 'Rock Revolution',
    artist: 'Thunder Valley',
    venue: 'Wembley Stadium, London',
    date: '2025-05-20T18:00:00Z',
    imageUrl: 'https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?w=800',
    description: 'Thunder Valley brings their explosive rock show to Wembley for one legendary night. Pyrotechnics, guitar solos, and pure rock energy.',
    inventory: { VIP: 100, FRONT_ROW: 200, GA: 1000 },
  },
  {
    id: uuidv4(),
    name: 'Jazz Under the Stars',
    artist: 'Marcus Cole Quartet',
    venue: 'Hollywood Bowl, Los Angeles',
    date: '2025-06-12T20:00:00Z',
    imageUrl: 'https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?w=800',
    description: 'World-renowned jazz pianist Marcus Cole and his quartet perform under the open sky. A sophisticated evening of improvisation and classics.',
    inventory: { VIP: 40, FRONT_ROW: 80, GA: 400 },
  },
  {
    id: uuidv4(),
    name: 'Electronic Dreams Festival',
    artist: 'Various Artists',
    venue: 'Red Rocks Amphitheatre, Colorado',
    date: '2025-07-04T16:00:00Z',
    imageUrl: 'https://images.unsplash.com/photo-1574391884720-bbc3740c59d1?w=800',
    description: 'A full day of electronic music featuring top DJs and producers. Dance from sunset to sunrise at one of the world\'s most beautiful venues.',
    inventory: { VIP: 75, FRONT_ROW: 150, GA: 750 },
  },
];

function seed(): void {
  console.log('Initializing database...');
  initializeDatabase();

  console.log('Clearing existing data...');
  db.exec(`
    DELETE FROM booking_items;
    DELETE FROM bookings;
    DELETE FROM holds;
    DELETE FROM ticket_inventory;
    DELETE FROM concerts;
  `);

  console.log('Seeding concerts...');
  const insertConcert = db.prepare(`
    INSERT INTO concerts (id, name, artist, venue, date, image_url, description)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertInventory = db.prepare(`
    INSERT INTO ticket_inventory (concert_id, tier, total_quantity, sold_quantity)
    VALUES (?, ?, ?, 0)
  `);

  for (const concert of SEED_CONCERTS) {
    insertConcert.run(
      concert.id,
      concert.name,
      concert.artist,
      concert.venue,
      concert.date,
      concert.imageUrl,
      concert.description
    );

    for (const [tier, quantity] of Object.entries(concert.inventory)) {
      insertInventory.run(concert.id, tier, quantity);
    }

    console.log(`  Created: ${concert.name} by ${concert.artist}`);
  }

  console.log('\nSeed completed successfully!');
  console.log(`Created ${SEED_CONCERTS.length} concerts with ticket inventory.`);
}

// Run seed if called directly
seed();
