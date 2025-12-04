import type {
  Concert,
  TicketInventory,
  Hold,
  Booking,
  HoldConfig,
  TicketSelection,
  GetConcertsResponse,
  GetConcertResponse,
  CreateHoldResponse,
  HeartbeatResponse,
  CheckoutResponse,
  PaymentResponse,
  SessionResponse,
} from '@ticket-booking/shared';

const API_BASE = '/api';

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

// Session
export async function getSession(): Promise<SessionResponse> {
  return fetchApi<SessionResponse>('/session');
}

// Concerts
export async function getConcerts(): Promise<Concert[]> {
  const data = await fetchApi<GetConcertsResponse>('/concerts');
  return data.concerts;
}

export async function getConcert(id: string): Promise<{ concert: Concert; inventory: TicketInventory[] }> {
  return fetchApi<GetConcertResponse>(`/concerts/${id}`);
}

// Holds
export async function getHolds(concertId: string): Promise<{ holds: Hold[] }> {
  return fetchApi<{ holds: Hold[] }>(`/holds/${concertId}`);
}

export async function createOrUpdateHolds(
  concertId: string,
  selections: TicketSelection[]
): Promise<CreateHoldResponse> {
  return fetchApi<CreateHoldResponse>('/holds', {
    method: 'POST',
    body: JSON.stringify({ concertId, selections }),
  });
}

export async function sendHeartbeat(
  concertId: string,
  lastActivityAt: Date,
  isTabVisible: boolean
): Promise<HeartbeatResponse> {
  return fetchApi<HeartbeatResponse>(`/holds/${concertId}/heartbeat`, {
    method: 'POST',
    body: JSON.stringify({
      concertId,
      lastActivityAt: lastActivityAt.toISOString(),
      isTabVisible,
    }),
  });
}

export async function releaseHolds(concertId: string): Promise<void> {
  await fetchApi(`/holds/${concertId}`, { method: 'DELETE' });
}

// Checkout
export async function initiateCheckout(
  concertId: string,
  selections: TicketSelection[]
): Promise<CheckoutResponse> {
  return fetchApi<CheckoutResponse>('/bookings/checkout', {
    method: 'POST',
    body: JSON.stringify({ concertId, selections }),
  });
}

export async function processPayment(
  concertId: string,
  checkoutSessionId: string,
  cardLastFour: string,
  cardholderName: string,
  selections?: TicketSelection[]
): Promise<PaymentResponse> {
  return fetchApi<PaymentResponse>('/bookings/payment', {
    method: 'POST',
    body: JSON.stringify({
      concertId,
      checkoutSessionId,
      cardLastFour,
      cardholderName,
      selections,
    }),
  });
}

// Bookings
export async function getBookings(): Promise<{ bookings: Booking[] }> {
  return fetchApi<{ bookings: Booking[] }>('/bookings');
}

export async function getBooking(id: string): Promise<{ booking: Booking }> {
  return fetchApi<{ booking: Booking }>(`/bookings/${id}`);
}

export type { Concert, TicketInventory, Hold, Booking, HoldConfig, TicketSelection };
