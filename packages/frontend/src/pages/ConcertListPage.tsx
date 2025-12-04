import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getConcerts } from '../services/api';
import type { Concert } from '@ticket-booking/shared';

export default function ConcertListPage(): JSX.Element {
  const [concerts, setConcerts] = useState<Concert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadConcerts() {
      try {
        const data = await getConcerts();
        setConcerts(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load concerts');
      } finally {
        setLoading(false);
      }
    }
    loadConcerts();
  }, []);

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
        <div className="animate-pulse space-y-4 sm:space-y-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card overflow-hidden">
              <div className="h-40 sm:h-32 bg-gray-200" />
              <div className="p-4 space-y-3">
                <div className="h-5 bg-gray-200 rounded w-2/3" />
                <div className="h-4 bg-gray-200 rounded w-1/2" />
                <div className="h-4 bg-gray-200 rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6 sm:py-12">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 sm:px-6 py-4 rounded-lg">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:py-12">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Upcoming Concerts</h1>
        <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600">
          Find and book tickets for the hottest shows
        </p>
      </div>

      <div className="space-y-4 sm:space-y-6">
        {concerts.map((concert) => (
          <Link
            key={concert.id}
            to={`/concerts/${concert.id}`}
            className="card overflow-hidden hover:shadow-md transition-shadow block"
          >
            {/* Mobile: stacked layout, Desktop: horizontal */}
            <div className="sm:flex">
              <div className="h-40 sm:h-auto sm:w-48 flex-shrink-0">
                <img
                  src={concert.imageUrl}
                  alt={concert.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-4 sm:p-6 flex-1 min-w-0">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">
                  {concert.name}
                </h2>
                <p className="text-primary-600 font-medium text-sm sm:text-base">{concert.artist}</p>
                <div className="mt-2 sm:mt-3 space-y-1">
                  <p className="text-gray-600 text-sm flex items-center gap-2">
                    <svg
                      className="w-4 h-4 flex-shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    <span className="truncate">{formatDate(concert.date)}</span>
                  </p>
                  <p className="text-gray-600 text-sm flex items-center gap-2">
                    <svg
                      className="w-4 h-4 flex-shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
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
                    <span className="truncate">{concert.venue}</span>
                  </p>
                </div>
                {/* Mobile: full-width button, Desktop: inline */}
                <div className="mt-4 sm:mt-3">
                  <span className="btn-primary w-full sm:w-auto text-center">
                    Get Tickets
                  </span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {concerts.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No concerts available at the moment.</p>
          <p className="text-gray-400 text-sm mt-1">
            Check back later for new events.
          </p>
        </div>
      )}
    </div>
  );
}
