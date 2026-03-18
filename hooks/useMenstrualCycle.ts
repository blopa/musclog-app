import { useMenstrualCycleContext, type MenstrualCycleContextType } from '../components/MenstrualCycleContext';

export function useMenstrualCycle(): MenstrualCycleContextType {
  return useMenstrualCycleContext();
}
