# Concert Ticket Booking System

A full-stack ticket booking application demonstrating concurrent access handling and double-booking prevention.

## Quick Start

```bash
# Install dependencies
npm install

# Build shared types
npm run build -w @ticket-booking/shared

# Seed the database
npm run db:seed

# Start development servers
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3001

## Project Structure

```
ticket-booking/
├── packages/
│   ├── frontend/     # React + TypeScript + Vite
│   ├── backend/      # Express + SQLite
│   └── shared/       # Shared types and utilities
├── eslint.config.mjs
├── .prettierrc
└── package.json
```

## Architecture

### Tech Stack

| Layer    | Technology                    |
|----------|-------------------------------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Backend  | Express, TypeScript, SQLite   |
| Database | better-sqlite3 (embedded)     |

### Ticket Tiers

- **VIP** - Premium seating
- **Front Row** - First rows
- **General Admission** - Standard seating

## Double-Booking Prevention

The core challenge: prevent two users from purchasing the same ticket.

### Solution: Checkout-Time Holds with Atomic Transactions

Tickets are **not** reserved during browsing. Holds are created only when a user enters checkout:

```
Available = Total - Sold - Held
```

**Race condition scenario:**
1. User A and User B both see 5 VIP tickets available
2. Both click checkout for 3 tickets simultaneously
3. Without protection: both succeed (6 tickets sold from 5 available)
4. With our solution: one succeeds, one fails gracefully

### Implementation

SQLite transactions with `BEGIN IMMEDIATE` provide serialized writes:

```typescript
// In holdService.ts
return withTransaction(() => {
  const available = getAvailableQuantity(concertId, tier);
  if (requestedQuantity > available) {
    return { success: false, message: 'Not enough tickets' };
  }
  // Create hold atomically
});
```

The `withTransaction()` wrapper ensures:
- Write lock acquired before any reads
- All operations succeed or all fail (atomicity)
- No concurrent transaction can modify data mid-operation

## Hold System

### Configuration

| Setting | Value | Purpose |
|---------|-------|---------|
| Hold Duration | 10 min | Time to complete checkout |
| Inactivity Timeout | 3 min | Release if user idle |
| Grace Period | 60 sec | Buffer when tab hidden |
| Hard Cap | 15 min | Maximum hold time ever |
| Heartbeat | 30 sec | Activity check interval |

### Hold Lifecycle

1. **Creation**: User enters checkout, tickets are held
2. **Extension**: Heartbeat extends hold if user is active
3. **Release**: Purchase completes, abandonment, or timeout
4. **Cleanup**: Background job removes expired holds every 10 seconds

## Real-Time Availability (SSE)

Ticket availability updates in real-time using Server-Sent Events:

```
Browser A (viewing)              Server                    Browser B (booking)
       │                            │                            │
       │ GET /availability/stream   │                            │
       │───────────────────────────>│                            │
       │ (connection stays open)    │                            │
       │                            │                            │
       │<─ initial inventory ───────│                            │
       │                            │                            │
       │                            │    POST /holds/checkout    │
       │                            │<───────────────────────────│
       │                            │    (2 VIP tickets held)    │
       │                            │                            │
       │<─ availability update ─────│                            │
       │   (VIP: 5→3 available)     │                            │
```

**Why SSE instead of WebSockets?**
- One-way communication (server → client only)
- Uses standard HTTP, no protocol upgrade
- Browser's `EventSource` API handles reconnection automatically
- Simpler than WebSockets for this use case

**Implementation:**
- Backend: `availabilityBroadcast.ts` maintains connected clients per concert
- Frontend: `useAvailabilityStream` hook wraps `EventSource` API
- Events fire when holds are created, released, or expire

## API Endpoints

### Concerts

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/concerts` | List all concerts |
| GET | `/api/concerts/:id` | Concert details |
| GET | `/api/concerts/:id/availability/stream` | Real-time availability (SSE) |

### Holds

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/holds/checkout` | Create holds, enter checkout |
| POST | `/api/holds/heartbeat` | Extend holds during checkout |
| DELETE | `/api/holds/:concertId` | Release holds |

### Bookings

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/bookings` | Confirm purchase |
| GET | `/api/bookings` | User's bookings |
| GET | `/api/bookings/:id` | Booking details |

## Database Schema

```sql
-- Concerts
CREATE TABLE concerts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  artist TEXT NOT NULL,
  venue TEXT NOT NULL,
  date TEXT NOT NULL
);

-- Inventory per tier
CREATE TABLE ticket_inventory (
  concert_id TEXT,
  tier TEXT,
  total_quantity INTEGER,
  sold_quantity INTEGER DEFAULT 0,
  PRIMARY KEY (concert_id, tier)
);

-- Active holds
CREATE TABLE holds (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  concert_id TEXT NOT NULL,
  tier TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  expires_at TEXT NOT NULL
);

-- Completed bookings
CREATE TABLE bookings (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  concert_id TEXT NOT NULL,
  total_amount INTEGER NOT NULL,
  status TEXT NOT NULL
);
```

## Scripts

```bash
npm run dev          # Start frontend + backend
npm run build        # Build all packages
npm run lint         # Run ESLint
npm run lint:fix     # Fix lint issues
npm run format       # Format with Prettier
npm run test         # Run unit tests
npm run db:seed      # Seed database
```

## Testing

Unit tests for hold/booking logic:

```bash
npm run test
```

Tests cover:
- Available quantity calculation
- Hold creation and updates
- Expired hold handling
- Double-booking prevention
- Booking with inventory updates

## Trade-offs and Decisions

### Why SQLite?

**Pros:**
- Zero configuration, embedded
- ACID compliant with WAL mode
- Sufficient for demonstration
- Fast reads, serialized writes

**Cons:**
- Single-writer limits throughput
- Not suitable for distributed deployment

**Production alternative:** PostgreSQL with `SELECT FOR UPDATE` or Redis for distributed locking.

### Why Checkout-Time Holds?

**Alternative considered:** Hold tickets when added to cart

**Why we rejected it:**
- Users often browse without buying
- Cart abandonment rate is high
- Would reduce effective inventory

**Our approach:** Only hold when user commits to checkout, maximizing availability for serious buyers.

### Why Activity-Based Extensions?

**Alternative considered:** Fixed hold duration

**Why we chose extensions:**
- Users filling payment forms shouldn't lose tickets
- Inactive users shouldn't block inventory
- Balance between UX and fairness

## Production Considerations

For a production deployment at scale:

1. **Database**: PostgreSQL with connection pooling
2. **Caching**: Redis for availability counts
3. **Locking**: Distributed locks for multi-instance
4. **Monitoring**: APM for latency tracking
5. **Queue**: Background job processing for bookings
