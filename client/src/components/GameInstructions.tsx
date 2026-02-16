/* Neo-Brutalist Street Food Aesthetic - Game Instructions
 * Design: Torn paper style info cards
 */

import { useState } from 'react';
import { Button } from './ui/button';

export default function GameInstructions() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mb-6">
      <Button
        onClick={() => setIsOpen(!isOpen)}
        variant="outline"
        className="brutalist-border brutalist-shadow-hover bg-white text-black hover:bg-white"
      >
        {isOpen ? 'HIDE' : 'SHOW'} INSTRUCTIONS
      </Button>

      {isOpen && (
        <div className="mt-4 brutalist-border bg-white p-6 brutalist-shadow space-y-4">
          <div>
            <h3 className="text-brutalist text-xl mb-2">HOW TO PLAY</h3>
            <ul className="text-mono text-sm space-y-2">
              <li>• Set your bet amount (1-100)</li>
              <li>• Click SPIN to start the game</li>
              <li>• Match 8+ identical symbols to win</li>
              <li>• Winning symbols explode and cascade down</li>
              <li>• Multiple cascades = bigger wins!</li>
            </ul>
          </div>

          <div>
            <h3 className="text-brutalist text-xl mb-2">ORDERS SYSTEM</h3>
            <ul className="text-mono text-sm space-y-2">
              <li>• Random chance to receive an order before spin</li>
              <li>• Collect the required symbols in ONE spin</li>
              <li>• Complete orders to earn TIP multipliers!</li>
              <li>• Orders expire if not completed</li>
            </ul>
          </div>

          <div>
            <h3 className="text-brutalist text-xl mb-2">FREE SPINS</h3>
            <ul className="text-mono text-sm space-y-2">
              <li>• Land 3+ Order Tickets (📋) to trigger</li>
              <li>• Get multiple orders that persist</li>
              <li>• Complete ALL orders for SUPER BONUS!</li>
              <li>• Or buy free spins packages</li>
            </ul>
          </div>

          <div>
            <h3 className="text-brutalist text-xl mb-2">ANTE MODE</h3>
            <ul className="text-mono text-sm space-y-2">
              <li>• LOW (1.25x): Better order & scatter chances</li>
              <li>• HIGH (5x): Guaranteed order every spin!</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
