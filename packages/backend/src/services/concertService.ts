import { db } from '../db/database';
import { Concert } from '@ticket-booking/shared';

interface ConcertRow {
  id: string;
  name: string;
  artist: string;
  venue: string;
  date: string;
  image_url: string;
  description: string;
  created_at: string;
}

function rowToConcert(row: ConcertRow): Concert {
  return {
    id: row.id,
    name: row.name,
    artist: row.artist,
    venue: row.venue,
    date: row.date,
    imageUrl: row.image_url,
    description: row.description,
    createdAt: row.created_at,
  };
}

/**
 * Get all concerts.
 */
export function getAllConcerts(): Concert[] {
  const rows = db.prepare(`
    SELECT * FROM concerts ORDER BY date ASC
  `).all() as ConcertRow[];

  return rows.map(rowToConcert);
}

/**
 * Get a concert by ID.
 */
export function getConcertById(id: string): Concert | null {
  const row = db.prepare(`SELECT * FROM concerts WHERE id = ?`).get(id) as
    | ConcertRow
    | undefined;

  return row ? rowToConcert(row) : null;
}
