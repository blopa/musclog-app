import {
  type MenstrualCycleContextType,
  useMenstrualCycleContext,
} from '@/components/MenstrualCycleContext';

export function useMenstrualCycle(): MenstrualCycleContextType {
  return useMenstrualCycleContext();
}
