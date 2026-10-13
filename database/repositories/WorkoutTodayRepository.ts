import { Q } from '@nozbe/watermelondb';

import { database } from '@/database/database-instance';
import type Schedule from '@/database/models/Schedule';
import type WorkoutLog from '@/database/models/WorkoutLog';
import type WorkoutTemplate from '@/database/models/WorkoutTemplate';
import { WorkoutPlanService } from '@/database/services/WorkoutPlanService';
import { localDayStartMs } from '@/utils/calendarDate';
import { jsDayToWeekdayIndex } from '@/utils/weekdays';
import { pickRotationSuggestion, ROTATION_LOOKBACK_DAYS } from '@/utils/workoutRotationSuggestion';
import { resolveWorkoutSchedules } from '@/utils/workoutScheduleOwnership';

export type TodayWorkout = {
  template: WorkoutTemplate;
  planId?: string;
  planName?: string;
  /** Due today by a weekly schedule; false for the next workout of a rotating plan. */
  scheduled: boolean;
  /** Already trained today, so the card shows it as done instead of as a to-do. */
  completedToday: boolean;
  /**
   * Set when nothing is scheduled and no rotating plan exists: the recently trained workout rested
   * longest (`pickRotationSuggestion`), with when it was last done as the stated reason.
   */
  lastCompletedAt?: number;
};

export class WorkoutTodayRepository {
  static async upcoming(date: Date = new Date()): Promise<TodayWorkout[]> {
    const [plans, templates, schedules, completedToday] = await Promise.all([
      WorkoutPlanService.getPlansWithMemberships(),
      database
        .get<WorkoutTemplate>('workout_templates')
        .query(Q.where('deleted_at', Q.eq(null)), Q.where('is_archived', false))
        .fetch(),
      database
        .get<Schedule>('schedules')
        .query(Q.where('deleted_at', Q.eq(null)))
        .fetch(),
      database
        .get<WorkoutLog>('workout_logs')
        .query(
          Q.where('completed_at', Q.gte(localDayStartMs(date))),
          Q.where('deleted_at', Q.eq(null))
        )
        .fetch(),
    ]);
    const doneToday = new Set(completedToday.map((log) => log.templateId));
    const planName = new Map(plans.map((item) => [item.plan.id, item.plan.name]));
    const planModels = plans.map((item) => item.plan);
    const memberships = plans.flatMap((item) => item.memberships);
    const resolved = resolveWorkoutSchedules(planModels, memberships, schedules);
    const scheduled = resolved
      .filter((row) => row.dayIndex === jsDayToWeekdayIndex(date.getDay()))
      .flatMap((row) => {
        const template = templates.find((item) => item.id === row.templateId);
        return template
          ? [
              {
                template,
                planId: row.planId,
                planName: row.planId ? planName.get(row.planId) : undefined,
                scheduled: true,
                completedToday: doneToday.has(template.id),
              },
            ]
          : [];
      });
    if (scheduled.length) {
      return scheduled;
    }

    const rotating = await Promise.all(
      plans
        .filter((item) => item.plan.cycleType === 'rotating')
        .map(async (item) => {
          const members = [...item.memberships]
            .sort((a, b) => a.position - b.position)
            .filter((row) => templates.some((template) => template.id === row.templateId));
          if (!members.length) {
            return null;
          }

          const logs = await database
            .get<WorkoutLog>('workout_logs')
            .query(
              Q.where('plan_id', item.plan.id),
              Q.where('completed_at', Q.notEq(null)),
              Q.where('deleted_at', Q.eq(null)),
              Q.sortBy('completed_at', Q.desc),
              Q.take(1)
            )
            .fetch();
          const index = logs[0]
            ? members.findIndex((row) => row.templateId === logs[0].templateId)
            : -1;
          const member = members[(index + 1) % members.length];
          return {
            template: templates.find((row) => row.id === member.templateId)!,
            planId: item.plan.id,
            planName: item.plan.name,
            scheduled: false,
            completedToday: false,
          };
        })
    );
    const fromPlans = rotating.filter((row): row is NonNullable<typeof row> => row !== null);
    if (fromPlans.length) {
      return fromPlans;
    }

    return WorkoutTodayRepository.fromHistory(templates, completedToday, date);
  }

  /** No schedule and no rotating plan: what was done today, else the next workout of the user's de-facto split. */
  private static async fromHistory(
    templates: WorkoutTemplate[],
    completedToday: WorkoutLog[],
    date: Date
  ): Promise<TodayWorkout[]> {
    const byId = new Map(templates.map((template) => [template.id, template]));
    const doneToday = [...new Set(completedToday.map((log) => log.templateId))].flatMap((id) => {
      const template = id ? byId.get(id) : undefined;
      return template ? [{ template, scheduled: false, completedToday: true }] : [];
    });
    if (doneToday.length) {
      return doneToday;
    }

    const todayStart = localDayStartMs(date);
    const recent = await database
      .get<WorkoutLog>('workout_logs')
      .query(
        Q.where('completed_at', Q.gte(todayStart - ROTATION_LOOKBACK_DAYS * 24 * 60 * 60 * 1000)),
        Q.where('deleted_at', Q.eq(null))
      )
      .fetch();
    const pick = pickRotationSuggestion(recent, new Set(byId.keys()), todayStart);
    const template = pick ? byId.get(pick.templateId) : undefined;
    return template && pick
      ? [
          {
            template,
            scheduled: false,
            completedToday: false,
            lastCompletedAt: pick.lastCompletedAt,
          },
        ]
      : [];
  }
}
