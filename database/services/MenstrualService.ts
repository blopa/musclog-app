import MenstrualCycle, { SyncGoal } from '../models/MenstrualCycle';

export type MenstrualPhase = 'menstrual' | 'follicular' | 'ovulation' | 'luteal';
export type EnergyLevel = 'peak' | 'high' | 'moderate' | 'low';

export class MenstrualService {
  /**
   * Calculates the current cycle day (1-indexed)
   */
  static getCycleDay(cycle: MenstrualCycle): number {
    const now = Date.now();
    const lastStart = cycle.lastPeriodStartDate;
    const diffMs = now - lastStart;
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

    // Normalize to cycle length
    return (diffDays % cycle.avgCycleLength) + 1;
  }

  /**
   * Determines the current phase based on cycle day
   */
  static calculateCurrentPhase(cycle: MenstrualCycle): MenstrualPhase {
    const day = this.getCycleDay(cycle);
    const length = cycle.avgCycleLength;
    const duration = cycle.avgPeriodDuration;

    // Menstrual Phase (Day 1 to duration)
    if (day <= duration) {
      return 'menstrual';
    }

    // Ovulation typically occurs 14 days before the next period
    const ovulationDay = length - 14;

    // Follicular Phase (After period, before ovulation)
    if (day < ovulationDay) {
      return 'follicular';
    }

    // Ovulation Window (approx 3 days)
    if (day >= ovulationDay && day <= ovulationDay + 2) {
      return 'ovulation';
    }

    // Luteal Phase (After ovulation, before next period)
    return 'luteal';
  }

  /**
   * Returns the predicted energy level for a given phase
   */
  static getEnergyLevel(phase: MenstrualPhase): EnergyLevel {
    switch (phase) {
      case 'menstrual':
        return 'low';
      case 'follicular':
        return 'high';
      case 'ovulation':
        return 'peak';
      case 'luteal':
        return 'moderate';
      default:
        return 'moderate';
    }
  }

  /**
   * Returns an intensity multiplier for workouts based on phase and user goals
   */
  static getIntensityMultiplier(phase: MenstrualPhase, goal?: SyncGoal): number {
    const multipliers: Record<MenstrualPhase, number> = {
      menstrual: 0.85,
      follicular: 1.0,
      ovulation: 1.1,
      luteal: 0.95,
    };

    let multiplier = multipliers[phase];

    // Adjust based on goal
    if (goal === 'performance') {
      if (phase === 'ovulation') multiplier = 1.15;
      if (phase === 'follicular') multiplier = 1.05;
    } else if (goal === 'symptoms') {
      if (phase === 'menstrual') multiplier = 0.75;
      if (phase === 'luteal') multiplier = 0.9;
    }

    return multiplier;
  }

  /**
   * Gets physiological insights for the current phase
   */
  static getInsights(phase: MenstrualPhase) {
    switch (phase) {
      case 'menstrual':
        return {
          estrogen: 'low',
          progesterone: 'low',
          metabolism: 'stable',
          focus: 'recovery',
        };
      case 'follicular':
        return {
          estrogen: 'rising',
          progesterone: 'low',
          metabolism: 'stable',
          focus: 'strength',
        };
      case 'ovulation':
        return {
          estrogen: 'peak',
          progesterone: 'rising',
          metabolism: 'increasing',
          focus: 'power',
        };
      case 'luteal':
        return {
          estrogen: 'dropping',
          progesterone: 'peak',
          metabolism: 'high',
          focus: 'endurance',
        };
    }
  }
}
