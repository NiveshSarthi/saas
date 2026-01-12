import React, { createContext, useContext, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

const FontSizeContext = createContext();

export function useFontSize() {
  return useContext(FontSizeContext);
}

export function FontSizeProvider({ children }) {
  const [fontSize, setFontSize] = useState(() => {
    if (typeof window !== 'undefined') {
      return parseInt(localStorage.getItem('appFontSize') || '100');
    }
    return 100;
  });

  useEffect(() => {
    document.documentElement.style.fontSize = `${fontSize}%`;
    localStorage.setItem('appFontSize', fontSize.toString());
  }, [fontSize]);

  const increase = () => setFontSize(prev => Math.min(prev + 10, 150));
  const decrease = () => setFontSize(prev => Math.max(prev - 10, 80));
  const reset = () => setFontSize(100);

  return (
    <FontSizeContext.Provider value={{ fontSize, increase, decrease, reset }}>
      {children}
    </FontSizeContext.Provider>
  );
}

export default function FontSizeControl() {
  const { fontSize, increase, decrease, reset } = useFontSize();

  return (
    <div className="flex items-center gap-1 bg-white/80 backdrop-blur-sm rounded-lg border border-slate-200 p-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={decrease}
        disabled={fontSize <= 80}
        className="h-8 w-8 p-0"
        title="Decrease font size"
      >
        <ZoomOut className="w-4 h-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={reset}
        className="h-8 px-2 text-xs font-semibold"
        title="Reset to default"
      >
        {fontSize}%
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={increase}
        disabled={fontSize >= 150}
        className="h-8 w-8 p-0"
        title="Increase font size"
      >
        <ZoomIn className="w-4 h-4" />
      </Button>
    </div>
  );
}