import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps): JSX.Element {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between items-center h-14 sm:h-16">
            <Link to="/" className="flex items-center gap-2" onClick={() => setMobileMenuOpen(false)}>
              <svg
                className="h-7 w-7 sm:h-8 sm:w-8 text-primary-600"
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
              <span className="text-lg sm:text-xl font-bold text-gray-900">ConcertTix</span>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden sm:flex items-center gap-6">
              <Link
                to="/"
                className={`font-medium transition-colors ${
                  isActive('/') ? 'text-primary-600' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Concerts
              </Link>
              <Link
                to="/bookings"
                className={`font-medium transition-colors ${
                  isActive('/bookings') ? 'text-primary-600' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                My Bookings
              </Link>
            </nav>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="sm:hidden p-2 -mr-2 text-gray-600 hover:text-gray-900"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>

          {/* Mobile Nav */}
          {mobileMenuOpen && (
            <nav className="sm:hidden border-t border-gray-100 py-3 space-y-1">
              <Link
                to="/"
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-3 rounded-lg font-medium transition-colors ${
                  isActive('/') ? 'bg-primary-50 text-primary-600' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                Concerts
              </Link>
              <Link
                to="/bookings"
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-3 rounded-lg font-medium transition-colors ${
                  isActive('/bookings') ? 'bg-primary-50 text-primary-600' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                My Bookings
              </Link>
            </nav>
          )}
        </div>
      </header>

      <main className="flex-1">
        {children}
      </main>

      <footer className="bg-gray-100 border-t border-gray-200 py-4 sm:py-6">
        <div className="max-w-7xl mx-auto px-4">
          <p className="text-center text-gray-500 text-xs sm:text-sm">
            Demo ticket booking system. No real payments processed.
          </p>
        </div>
      </footer>
    </div>
  );
}
