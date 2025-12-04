import { Routes, Route } from 'react-router-dom';
import { SessionProvider } from './hooks/useSession';
import { TicketStoreProvider } from './hooks/useTicketStore';
import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/Layout';
import ConcertListPage from './pages/ConcertListPage';
import ConcertDetailPage from './pages/ConcertDetailPage';
import CheckoutPage from './pages/CheckoutPage';
import ConfirmationPage from './pages/ConfirmationPage';
import BookingsPage from './pages/BookingsPage';

function App(): JSX.Element {
  return (
    <ErrorBoundary>
      <SessionProvider>
        <TicketStoreProvider>
          <Layout>
            <Routes>
              <Route path="/" element={<ConcertListPage />} />
              <Route path="/concerts/:id" element={<ConcertDetailPage />} />
              <Route path="/checkout/:concertId" element={<CheckoutPage />} />
              <Route path="/confirmation/:bookingId" element={<ConfirmationPage />} />
              <Route path="/bookings" element={<BookingsPage />} />
            </Routes>
          </Layout>
        </TicketStoreProvider>
      </SessionProvider>
    </ErrorBoundary>
  );
}

export default App;
