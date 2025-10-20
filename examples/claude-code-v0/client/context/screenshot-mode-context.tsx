import React, { createContext, useContext } from 'react';
import { useAtom } from 'jotai';
import { screenshotModeAtom } from '../store/screenshotMode';

interface ScreenshotModeContextType {
  isScreenshotMode: boolean;
  toggleScreenshotMode: () => void;
}

const ScreenshotModeContext = createContext<ScreenshotModeContextType | undefined>(undefined);

export function ScreenshotModeProvider({ children }: { children: React.ReactNode }) {
  const [isScreenshotMode, setScreenshotMode] = useAtom(screenshotModeAtom);

  const toggleScreenshotMode = () => {
    setScreenshotMode(prev => !prev);
  };

  return (
    <ScreenshotModeContext.Provider value={{ isScreenshotMode, toggleScreenshotMode }}>
      {children}
    </ScreenshotModeContext.Provider>
  );
}

export function useScreenshotMode() {
  const context = useContext(ScreenshotModeContext);
  if (context === undefined) {
    throw new Error('useScreenshotMode must be used within a ScreenshotModeProvider');
  }
  return context;
}