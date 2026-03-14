import React, { createContext, useCallback, useContext, useRef } from 'react';

type DismissFn = () => void;

interface ChartTooltipContextValue {
  registerChart: (id: string, dismiss: DismissFn) => void;
  unregisterChart: (id: string) => void;
  notifyChartActive: (id: string) => void;
  dismissAll: () => void;
  tooltipPosition: 'left' | 'right';
}

const ChartTooltipContext = createContext<ChartTooltipContextValue | null>(null);

export function ChartTooltipProvider({
  children,
  tooltipPosition = 'right',
}: {
  children: React.ReactNode;
  tooltipPosition?: 'left' | 'right';
}) {
  const registry = useRef<Map<string, DismissFn>>(new Map());

  const registerChart = useCallback((id: string, dismiss: DismissFn) => {
    registry.current.set(id, dismiss);
  }, []);

  const unregisterChart = useCallback((id: string) => {
    registry.current.delete(id);
  }, []);

  const notifyChartActive = useCallback((id: string) => {
    registry.current.forEach((dismiss, chartId) => {
      if (chartId !== id) {
        dismiss();
      }
    });
  }, []);

  const dismissAll = useCallback(() => {
    registry.current.forEach((dismiss) => dismiss());
  }, []);

  return (
    <ChartTooltipContext.Provider
      value={{ registerChart, unregisterChart, notifyChartActive, dismissAll, tooltipPosition }}
    >
      {children}
    </ChartTooltipContext.Provider>
  );
}

export function useChartTooltip() {
  const ctx = useContext(ChartTooltipContext);
  if (!ctx) {
    return {
      registerChart: (_id: string, _dismiss: DismissFn) => {},
      unregisterChart: (_id: string) => {},
      notifyChartActive: (_id: string) => {},
      dismissAll: () => {},
      tooltipPosition: 'right' as const,
    };
  }

  return ctx;
}
