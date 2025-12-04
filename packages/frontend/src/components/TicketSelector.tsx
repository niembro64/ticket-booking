import { useEffect } from 'react';
import {
  TICKET_TIERS,
  formatPrice,
  type TicketTier,
  type TicketInventory,
  type TicketSelection,
  LIMITS,
} from '@ticket-booking/shared';
import { useTicketStore } from '../hooks/useTicketStore';

interface TicketSelectorProps {
  concertId: string;
  inventory: TicketInventory[];
  onSelectionsChange: (selections: TicketSelection[], total: number) => void;
  disabled?: boolean;
}

export default function TicketSelector({
  concertId,
  inventory,
  onSelectionsChange,
  disabled = false,
}: TicketSelectorProps): JSX.Element {
  const ticketStore = useTicketStore();

  // Get quantities from global store
  const quantities = ticketStore.getSelections(concertId);
  const total = ticketStore.getTotal(concertId);

  const inventoryByTier = inventory.reduce(
    (acc, inv) => ({ ...acc, [inv.tier]: inv }),
    {} as Record<TicketTier, TicketInventory>
  );

  // Notify parent of selection changes
  useEffect(() => {
    const selections = ticketStore.getSelectionsArray(concertId);
    onSelectionsChange(selections, total);
  }, [quantities, total, concertId, onSelectionsChange, ticketStore]);

  const handleQuantityChange = (tier: TicketTier, delta: number) => {
    const inv = inventoryByTier[tier];
    const maxAvailable = inv?.availableQuantity ?? 0;
    const currentQty = quantities[tier];
    const newQty = Math.max(
      0,
      Math.min(
        currentQty + delta,
        Math.min(maxAvailable, LIMITS.MAX_TICKETS_PER_TIER)
      )
    );

    // Check total limit
    const totalWithNew = Object.entries(quantities).reduce(
      (sum, [t, q]) => sum + (t === tier ? newQty : q),
      0
    );
    if (totalWithNew > LIMITS.MAX_TICKETS_PER_ORDER) {
      return;
    }

    ticketStore.setQuantity(concertId, tier, newQty);
  };

  const tiers: TicketTier[] = ['VIP', 'FRONT_ROW', 'GA'];

  return (
    <div className="space-y-3 sm:space-y-4">
      {tiers.map((tier) => {
        const tierInfo = TICKET_TIERS[tier];
        const inv = inventoryByTier[tier];
        const available = inv?.availableQuantity ?? 0;
        const quantity = quantities[tier];
        const isSoldOut = available === 0;

        return (
          <div
            key={tier}
            className={`card p-4 ${isSoldOut ? 'opacity-60' : ''}`}
          >
            {/* Mobile: stacked layout, Desktop: side by side */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-base sm:text-lg">{tierInfo.name}</h3>
                  {tier === 'VIP' && (
                    <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-0.5 rounded-full font-medium">
                      Premium
                    </span>
                  )}
                </div>
                <p className="text-gray-500 text-sm mt-1">{tierInfo.description}</p>
                <div className="mt-2 flex items-center gap-3 flex-wrap">
                  <span className="text-lg sm:text-xl font-bold text-primary-600">
                    {formatPrice(tierInfo.price)}
                  </span>
                  <span
                    className={`text-sm ${
                      available <= 10 && available > 0
                        ? 'text-orange-600 font-medium'
                        : 'text-gray-500'
                    }`}
                  >
                    {isSoldOut
                      ? 'Sold out'
                      : available <= 10
                      ? `Only ${available} left!`
                      : `${available} available`}
                  </span>
                </div>
              </div>

              {/* Quantity controls - larger touch targets */}
              <div className="flex items-center justify-center gap-4 sm:gap-3">
                <button
                  onClick={() => handleQuantityChange(tier, -1)}
                  disabled={disabled || quantity === 0}
                  className="w-12 h-12 sm:w-11 sm:h-11 rounded-full border-2 border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 active:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  aria-label="Decrease quantity"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  </svg>
                </button>

                <span className="w-10 text-center text-xl font-semibold tabular-nums">
                  {quantity}
                </span>

                <button
                  onClick={() => handleQuantityChange(tier, 1)}
                  disabled={
                    disabled ||
                    isSoldOut ||
                    quantity >= Math.min(available, LIMITS.MAX_TICKETS_PER_TIER)
                  }
                  className="w-12 h-12 sm:w-11 sm:h-11 rounded-full border-2 border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 active:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  aria-label="Increase quantity"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            </div>

            {quantity > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
                <span className="text-gray-600 text-sm">Subtotal</span>
                <span className="font-semibold">
                  {formatPrice(tierInfo.price * quantity)}
                </span>
              </div>
            )}
          </div>
        );
      })}

      <p className="text-xs text-gray-500 text-center pt-2">
        Max {LIMITS.MAX_TICKETS_PER_TIER} per tier, {LIMITS.MAX_TICKETS_PER_ORDER} total per order
      </p>
    </div>
  );
}
