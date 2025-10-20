import React from 'react';
import { Camera, CameraOff } from 'lucide-react';
import { useScreenshotMode } from '../context/screenshot-mode-context';

export function ScreenshotModeToggle() {
  const { isScreenshotMode, toggleScreenshotMode } = useScreenshotMode();

  return (
    <div className="fixed top-4 right-4 z-50">
      <button
        onClick={toggleScreenshotMode}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-lg transition-all
          ${isScreenshotMode
            ? 'bg-green-500 text-white hover:bg-green-600'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }
        `}
        title={isScreenshotMode ? 'Disable Screenshot Mode' : 'Enable Screenshot Mode'}
      >
        {isScreenshotMode ? (
          <>
            <Camera className="w-4 h-4" />
            <span className="text-sm font-medium">Screenshot Mode</span>
          </>
        ) : (
          <>
            <CameraOff className="w-4 h-4" />
            <span className="text-sm font-medium">Normal Mode</span>
          </>
        )}
      </button>

      {isScreenshotMode && (
        <div className="mt-2 px-4 py-2 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-xs text-green-700">
            Private data is hidden
          </p>
        </div>
      )}
    </div>
  );
}
