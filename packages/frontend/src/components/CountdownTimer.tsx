interface CountdownTimerProps {
  secondsRemaining: number | null;
  isExpiring: boolean;
  onExtend?: () => void;
  showExtendButton?: boolean;
}

export default function CountdownTimer({
  secondsRemaining,
  isExpiring,
  onExtend,
  showExtendButton = true,
}: CountdownTimerProps): JSX.Element | null {
  if (secondsRemaining === null) {
    return null;
  }

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  return (
    <div
      className={`rounded-lg p-3 sm:p-4 ${
        isExpiring
          ? 'bg-red-50 border border-red-200'
          : 'bg-blue-50 border border-blue-200'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <div
            className={`flex-shrink-0 ${
              isExpiring ? 'countdown-warning text-red-600' : 'text-blue-600'
            }`}
          >
            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div>
            <p
              className={`font-medium text-sm sm:text-base ${
                isExpiring ? 'text-red-800' : 'text-blue-800'
              }`}
            >
              {isExpiring ? 'Tickets expiring soon!' : 'Tickets reserved'}
            </p>
            <p
              className={`text-xs sm:text-sm ${
                isExpiring ? 'text-red-600' : 'text-blue-600'
              }`}
            >
              Time remaining:{' '}
              <span className="font-mono font-bold">{formattedTime}</span>
            </p>
          </div>
        </div>

        {showExtendButton && isExpiring && onExtend && (
          <button
            onClick={onExtend}
            className="btn-primary text-sm w-full sm:w-auto"
          >
            I'm still here
          </button>
        )}
      </div>

      {isExpiring && (
        <p className="mt-2 text-xs sm:text-sm text-red-600">
          Tap anywhere to stay active. Your tickets will be released if you're inactive.
        </p>
      )}
    </div>
  );
}
