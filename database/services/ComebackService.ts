import { WorkoutTemplateRepository } from '@/database/repositories/WorkoutTemplateRepository';
import { ComebackNutritionService } from '@/database/services/ComebackNutritionService';
import { SettingsService } from '@/database/services/SettingsService';
import { localDayStartMs } from '@/utils/calendarDate';
import type { ComebackNutritionResult } from '@/database/services/ComebackNutritionService';
import type {
  ComebackAnswers,
  ComebackCheckpointWeek,
  ComebackFeel,
  ComebackState,
  ComebackTrack,
} from '@/utils/comeback/comebackState';
import {
  answersUpdatedState,
  checkpointAnsweredState,
  deficitDecidedState,
  dismissedState,
  endedState,
  minimumDayLoggedState,
  minimumDayUndoneState,
  restartedState,
} from '@/utils/comeback/comebackTransitions';

/**
 * The small, tap-sized changes to a running comeback. Starting one is `services/comebackSetup.ts`
 * (it touches gyms, plans and goals); everything here only moves the comeback's own state, through
 * the settings service's serialised read-merge-write so two quick taps can never lose each other.
 */
export class ComebackService {
  /** Whether the person has any workout of their own, i.e. whether "ease into my plan" means something. */
  static async hasWorkouts(): Promise<boolean> {
    return (await WorkoutTemplateRepository.getActive().fetchCount()) > 0;
  }

  /** "I did my minimum today" — a short walk or one proper meal; the person decides what counts. */
  static logMinimumDay(day: number = localDayStartMs(new Date())): Promise<ComebackState> {
    return SettingsService.updateComebackState((current) => minimumDayLoggedState(current, day));
  }

  static undoMinimumDay(day: number = localDayStartMs(new Date())): Promise<ComebackState> {
    return SettingsService.updateComebackState((current) => minimumDayUndoneState(current, day));
  }

  /** "Not now": the offer stays away for this gap and returns after a new one or a month. */
  static dismissOffer(lastActivityAt: number): Promise<ComebackState> {
    return SettingsService.updateComebackState((current) =>
      dismissedState(current, Date.now(), lastActivityAt)
    );
  }

  /** "Restart week 1": day 1 is today; the pre-break baseline does not move. */
  static restartWeekOne(): Promise<ComebackState> {
    return SettingsService.updateComebackState((current) =>
      restartedState(current, localDayStartMs(new Date()))
    );
  }

  /** The person ends it, or acknowledges that the ramp is over. History stays. */
  static end(): Promise<ComebackState> {
    return SettingsService.updateComebackState((current) => endedState(current, Date.now()));
  }

  static answerCheckpoint(
    week: ComebackCheckpointWeek,
    feel: ComebackFeel
  ): Promise<ComebackState> {
    return SettingsService.updateComebackState((current) =>
      checkpointAnsweredState(current, week, feel, Date.now())
    );
  }

  static updateAnswers(patch: {
    track?: ComebackTrack;
    answers: ComebackAnswers;
  }): Promise<ComebackState> {
    return SettingsService.updateComebackState((current) => answersUpdatedState(current, patch));
  }

  /**
   * The week-2 offer, accepted: the small deficit is written through the nutrition service, which
   * first checks the goal still holds what setup wrote. The decision is recorded either way the
   * write ends, so the offer is not repeated; `changedSince` means the person's newer targets stood.
   */
  static async acceptDeficit(): Promise<ComebackNutritionResult> {
    const state = await SettingsService.getComebackState();
    const result = await ComebackNutritionService.apply(state.answers, { applyDeficit: true });
    if (result.status === 'applied' || result.status === 'changedSince') {
      await SettingsService.updateComebackState((current) =>
        deficitDecidedState(current, result.status === 'applied' ? 'accepted' : 'declined')
      );
    }

    return result;
  }

  static declineDeficit(): Promise<ComebackState> {
    return SettingsService.updateComebackState((current) =>
      deficitDecidedState(current, 'declined')
    );
  }
}
