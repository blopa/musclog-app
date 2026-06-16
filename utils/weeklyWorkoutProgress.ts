import { localCalendarDayPlusDays, localDayStartMs } from '@/utils/calendarDate';

export type ScheduledWorkoutTemplate = {
  id: string;
  weekDaysJson?: number[] | null;
};

export type WorkoutScheduleDay = {
  templateId: string;
  dayOfWeek: string;
};

export function getRollingWeeklyWorkoutRange(date: Date = new Date()): {
  startDate: number;
  endDate: number;
} {
  return {
    startDate: localDayStartMs(localCalendarDayPlusDays(date, -6)),
    endDate: localDayStartMs(localCalendarDayPlusDays(date, 1)) - 1,
  };
}

export function countScheduledSessionsPerWeek(
  templates: ScheduledWorkoutTemplate[],
  schedulesForTemplatesMissingWeekDays: WorkoutScheduleDay[]
): number {
  let scheduledSessions = 0;
  const fallbackTemplateIds = new Set<string>();

  for (const template of templates) {
    if (template.weekDaysJson && template.weekDaysJson.length > 0) {
      scheduledSessions += new Set(template.weekDaysJson).size;
    } else {
      fallbackTemplateIds.add(template.id);
    }
  }

  const scheduledDaysByTemplate = new Map<string, Set<string>>();
  for (const schedule of schedulesForTemplatesMissingWeekDays) {
    if (!fallbackTemplateIds.has(schedule.templateId)) {
      continue;
    }

    if (!scheduledDaysByTemplate.has(schedule.templateId)) {
      scheduledDaysByTemplate.set(schedule.templateId, new Set());
    }
    scheduledDaysByTemplate.get(schedule.templateId)!.add(schedule.dayOfWeek);
  }

  for (const days of scheduledDaysByTemplate.values()) {
    scheduledSessions += days.size;
  }

  return scheduledSessions;
}
