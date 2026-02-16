/* Settings Panel - Top Left */

import { useState } from 'react';
import { Button } from './ui/button';

interface SettingsPanelProps {
  onClose?: () => void;
}

export default function SettingsPanel({ onClose }: SettingsPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div>
      <Button
        onClick={handleToggle}
        className="brutalist-border brutalist-shadow-hover bg-white text-black hover:bg-white w-full text-sm font-bold"
      >
        ⚙️ SETTINGS
      </Button>

      {isOpen && (
        <div className="brutalist-border bg-white text-black p-4 mt-2 space-y-3 absolute z-50">
          <div className="text-mono text-xs">
            <div className="mb-2">
              <label className="block text-xs font-bold mb-1">SOUND</label>
              <input type="checkbox" defaultChecked className="w-4 h-4" />
            </div>
            <div className="mb-2">
              <label className="block text-xs font-bold mb-1">MUSIC</label>
              <input type="checkbox" defaultChecked className="w-4 h-4" />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">SPEED</label>
              <select className="w-full border border-black p-1 text-xs">
                <option>NORMAL</option>
                <option>FAST</option>
                <option>TURBO</option>
              </select>
            </div>
          </div>
          <Button
            onClick={() => setIsOpen(false)}
            variant="outline"
            className="w-full brutalist-border text-xs"
          >
            CLOSE
          </Button>
        </div>
      )}
    </div>
  );
}
