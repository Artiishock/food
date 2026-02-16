import { Button } from './ui/button';

interface LeftBannersProps {
  isFreeSpins: boolean;
  freeSpinsRemaining: number;
  anteMode: 'none' | 'low' | 'high';
  onBuyFreeSpins: (type: 'cheap' | 'standard') => void;
  onAnteChange: (mode: 'none' | 'low' | 'high') => void;
  isSpinning: boolean;
}

export default function LeftBanners({
  isFreeSpins,
  freeSpinsRemaining,
  anteMode,
  onBuyFreeSpins,
  onAnteChange,
  isSpinning,
}: LeftBannersProps) {
  return (
    <>
      {/* FS Cheap Package Banner */}
      <div className="bg-white p-6 rounded-lg shadow-lg h-32 flex flex-col justify-center">
        <div className="text-sm font-bold text-gray-700">Баннер дорого пакета FS</div>
        <Button
          onClick={() => onBuyFreeSpins('cheap')}
          disabled={isSpinning || isFreeSpins}
          className="mt-2 bg-blue-500 hover:bg-blue-600 text-white text-xs"
        >
          CHEAP (50x) - 5 FS
        </Button>
      </div>

      {/* FS Expensive Package Banner */}
      <div className="bg-white p-6 rounded-lg shadow-lg h-32 flex flex-col justify-center">
        <div className="text-sm font-bold text-gray-700">Баннер дешевого пакета FS</div>
        <Button
          onClick={() => onBuyFreeSpins('standard')}
          disabled={isSpinning || isFreeSpins}
          className="mt-2 bg-green-500 hover:bg-green-600 text-white text-xs"
        >
          STANDARD (100x) - 10 FS
        </Button>
      </div>

      {/* Ante Mode Banner */}
      <div className="bg-white p-6 rounded-lg shadow-lg h-32 flex flex-col justify-center">
        <div className="text-sm font-bold text-gray-700 mb-2">Вкл/Выкл ставки Анте</div>
        <div className="flex gap-2 flex-col">
          <Button
            onClick={() => onAnteChange('none')}
            variant={anteMode === 'none' ? 'default' : 'outline'}
            disabled={isSpinning}
            className="text-xs"
          >
            NORMAL
          </Button>
          <Button
            onClick={() => onAnteChange('low')}
            variant={anteMode === 'low' ? 'default' : 'outline'}
            disabled={isSpinning}
            className="text-xs"
          >
            LOW 1.25x
          </Button>
          <Button
            onClick={() => onAnteChange('high')}
            variant={anteMode === 'high' ? 'default' : 'outline'}
            disabled={isSpinning}
            className="text-xs"
          >
            HIGH 5x
          </Button>
        </div>
      </div>

      {/* Free Spins Status */}
      {isFreeSpins && (
        <div className="bg-yellow-300 p-6 rounded-lg shadow-lg h-32 flex flex-col justify-center border-2 border-yellow-500">
          <div className="text-lg font-bold text-gray-800">FREE SPINS</div>
          <div className="text-2xl font-bold text-gray-800 mt-2">{freeSpinsRemaining}</div>
        </div>
      )}
    </>
  );
}
