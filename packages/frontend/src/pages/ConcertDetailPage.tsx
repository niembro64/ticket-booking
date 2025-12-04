import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getConcert } from '../services/api';
import { formatPrice, type TicketSelection, type TicketInventory, type Concert } from '@ticket-booking/shared';
import TicketSelector from '../components/TicketSelector';
import { useTicketStore } from '../hooks/useTicketStore';
import { useAvailabilityStream } from '../hooks/useAvailabilityStream';

export default function ConcertDetailPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const ticketStore = useTicketStore();

  const [concert, setConcert] = useState<Concert | null>(null);
  const [inventory, setInventory] = useState<TicketInventory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Subscribe to real-time availability updates via SSE
  const handleInventoryUpdate = useCallback((newInventory: TicketInventory[]) => {
    setInventory(newInventory);
  }, []);
  useAvailabilityStream(id, handleInventoryUpdate);

  // Get selections from global store
  const selections = id ? ticketStore.getSelectionsArray(id) : [];
  const total = id ? ticketStore.getTotal(id) : 0;

  const loadConcert = useCallback(async (concertId: string) => {
    try {
      const data = await getConcert(concertId);
      setConcert(data.concert);
      setInventory(data.inventory);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load concert');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (id) loadConcert(id);
  }, [id, loadConcert]);

  const handleSelectionsChange = useCallback(
    (_newSelections: TicketSelection[], _newTotal: number) => {
      // Selections are managed by the global store
    },
    []
  );

  const handleProceedToCheckout = () => {
    if (id && selections.length > 0) {
      navigate(`/checkout/${id}`);
    }
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6 sm:py-12">
        <div className="animate-pulse">
          <div className="h-48 sm:h-64 bg-gray-200 rounded-xl mb-4 sm:mb-6" />
          <div className="h-7 bg-gray-200 rounded w-2/3 mb-3" />
          <div className="h-5 bg-gray-200 rounded w-1/3 mb-6" />
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card p-4 sm:p-6 h-20 sm:h-24" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !concert) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6 sm:py-12">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 sm:px-6 py-4 rounded-lg">
          {error || 'Concert not found'}
        </div>
        <Link to="/" className="btn-secondary mt-4 inline-block">
          Back to Concerts
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 sm:py-12 pb-32 lg:pb-12">
      <Link
        to="/"
        className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4 sm:mb-6 py-2"
      >
        <svg className="w-5 h-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
        Back to Concerts
      </Link>

      <div className="lg:grid lg:grid-cols-3 lg:gap-8">
        {/* Concert Info */}
        <div className="lg:col-span-2">
          <div className="card overflow-hidden">
            <div className="h-48 sm:h-64 relative">
              <img
                src={concert.imageUrl}
                alt={concert.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 text-white">
                <h1 className="text-2xl sm:text-3xl font-bold">{concert.name}</h1>
                <p className="text-lg sm:text-xl opacity-90">{concert.artist}</p>
              </div>
            </div>
            <div className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-4 text-gray-600 mb-4">
                <span className="flex items-center gap-2 text-sm sm:text-base">
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  {formatDate(concert.date)}
                </span>
                <span className="flex items-center gap-2 text-sm sm:text-base">
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  {concert.venue}
                </span>
              </div>
              <p className="text-gray-700 text-sm sm:text-base">{concert.description}</p>
            </div>
          </div>

          {/* Ticket Selection */}
          <div className="mt-6 sm:mt-8">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">
              Select Tickets
            </h2>
            <TicketSelector
              concertId={id!}
              inventory={inventory}
              onSelectionsChange={handleSelectionsChange}
            />
          </div>
        </div>

        {/* Desktop Sidebar */}
        <div className="hidden lg:block lg:col-span-1">
          <div className="card p-6 sticky top-20">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Order Summary
            </h3>

            {selections.length === 0 ? (
              <p className="text-gray-500 text-sm">
                Select tickets to see your order summary
              </p>
            ) : (
              <>
                <div className="space-y-3 mb-4">
                  {selections.map((sel) => (
                    <div key={sel.tier} className="flex justify-between text-sm">
                      <span className="text-gray-600">
                        {sel.tier === 'FRONT_ROW' ? 'Front Row' : sel.tier} x{' '}
                        {sel.quantity}
                      </span>
                      <span className="font-medium">
                        {formatPrice(
                          sel.quantity *
                            (sel.tier === 'VIP'
                              ? 10000
                              : sel.tier === 'FRONT_ROW'
                              ? 5000
                              : 1000)
                        )}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-gray-200 pt-4 mb-6">
                  <div className="flex justify-between">
                    <span className="font-semibold">Total</span>
                    <span className="text-xl font-bold text-primary-600">
                      {formatPrice(total)}
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleProceedToCheckout}
                  className="btn-primary w-full"
                  disabled={selections.length === 0}
                >
                  Proceed to Checkout
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Fixed Bottom Bar */}
      {selections.length > 0 && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg z-40">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-gray-600">
                {selections.reduce((sum, s) => sum + s.quantity, 0)} tickets
              </p>
              <p className="text-lg font-bold text-primary-600">
                {formatPrice(total)}
              </p>
            </div>
            <button
              onClick={handleProceedToCheckout}
              className="btn-primary flex-1 max-w-xs"
            >
              Checkout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
