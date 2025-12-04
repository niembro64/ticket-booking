import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getBooking, getConcert } from '../services/api';
import { formatPrice, TICKET_TIERS, type Booking, type Concert } from '@ticket-booking/shared';

export default function ConfirmationPage(): JSX.Element {
  const { bookingId } = useParams<{ bookingId: string }>();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [concert, setConcert] = useState<Concert | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadBooking() {
      if (!bookingId) return;

      try {
        const { booking: bookingData } = await getBooking(bookingId);
        setBooking(bookingData);

        const { concert: concertData } = await getConcert(bookingData.concertId);
        setConcert(concertData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load booking');
      } finally {
        setLoading(false);
      }
    }

    loadBooking();
  }, [bookingId]);

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 sm:py-12">
        <div className="animate-pulse space-y-4 sm:space-y-6">
          <div className="h-16 sm:h-20 bg-gray-200 rounded-xl" />
          <div className="card p-4 sm:p-6 space-y-4">
            <div className="h-5 bg-gray-200 rounded w-2/3 sm:w-1/2" />
            <div className="h-16 sm:h-20 bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 sm:py-12">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 sm:px-6 py-4 rounded-lg text-sm sm:text-base">
          {error || 'Booking not found'}
        </div>
        <Link to="/" className="btn-secondary mt-4 inline-block">
          Back to Concerts
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 sm:py-12">
      {/* Success Header */}
      <div className="text-center mb-6 sm:mb-8">
        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
          <svg
            className="w-8 h-8 sm:w-10 sm:h-10 text-green-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Booking Confirmed!</h1>
        <p className="text-gray-600 mt-1 sm:mt-2 text-sm sm:text-base">
          Your tickets have been booked successfully.
        </p>
      </div>

      {/* Booking Details */}
      <div className="card p-4 sm:p-6 mb-4 sm:mb-6">
        <div className="flex items-start sm:items-center justify-between gap-3 mb-3 sm:mb-4">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900">Booking Details</h2>
          <span className="bg-green-100 text-green-800 text-xs sm:text-sm px-2 sm:px-3 py-1 rounded-full font-medium whitespace-nowrap">
            {booking.status}
          </span>
        </div>

        <div className="text-xs sm:text-sm text-gray-500 mb-3 sm:mb-4 break-all">
          Booking ID: <span className="font-mono">{booking.id}</span>
        </div>

        {concert && (
          <div className="bg-gray-50 rounded-lg p-3 sm:p-4 mb-3 sm:mb-4">
            <h3 className="font-semibold text-gray-900 text-sm sm:text-base">{concert.name}</h3>
            <p className="text-primary-600 text-sm">{concert.artist}</p>
            <p className="text-gray-600 text-xs sm:text-sm mt-2">
              {formatDate(concert.date)}
            </p>
            <p className="text-gray-600 text-xs sm:text-sm">{concert.venue}</p>
          </div>
        )}

        <div className="border-t border-gray-200 pt-3 sm:pt-4">
          <h3 className="font-medium text-gray-900 mb-2 sm:mb-3 text-sm sm:text-base">Tickets</h3>
          <div className="space-y-2">
            {booking.items.map((item, index) => {
              const tierInfo = TICKET_TIERS[item.tier];
              return (
                <div key={index} className="flex justify-between text-sm">
                  <span className="text-gray-600">
                    {tierInfo.name} x {item.quantity}
                  </span>
                  <span className="font-medium">{formatPrice(item.subtotal)}</span>
                </div>
              );
            })}
          </div>
          <div className="border-t border-gray-200 mt-3 sm:mt-4 pt-3 sm:pt-4 flex justify-between">
            <span className="font-semibold">Total Paid</span>
            <span className="text-lg sm:text-xl font-bold text-primary-600">
              {formatPrice(booking.totalAmount)}
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
        <Link to="/bookings" className="btn-secondary flex-1 text-center">
          View All Bookings
        </Link>
        <Link to="/" className="btn-primary flex-1 text-center">
          Book More Tickets
        </Link>
      </div>

      {/* Demo Notice */}
      <div className="mt-6 sm:mt-8 text-center text-xs sm:text-sm text-gray-500">
        <p>This is a demo booking. No actual payment was processed.</p>
        <p className="mt-1">In a real application, you would receive a confirmation email.</p>
      </div>
    </div>
  );
}
