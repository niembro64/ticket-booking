import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  getConcert,
  initiateCheckout,
  processPayment,
  releaseHolds,
  sendHeartbeat,
} from '../services/api';
import {
  formatPrice,
  TICKET_TIERS,
  type Concert,
} from '@ticket-booking/shared';
import CountdownTimer from '../components/CountdownTimer';
import { useTicketStore } from '../hooks/useTicketStore';

/**
 * Simplified checkout page.
 *
 * Flow:
 * 1. On mount, initiate checkout which creates holds
 * 2. Use expiresAt from response for countdown (no immediate heartbeat)
 * 3. Periodically send heartbeats to extend hold
 * 4. On expiry, show error and redirect
 */
export default function CheckoutPage(): JSX.Element {
  const { concertId } = useParams<{ concertId: string }>();
  const navigate = useNavigate();
  const ticketStore = useTicketStore();

  // Get selections from global store
  const selections = concertId ? ticketStore.getSelectionsArray(concertId) : [];
  const total = concertId ? ticketStore.getTotal(concertId) : 0;

  const [concert, setConcert] = useState<Concert | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Checkout state
  const [checkoutReady, setCheckoutReady] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // Timer state - managed locally, not via heartbeat hook
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);

  // Payment state
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(false);

  // Form state
  const [cardholderName, setCardholderName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');

  // Refs for cleanup
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<Date>(new Date());

  // Track activity for heartbeat
  useEffect(() => {
    const updateActivity = () => {
      lastActivityRef.current = new Date();
    };

    document.addEventListener('mousemove', updateActivity, { passive: true });
    document.addEventListener('keydown', updateActivity, { passive: true });
    document.addEventListener('click', updateActivity, { passive: true });

    return () => {
      document.removeEventListener('mousemove', updateActivity);
      document.removeEventListener('keydown', updateActivity);
      document.removeEventListener('click', updateActivity);
    };
  }, []);

  // Initialize checkout
  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      if (!concertId) return;

      try {
        // Load concert info
        const concertData = await getConcert(concertId);
        if (cancelled) return;
        setConcert(concertData.concert);

        // Check if we have selections
        if (selections.length === 0) {
          setError('No ticket selection found. Please select tickets first.');
          setLoading(false);
          return;
        }

        // Initiate checkout (creates holds)
        const result = await initiateCheckout(concertId, selections);
        if (cancelled) return;

        if (result.success && result.expiresAt) {
          setExpiresAt(new Date(result.expiresAt));
          setCheckoutReady(true);
        } else {
          setCheckoutError(result.message || 'Failed to reserve tickets');
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to initialize checkout');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    initialize();

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [concertId]);

  // Countdown timer - runs independently of heartbeat
  useEffect(() => {
    if (!expiresAt) return;

    const updateCountdown = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((expiresAt.getTime() - now) / 1000));
      setSecondsRemaining(remaining);

      if (remaining === 0) {
        setCheckoutError('Your ticket reservation has expired. Please go back and select your tickets again.');
        setCheckoutReady(false);
      }
    };

    updateCountdown();
    countdownIntervalRef.current = setInterval(updateCountdown, 1000);

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [expiresAt]);

  // Heartbeat - starts after checkout is ready, with initial delay
  useEffect(() => {
    if (!checkoutReady || !concertId) return;

    const doHeartbeat = async () => {
      try {
        const response = await sendHeartbeat(
          concertId,
          lastActivityRef.current,
          !document.hidden
        );

        if (response.success && response.expiresAt) {
          // Update expiry time from server
          setExpiresAt(new Date(response.expiresAt));
        }
        // Note: We don't call onHoldExpired here - let the countdown handle it
      } catch (err) {
        console.error('Heartbeat error:', err);
      }
    };

    // Start heartbeat after 10 seconds, then every 30 seconds
    const startDelay = setTimeout(() => {
      doHeartbeat();
      heartbeatIntervalRef.current = setInterval(doHeartbeat, 30000);
    }, 10000);

    return () => {
      clearTimeout(startDelay);
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, [checkoutReady, concertId]);

  // Cleanup holds on unmount (unless going to confirmation)
  useEffect(() => {
    return () => {
      // Check if navigating to confirmation
      const isGoingToConfirmation = window.location.pathname.includes('/confirmation/');
      if (!isGoingToConfirmation && concertId) {
        releaseHolds(concertId).catch(() => {});
      }
    };
  }, [concertId]);

  const handlePayment = useCallback(async () => {
    if (!concertId) return;

    setIsProcessingPayment(true);
    setPaymentError(null);

    try {
      const result = await processPayment(
        concertId,
        '', // checkoutSessionId not needed by backend
        cardNumber.slice(-4),
        cardholderName
      );

      if (result.success && result.booking) {
        ticketStore.clearSelections(concertId);
        navigate(`/confirmation/${result.booking.id}`);
      } else {
        setPaymentError(result.message);
        setCanRetry(result.retryAllowed ?? false);
      }
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : 'Payment processing failed');
      setCanRetry(true);
    } finally {
      setIsProcessingPayment(false);
    }
  }, [concertId, cardNumber, cardholderName, navigate, ticketStore]);

  const handleExtendHold = useCallback(async () => {
    if (!concertId) return;

    lastActivityRef.current = new Date();
    try {
      const response = await sendHeartbeat(concertId, new Date(), true);
      if (response.success && response.expiresAt) {
        setExpiresAt(new Date(response.expiresAt));
      }
    } catch (err) {
      console.error('Failed to extend hold:', err);
    }
  }, [concertId]);

  const formatCardNumber = (value: string): string => {
    const digits = value.replace(/\D/g, '').slice(0, 16);
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
  };

  const formatExpiryDate = (value: string): string => {
    const digits = value.replace(/\D/g, '').slice(0, 4);
    if (digits.length >= 2) {
      return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    }
    return digits;
  };

  const isFormValid =
    cardholderName.trim() !== '' &&
    cardNumber.replace(/\s/g, '').length === 16 &&
    expiryDate.length === 5 &&
    cvv.length >= 3;

  const isExpiring = secondsRemaining !== null && secondsRemaining <= 60;

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6 sm:py-12">
        <div className="animate-pulse space-y-4 sm:space-y-6">
          <div className="h-7 bg-gray-200 rounded w-1/2 sm:w-1/3" />
          <div className="card p-4 sm:p-6 space-y-4">
            <div className="h-5 bg-gray-200 rounded w-2/3 sm:w-1/2" />
            <div className="h-16 sm:h-20 bg-gray-200 rounded" />
            <div className="h-11 bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6 sm:py-12">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 sm:px-6 py-4 rounded-lg text-sm sm:text-base">
          {error}
        </div>
        <Link to={`/concerts/${concertId}`} className="btn-secondary mt-4 inline-block">
          Back to Concert
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-4 sm:py-12">
      <Link
        to={`/concerts/${concertId}`}
        className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4 sm:mb-6 py-2"
      >
        <svg className="w-5 h-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Ticket Selection
      </Link>

      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1 sm:mb-2">Checkout</h1>
      {concert && (
        <p className="text-gray-600 text-sm sm:text-base mb-4 sm:mb-6">
          {concert.name} - {concert.artist}
        </p>
      )}

      {/* Countdown Timer */}
      {secondsRemaining !== null && checkoutReady && (
        <div className="mb-4 sm:mb-6">
          <CountdownTimer
            secondsRemaining={secondsRemaining}
            isExpiring={isExpiring}
            onExtend={handleExtendHold}
          />
        </div>
      )}

      {/* Checkout Error */}
      {checkoutError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 sm:mb-6 text-sm sm:text-base">
          {checkoutError}
          <div className="mt-3">
            <Link to={`/concerts/${concertId}`} className="btn-secondary">
              Go Back
            </Link>
          </div>
        </div>
      )}

      {checkoutReady && !checkoutError && (
        <div className="space-y-4 sm:space-y-0 sm:grid sm:grid-cols-1 lg:grid-cols-2 sm:gap-6 lg:gap-8">
          {/* Order Summary - shows first on mobile */}
          <div className="card p-4 sm:p-6 order-1">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">
              Order Summary
            </h2>
            <div className="space-y-2 sm:space-y-3 mb-3 sm:mb-4">
              {selections.map((sel) => {
                const tierInfo = TICKET_TIERS[sel.tier];
                return (
                  <div key={sel.tier} className="flex justify-between text-sm sm:text-base">
                    <span className="text-gray-600">
                      {tierInfo.name} x {sel.quantity}
                    </span>
                    <span className="font-medium">
                      {formatPrice(tierInfo.price * sel.quantity)}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="border-t border-gray-200 pt-3 sm:pt-4">
              <div className="flex justify-between">
                <span className="font-semibold">Total</span>
                <span className="text-lg sm:text-xl font-bold text-primary-600">
                  {formatPrice(total)}
                </span>
              </div>
            </div>
          </div>

          {/* Payment Form */}
          <div className="card p-4 sm:p-6 order-2">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">
              Payment Details
            </h2>

            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-3 sm:px-4 py-2 sm:py-3 rounded-lg mb-4 text-xs sm:text-sm">
              <strong>Demo Mode:</strong> Use any card number. Payment has a 15%
              simulated failure rate to demonstrate retry handling.
            </div>

            {paymentError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 sm:px-4 py-2 sm:py-3 rounded-lg mb-4 text-sm">
                {paymentError}
                {canRetry && (
                  <p className="mt-1 text-xs sm:text-sm">
                    Your tickets are still reserved. You can try again.
                  </p>
                )}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Cardholder Name
                </label>
                <input
                  type="text"
                  value={cardholderName}
                  onChange={(e) => setCardholderName(e.target.value)}
                  className="input"
                  placeholder="John Doe"
                  disabled={isProcessingPayment}
                  autoComplete="cc-name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Card Number
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                  className="input font-mono"
                  placeholder="4242 4242 4242 4242"
                  disabled={isProcessingPayment}
                  autoComplete="cc-number"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Expiry Date
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(formatExpiryDate(e.target.value))}
                    className="input font-mono"
                    placeholder="MM/YY"
                    disabled={isProcessingPayment}
                    autoComplete="cc-exp"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    CVV
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={cvv}
                    onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    className="input font-mono"
                    placeholder="123"
                    disabled={isProcessingPayment}
                    autoComplete="cc-csc"
                  />
                </div>
              </div>

              <button
                onClick={handlePayment}
                disabled={!isFormValid || isProcessingPayment}
                className="btn-primary w-full mt-4 sm:mt-6"
              >
                {isProcessingPayment ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                    Processing...
                  </span>
                ) : (
                  `Pay ${formatPrice(total)}`
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
