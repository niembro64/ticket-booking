import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getBookings, getConcerts } from '../services/api';
import { formatPrice, TICKET_TIERS, type Booking, type Concert } from '@ticket-booking/shared';

export default function BookingsPage(): JSX.Element {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [concerts, setConcerts] = useState<Map<string, Concert>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [{ bookings: bookingsData }, concertsData] = await Promise.all([
          getBookings(),
          getConcerts(),
        ]);

        setBookings(bookingsData);
        setConcerts(new Map(concertsData.map((c) => [c.id, c])));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load bookings');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6 sm:py-12">
        <div className="animate-pulse space-y-4 sm:space-y-6">
          <div className="h-7 bg-gray-200 rounded w-1/3 sm:w-1/4" />
          {[1, 2].map((i) => (
            <div key={i} className="card p-4 sm:p-6 space-y-3 sm:space-y-4">
              <div className="h-5 bg-gray-200 rounded w-2/3 sm:w-1/3" />
              <div className="h-16 sm:h-20 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6 sm:py-12">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 sm:px-6 py-4 rounded-lg text-sm sm:text-base">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:py-12">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6 sm:mb-8">My Bookings</h1>

      {bookings.length === 0 ? (
        <div className="card p-8 sm:p-12 text-center">
          <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
            <svg
              className="w-7 h-7 sm:w-8 sm:h-8 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
              />
            </svg>
          </div>
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">
            No bookings yet
          </h2>
          <p className="text-gray-600 mb-5 sm:mb-6 text-sm sm:text-base">
            You haven't booked any tickets yet. Browse our concerts to get
            started!
          </p>
          <Link to="/" className="btn-primary">
            Browse Concerts
          </Link>
        </div>
      ) : (
        <div className="space-y-4 sm:space-y-6">
          {bookings.map((booking) => {
            const concert = concerts.get(booking.concertId);

            return (
              <div key={booking.id} className="card overflow-hidden">
                <div className="p-4 sm:p-6">
                  <div className="flex items-start justify-between gap-3 mb-3 sm:mb-4">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-base sm:text-lg font-semibold text-gray-900 truncate">
                        {concert?.name || 'Unknown Concert'}
                      </h2>
                      {concert && (
                        <p className="text-primary-600 text-sm">{concert.artist}</p>
                      )}
                    </div>
                    <span
                      className={`text-xs sm:text-sm px-2 sm:px-3 py-1 rounded-full font-medium whitespace-nowrap ${
                        booking.status === 'CONFIRMED'
                          ? 'bg-green-100 text-green-800'
                          : booking.status === 'PENDING'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {booking.status}
                    </span>
                  </div>

                  {concert && (
                    <div className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">
                      <p>{formatDate(concert.date)}</p>
                      <p>{concert.venue}</p>
                    </div>
                  )}

                  <div className="border-t border-gray-200 pt-3 sm:pt-4">
                    <div className="flex flex-wrap gap-2 sm:gap-3 mb-3 sm:mb-4">
                      {booking.items.map((item, index) => {
                        const tierInfo = TICKET_TIERS[item.tier];
                        return (
                          <span
                            key={index}
                            className="bg-gray-100 text-gray-700 text-xs sm:text-sm px-2 sm:px-3 py-1 rounded-full"
                          >
                            {tierInfo.name} x {item.quantity}
                          </span>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs sm:text-sm text-gray-500">
                        Booked on {formatDate(booking.createdAt)}
                      </span>
                      <span className="text-base sm:text-lg font-bold text-primary-600">
                        {formatPrice(booking.totalAmount)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 px-4 sm:px-6 py-3 border-t border-gray-200">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-gray-500 font-mono truncate">
                      ID: {booking.id}
                    </span>
                    <Link
                      to={`/confirmation/${booking.id}`}
                      className="text-primary-600 hover:text-primary-700 text-sm font-medium whitespace-nowrap"
                    >
                      View Details
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
