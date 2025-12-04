// ============================================================================
// HOLD CONFIGURATION
// ============================================================================

/**
 * Hold timing configuration.
 * Tickets are held when user enters checkout, released on completion/abandonment/timeout.
 */
export interface HoldConfig {
  holdDurationMs: number;        // Base hold duration (10 minutes)
  inactivityTimeoutMs: number;   // Time without activity before release (3 minutes)
  gracePeriodMs: number;         // Grace period when tab hidden (60 seconds)
  hardCapMs: number;             // Maximum hold time regardless of activity (15 minutes)
  warningBeforeExpiryMs: number; // When to show warning (60 seconds before expiry)
  heartbeatIntervalMs: number;   // How often client sends heartbeat (30 seconds)
}

// ============================================================================
// TICKET TIERS
// ============================================================================

export type TicketTier = 'VIP' | 'FRONT_ROW' | 'GA';

export interface TicketTierInfo {
  tier: TicketTier;
  name: string;
  price: number;        // Price in cents (to avoid floating point issues)
  description: string;
}

export const TICKET_TIERS: Record<TicketTier, TicketTierInfo> = {
  VIP: {
    tier: 'VIP',
    name: 'VIP',
    price: 10000,  // $100.00
    description: 'Premium seating with exclusive backstage access',
  },
  FRONT_ROW: {
    tier: 'FRONT_ROW',
    name: 'Front Row',
    price: 5000,   // $50.00
    description: 'Front row seats with the best view',
  },
  GA: {
    tier: 'GA',
    name: 'General Admission',
    price: 1000,   // $10.00
    description: 'Standing room with access to all general areas',
  },
};

// ============================================================================
// ENTITIES
// ============================================================================

export interface Concert {
  id: string;
  name: string;
  artist: string;
  venue: string;
  date: string;           // ISO date string
  imageUrl: string;
  description: string;
  createdAt: string;
}

export interface TicketInventory {
  concertId: string;
  tier: TicketTier;
  totalQuantity: number;
  availableQuantity: number;  // Total - sold - held
  soldQuantity: number;
  heldQuantity: number;
}

export interface Hold {
  id: string;
  sessionId: string;
  concertId: string;
  tier: TicketTier;
  quantity: number;
  createdAt: string;
  expiresAt: string;
  lastActivityAt: string;
}

export interface Booking {
  id: string;
  sessionId: string;
  concertId: string;
  items: BookingItem[];
  totalAmount: number;     // In cents
  status: BookingStatus;
  createdAt: string;
  confirmedAt: string | null;
}

export interface BookingItem {
  tier: TicketTier;
  quantity: number;
  pricePerTicket: number;  // In cents
  subtotal: number;        // In cents
}

export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'FAILED' | 'CANCELLED';

// ============================================================================
// API REQUESTS & RESPONSES
// ============================================================================

// Concerts
export interface GetConcertsResponse {
  concerts: Concert[];
}

export interface GetConcertResponse {
  concert: Concert;
  inventory: TicketInventory[];
}

// Holds
export interface CreateHoldRequest {
  concertId: string;
  selections: TicketSelection[];
}

export interface TicketSelection {
  tier: TicketTier;
  quantity: number;
}

export interface CreateHoldResponse {
  success: boolean;
  holds: Hold[];
  message?: string;
  availableQuantities?: Record<TicketTier, number>;  // If partial/failed
}

export interface UpdateHoldRequest {
  selections: TicketSelection[];
}

export interface HeartbeatRequest {
  concertId: string;
  lastActivityAt: string;
  isTabVisible: boolean;
}

export interface HeartbeatResponse {
  success: boolean;
  holds: Hold[];
  expiresAt: string | null;
  message?: string;
}

export interface ReleaseHoldRequest {
  concertId: string;
}

// Checkout
export interface CheckoutRequest {
  concertId: string;
  selections: TicketSelection[];
}

export interface CheckoutResponse {
  success: boolean;
  checkoutSessionId: string;
  holds: Hold[];
  expiresAt: string;
  message?: string;
  unavailable?: TicketSelection[];  // If some tickets unavailable
}

// Payment
export interface PaymentRequest {
  checkoutSessionId: string;
  concertId: string;
  // Simulated payment details (not real)
  cardLastFour: string;
  cardholderName: string;
}

export interface PaymentResponse {
  success: boolean;
  booking?: Booking;
  message: string;
  retryAllowed?: boolean;  // If payment failed, can they retry?
}

// Session
export interface SessionResponse {
  sessionId: string;
  holds: Hold[];
  config: HoldConfig;
}

// ============================================================================
// WEBSOCKET EVENTS (for real-time updates)
// ============================================================================

export interface InventoryUpdateEvent {
  type: 'INVENTORY_UPDATE';
  concertId: string;
  inventory: TicketInventory[];
}

export interface HoldExpiringEvent {
  type: 'HOLD_EXPIRING';
  concertId: string;
  expiresAt: string;
  secondsRemaining: number;
}

export interface HoldExpiredEvent {
  type: 'HOLD_EXPIRED';
  concertId: string;
  message: string;
}

export type WebSocketEvent = InventoryUpdateEvent | HoldExpiringEvent | HoldExpiredEvent;

// ============================================================================
// LIMITS & CONSTRAINTS
// ============================================================================

export const LIMITS = {
  MAX_TICKETS_PER_TIER: 10,
  MAX_TICKETS_PER_ORDER: 20,
  PAYMENT_FAILURE_RATE: 0.15,  // 15% simulated failure rate
};

// ============================================================================
// UTILITY TYPES
// ============================================================================

export interface ApiError {
  error: string;
  message: string;
  code?: string;
}

export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function isTicketTier(value: unknown): value is TicketTier {
  return typeof value === 'string' && (value === 'VIP' || value === 'FRONT_ROW' || value === 'GA');
}
