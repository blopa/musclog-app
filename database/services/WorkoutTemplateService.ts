import { type Model, Q } from '@nozbe/watermelondb';
import convert from 'convert';
import { Dumbbell, type LucideIcon, User } from 'lucide-react-native';
import type { ComponentType } from 'react';

import { DEFAULT_WORKOUT_TYPE } from '@/constants/workoutTypes';
import type { RawWorkoutTemplate, RawWorkoutTemplateExercise } from '@/data/workoutTemplates';
import { database } from '@/database/database-instance';
import Exercise from '@/database/models/Exercise';
import Schedule from '@/database/models/Schedule';
import WorkoutLog from '@/database/models/WorkoutLog';
import WorkoutLogExercise from '@/database/models/WorkoutLogExercise';
import WorkoutLogSet from '@/database/models/WorkoutLogSet';
import type WorkoutPlan from '@/database/models/WorkoutPlan';
import WorkoutTemplate from '@/database/models/WorkoutTemplate';
import WorkoutTemplateExercise from '@/database/models/WorkoutTemplateExercise';
import WorkoutTemplateSet from '@/database/models/WorkoutTemplateSet';
import { WorkoutTemplateRepository } from '@/database/repositories/WorkoutTemplateRepository';
import i18n from '@/lang/lang';
import { getTheme } from '@/theme';
import { handleError } from '@/utils/handleError';
import { getWeightUnit } from '@/utils/units';
import { indexToDayName, WEEKDAY_NAMES } from '@/utils/weekdays';
import { parseWorkoutInsightsType } from '@/utils/workoutInsightsType';

import {
  DatabaseRepairService,
  REPAIR_DESCRIPTORS,
  retryAfterRepair,
} from './DatabaseRepairService';
import { SettingsService } from './SettingsService';
import { UserMetricService } from './UserMetricService';
import { UserService } from './UserService';
import { type CreateWorkoutPlanData, WorkoutPlanService } from './WorkoutPlanService';

/**
 * Exercise data for workout template creation/editing.
 * Combines Exercise model fields with WorkoutTemplateExercise and WorkoutTemplateSet data.
 */
export type ExerciseInWorkout = Pick<Exercise, 'id'> & {
  label: string;
  description: string;
  icon: LucideIcon | ComponentType<{ size: number; color: string }>;
  iconBgColor: string;
  iconColor: string;
  groupId?: string;
  notes?: string;
  sets: number;
  reps: number;
  weight: number;
  isBodyweight: boolean;
  restTimeAfter?: number;
  setType?: string;
};

export interface SaveTemplateData {
  templateId?: string;
  name: string;
  description?: string;
  workoutInsightsType?: string;
  type?: string;
  icon?: string;
  exercises: ExerciseInWorkout[];
  selectedDays: number[];
  /**
   * Replacement plan membership. undefined leaves memberships untouched; [] moves the template
   * to Unplanned. Never default this field to an empty array.
   */
  planIds?: string[];
}

export interface PlanTemplateInput {
  template: SaveTemplateData;
  weekDays?: number[];
  position?: number;
}

export class WorkoutTemplateService {
  /**
   * Get template with all details (exercises, sets, and schedule)
   */
  static async getTemplateWithDetails(templateId: string): Promise<{
    template: WorkoutTemplate;
    templateExercises: WorkoutTemplateExercise[];
    sets: WorkoutTemplateSet[];
    schedule: Schedule[];
  }> {
    return this.getTemplateWithDetailsInternal(templateId);
  }

  private static async getTemplateWithDetailsInternal(
    templateId: string,
    repairAttempted = false
  ): Promise<{
    template: WorkoutTemplate;
    templateExercises: WorkoutTemplateExercise[];
    sets: WorkoutTemplateSet[];
    schedule: Schedule[];
  }> {
    try {
      const template = await database.get<WorkoutTemplate>('workout_templates').find(templateId);

      const templateExercises = await database
        .get<WorkoutTemplateExercise>('workout_template_exercises')
        .query(
          Q.where('template_id', templateId),
          Q.where('deleted_at', Q.eq(null)),
          Q.sortBy('exercise_order', Q.asc)
        )
        .fetch();

      const templateExerciseIds = templateExercises.map((te) => te.id);
      const sets =
        templateExerciseIds.length > 0
          ? await database
              .get<WorkoutTemplateSet>('workout_template_sets')
              .query(
                Q.where('template_exercise_id', Q.oneOf(templateExerciseIds)),
                Q.where('deleted_at', Q.eq(null)),
                Q.sortBy('set_order', Q.asc)
              )
              .fetch()
          : [];

      const schedule = await database
        .get<Schedule>('schedules')
        .query(Q.where('template_id', templateId), Q.where('deleted_at', Q.eq(null)))
        .fetch();

      return { template, templateExercises, sets, schedule };
    } catch (error) {
      if (!repairAttempted) {
        const repaired = await retryAfterRepair(error, REPAIR_DESCRIPTORS.workoutTemplates, () =>
          this.getTemplateWithDetailsInternal(templateId, true)
        );

        if (repaired) {
          return repaired;
        }
      }
      throw error;
    }
  }

  /**
   * Get a template by exact name (for AI context: upcoming workout details).
   * Returns null if not found or multiple exist (first match by created_at asc).
   */
  static async getTemplateByName(name: string): Promise<WorkoutTemplate | null> {
    const templates = await database
      .get<WorkoutTemplate>('workout_templates')
      .query(Q.where('name', name), Q.where('deleted_at', Q.eq(null)), Q.take(1))
      .fetch();
    return templates[0] ?? null;
  }

  /**
   * Convert template exercises and sets to ExerciseInWorkout array
   */
  static async convertTemplateExercisesToUI(
    templateExercises: WorkoutTemplateExercise[],
    sets: WorkoutTemplateSet[]
  ): Promise<ExerciseInWorkout[]> {
    const theme = await getTheme();
    if (templateExercises.length === 0) {
      return [];
    }

    const exerciseIds = [...new Set(templateExercises.map((te) => te.exerciseId))];

    const exercises = await database
      .get<Exercise>('exercises')
      .query(
        Q.where('id', Q.oneOf(exerciseIds.filter((id) => id !== undefined))),
        Q.where('deleted_at', Q.eq(null))
      )
      .fetch();

    const exerciseMap = new Map<string, Exercise>();
    exercises.forEach((ex) => exerciseMap.set(ex.id, ex));

    const setsByTemplateExercise = new Map<string, WorkoutTemplateSet[]>();
    sets.forEach((set) => {
      const teId = set.templateExerciseId;
      if (!setsByTemplateExercise.has(teId)) {
        setsByTemplateExercise.set(teId, []);
      }
      setsByTemplateExercise.get(teId)!.push(set);
    });

    const exercisesInWorkout: ExerciseInWorkout[] = [];

    for (const templateExercise of templateExercises) {
      const exercise = exerciseMap.get(templateExercise.exerciseId);
      if (!exercise) {
        continue;
      }

      const exerciseSets = setsByTemplateExercise.get(templateExercise.id) ?? [];
      const firstSet = exerciseSets[0];
      const setsCount = exerciseSets.length;

      const equipmentType = exercise.equipmentType?.toLowerCase() || '';
      const bodyweightTranslation = i18n.t('exercises.equipmentTypes.bodyweight').toLowerCase();
      const isBodyweight =
        equipmentType.includes('bodyweight') || equipmentType.includes(bodyweightTranslation);

      const Icon = isBodyweight ? User : Dumbbell;
      const iconBgColor = isBodyweight
        ? theme.colors.background.white5
        : theme.colors.accent.primary10;
      const iconColor = isBodyweight ? theme.colors.text.secondary : theme.colors.accent.primary;

      const description = firstSet
        ? i18n.t('workouts.addExercise.exerciseDescription', {
            sets: setsCount,
            reps: firstSet.targetReps,
          })
        : i18n.t('workouts.browseTemplatesModal.stats.setsQty', { count: setsCount });

      exercisesInWorkout.push({
        id: exercise.id,
        label: exercise.name ?? '',
        description,
        icon: Icon,
        iconBgColor,
        iconColor,
        groupId: templateExercise.groupId,
        notes: templateExercise.notes,
        sets: setsCount || 1,
        reps: firstSet?.targetReps ?? 0,
        weight: firstSet?.targetWeight ?? 0,
        isBodyweight,
        restTimeAfter: firstSet?.restTimeAfter,
        setType: exerciseSets[0]?.setType ?? 'normal',
      });
    }

    return exercisesInWorkout;
  }

  /**
   * Save or update workout template
   */
  static async saveTemplate(data: SaveTemplateData): Promise<WorkoutTemplate> {
    const now = Date.now();

    return database.write(() => this.saveTemplateInWriter(data, now));
  }

  /**
   * The exercise and set rows for one template, as unsaved prepared creates.
   *
   * Set order runs across the whole template rather than restarting per exercise, which is what
   * `set_order` means everywhere else in the app.
   */
  private static prepareTemplateExerciseGraph(
    templateId: string,
    exercises: ExerciseInWorkout[],
    now: number
  ): Model[] {
    const exerciseCollection = database.get<WorkoutTemplateExercise>('workout_template_exercises');
    const setCollection = database.get<WorkoutTemplateSet>('workout_template_sets');
    const records: Model[] = [];
    let setOrder = 0;

    exercises.forEach((exercise, exerciseIndex) => {
      const templateExercise = exerciseCollection.prepareCreate((te) => {
        te.templateId = templateId;
        te.exerciseId = exercise.id;
        te.notes = exercise.notes;
        te.exerciseOrder = exerciseIndex + 1;
        te.groupId = exercise.groupId;
        te.createdAt = now;
        te.updatedAt = now;
      });
      records.push(templateExercise);

      for (let setNumber = 1; setNumber <= exercise.sets; setNumber++) {
        setOrder++;
        const currentSetOrder = setOrder;
        records.push(
          setCollection.prepareCreate((ts) => {
            ts.templateExerciseId = templateExercise.id;
            ts.targetReps = exercise.reps;
            ts.targetWeight = exercise.isBodyweight ? 0 : exercise.weight;
            ts.restTimeAfter = exercise.restTimeAfter ?? 60;
            ts.setOrder = currentSetOrder;
            ts.setType = exercise.setType ?? 'normal';
            ts.createdAt = now;
            ts.updatedAt = now;
          })
        );
      }
    });

    return records;
  }

  /**
   * A brand-new template and its whole graph, prepared and unsaved. Pure — no reads, no writes —
   * so a caller building several templates can commit all of them in one batch.
   */
  private static prepareNewTemplate(
    data: SaveTemplateData,
    now: number
  ): { template: WorkoutTemplate; records: Model[] } {
    const template = database.get<WorkoutTemplate>('workout_templates').prepareCreate((t) => {
      t.name = data.name;
      t.description = data.description || undefined;
      t.workoutInsightsType = parseWorkoutInsightsType(data.workoutInsightsType);
      t.type = data.type ?? DEFAULT_WORKOUT_TYPE;
      t.icon = data.icon ?? undefined;
      t.weekDaysJson = undefined;
      t.isArchived = false;
      t.createdAt = now;
      t.updatedAt = now;
    });

    return {
      template,
      records: [template, ...this.prepareTemplateExerciseGraph(template.id, data.exercises, now)],
    };
  }

  /** Standalone weekday rows for a template that owns its own calendar. */
  private static prepareSchedules(templateId: string, days: number[], now: number): Model[] {
    const collection = database.get<Schedule>('schedules');
    return days
      .filter((dayIndex) => dayIndex >= 0 && dayIndex < WEEKDAY_NAMES.length)
      .map((dayIndex) =>
        collection.prepareCreate((s) => {
          s.templateId = templateId;
          s.dayOfWeek = indexToDayName(dayIndex);
          s.createdAt = now;
          s.updatedAt = now;
        })
      );
  }

  /**
   * Every record a save implies, prepared but uncommitted, plus the template it targets.
   *
   * Reads first, then a single pure prepare pass. `database.write()` serialises writers but does
   * NOT roll back a batch that already landed, so anything committed before a later step throws
   * stays committed — the reason this returns records instead of writing them itself.
   */
  private static async prepareSaveTemplate(
    data: SaveTemplateData,
    now: number
  ): Promise<{ template: WorkoutTemplate; records: Model[] }> {
    if (!data.templateId) {
      const created = this.prepareNewTemplate(data, now);
      // Nothing exists to conflict with a brand-new template, so membership and schedules are the
      // only remaining question and `activePlanIds` decides it exactly as in the edit path — which
      // is why this is written the same way, rather than as a ternary whose empty arm needs casts
      // to line up with the call's return type.
      let activePlanIds: string[] = [];
      let membershipRecords: Model[] = [];

      if (data.planIds?.length) {
        ({ activePlanIds, records: membershipRecords } =
          await WorkoutPlanService.prepareSyncTemplateMemberships(
            created.template.id,
            data.planIds,
            now
          ));
      }

      return {
        template: created.template,
        records: [
          ...created.records,
          ...membershipRecords,
          ...(activePlanIds.length === 0
            ? this.prepareSchedules(created.template.id, data.selectedDays, now)
            : []),
        ],
      };
    }

    const templateId = data.templateId;
    const template = await database.get<WorkoutTemplate>('workout_templates').find(templateId);
    const existingExercises = await database
      .get<WorkoutTemplateExercise>('workout_template_exercises')
      .query(Q.where('template_id', templateId), Q.where('deleted_at', Q.eq(null)))
      .fetch();
    const existingExerciseIds = existingExercises.map((te) => te.id);
    const [existingSets, existingSchedules] = await Promise.all([
      existingExerciseIds.length > 0
        ? database
            .get<WorkoutTemplateSet>('workout_template_sets')
            .query(
              Q.where('template_exercise_id', Q.oneOf(existingExerciseIds)),
              Q.where('deleted_at', Q.eq(null))
            )
            .fetch()
        : Promise.resolve([]),
      database
        .get<Schedule>('schedules')
        .query(Q.where('template_id', templateId), Q.where('deleted_at', Q.eq(null)))
        .fetch(),
    ]);

    // Resolve plan membership BEFORE deciding schedules: calendar ownership depends on the
    // outcome. A template with at least one active membership takes its weekdays from that
    // membership, so writing standalone `schedules` for it too would leave two live calendar
    // stores for one workout — dormant rows that silently resurrect if it later leaves the plan.
    let membershipRecords: Model[] = [];
    let activePlanIds: string[] = [];

    if (data.planIds !== undefined) {
      ({ activePlanIds, records: membershipRecords } =
        await WorkoutPlanService.prepareSyncTemplateMemberships(templateId, data.planIds, now));
    } else if (data.selectedDays.length > 0) {
      // planIds omitted means "leave memberships alone", so read the current set. Only worth a
      // query when there are days that would otherwise be written.
      activePlanIds = await WorkoutPlanService.getActivePlanIdsForTemplate(templateId);
    }

    const softDelete = <T extends Model & { deletedAt?: number; updatedAt: number }>(record: T) =>
      record.prepareUpdate((draft) => {
        draft.deletedAt = now;
        draft.updatedAt = now;
      });

    return {
      template,
      records: [
        template.prepareUpdate((t) => {
          t.name = data.name;
          t.description = data.description || undefined;
          t.workoutInsightsType =
            data.workoutInsightsType != null
              ? parseWorkoutInsightsType(data.workoutInsightsType)
              : parseWorkoutInsightsType(t.workoutInsightsType);
          t.type = data.type ?? t.type;
          t.icon = data.icon ?? t.icon;
          // Standalone calendar data lives in schedules. Clear any deprecated compatibility copy.
          t.weekDaysJson = undefined;
          t.updatedAt = now;
        }),
        ...existingSets.map(softDelete),
        ...existingExercises.map(softDelete),
        ...existingSchedules.map(softDelete),
        ...this.prepareTemplateExerciseGraph(templateId, data.exercises, now),
        ...membershipRecords,
        ...(activePlanIds.length === 0
          ? this.prepareSchedules(templateId, data.selectedDays, now)
          : []),
      ],
    };
  }

  private static async saveTemplateInWriter(
    data: SaveTemplateData,
    now: number
  ): Promise<WorkoutTemplate> {
    const { records, template } = await this.prepareSaveTemplate(data, now);
    await database.batch(...records);
    return template;
  }

  /**
   * Creates a plan and all of its workouts as ONE batch.
   *
   * The whole graph is prepared before anything is written, because a WatermelonDB writer
   * serialises work but does not roll it back: committing template by template and then failing on
   * the plan would leave orphaned workouts, exercises and sets behind with no plan to reach them.
   */
  static async createPlanWithTemplates(
    planData: Omit<CreateWorkoutPlanData, 'memberships'>,
    inputs: PlanTemplateInput[]
  ): Promise<{ plan: WorkoutPlan; templates: WorkoutTemplate[] }> {
    if (inputs.length === 0) {
      throw new Error('A workout plan requires at least one template');
    }

    return database.write(async () => {
      const now = Date.now();
      const prepared = inputs.map((input) => this.prepareNewTemplate(input.template, now));
      const { plan, records: planRecords } = await WorkoutPlanService.prepareCreatePlan(
        {
          ...planData,
          memberships: prepared.map(({ template }, index) => ({
            templateId: template.id,
            weekDays: inputs[index].weekDays,
            position: inputs[index].position ?? index,
          })),
        },
        now
      );

      await database.batch(...prepared.flatMap(({ records }) => records), ...planRecords);

      return { plan, templates: prepared.map(({ template }) => template) };
    });
  }

  /**
   * Get all active workout templates with metadata (exercise count, last completed, etc.)
   */
  static async getAllTemplatesWithMetadata(scope: 'active' | 'archived' = 'active'): Promise<
    {
      id: string;
      name: string;
      description?: string;
      type?: string;
      icon?: string;
      exerciseCount: number;
      lastCompleted?: string; // Formatted relative date string
      lastCompletedTimestamp?: number;
      duration?: string; // Formatted duration string
      image?: any;
    }[]
  > {
    // Fetch templates based on scope
    const templates =
      scope === 'archived'
        ? await WorkoutTemplateRepository.getArchived().fetch()
        : await WorkoutTemplateRepository.getActive().fetch();

    // Process each template to get metadata
    const templatesWithMetadata = await Promise.all(
      templates.map((template) => this.processTemplateMetadata(template))
    );

    // Sort by last completed (most recent first), then by creation date
    templatesWithMetadata.sort((a, b) => {
      // If one has lastCompleted and other doesn't, prioritize the one with lastCompleted
      if (a.lastCompletedTimestamp && !b.lastCompletedTimestamp) {
        return -1;
      }
      if (!a.lastCompletedTimestamp && b.lastCompletedTimestamp) {
        return 1;
      }
      // If both have lastCompleted, sort by timestamp (most recent first)
      if (a.lastCompletedTimestamp && b.lastCompletedTimestamp) {
        return b.lastCompletedTimestamp - a.lastCompletedTimestamp;
      }
      // If neither has lastCompleted, maintain original order (by created_at desc)
      return 0;
    });

    return templatesWithMetadata;
  }

  /**
   * Helper function to process a single template and get its metadata
   */
  private static async processTemplateMetadata(template: WorkoutTemplate): Promise<{
    id: string;
    name: string;
    description?: string;
    type?: string;
    icon?: string;
    exerciseCount: number;
    lastCompleted?: string;
    lastCompletedTimestamp?: number;
    duration?: string;
    image?: any;
  }> {
    const templateExercises = (await template.templateExercises?.fetch()) ?? [];
    const exerciseCount = templateExercises.filter((te) => !te.deletedAt).length;

    // Get last completed workout log for this template
    const workoutLogs = await database
      .get<WorkoutLog>('workout_logs')
      .query(
        Q.where('template_id', template.id),
        Q.where('completed_at', Q.notEq(null)),
        Q.where('deleted_at', Q.eq(null)),
        Q.sortBy('completed_at', Q.desc),
        Q.take(1)
      )
      .fetch();

    let lastCompleted: string | undefined;
    let lastCompletedTimestamp: number | undefined;
    let duration: string | undefined;

    if (workoutLogs.length > 0) {
      const lastLog = workoutLogs[0];
      lastCompletedTimestamp = lastLog.completedAt || undefined;

      if (lastCompletedTimestamp) {
        // Format relative date
        const date = new Date(lastCompletedTimestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
          lastCompleted = i18n.t('common.today');
        } else if (diffDays === 1) {
          lastCompleted = i18n.t('common.yesterday');
        } else if (diffDays < 7) {
          lastCompleted = i18n.t('common.daysAgo', { count: diffDays });
        } else if (diffDays < 14) {
          lastCompleted = i18n.t('common.oneWeekAgo');
        } else if (diffDays < 30) {
          const weeks = Math.floor(diffDays / 7);
          // When diffDays >= 14, weeks >= 2, so always plural
          lastCompleted = i18n.t('common.weeksAgo', { count: weeks });
        } else {
          const months = Math.floor(diffDays / 30);
          lastCompleted = i18n.t('common.monthsAgo', { count: months });
        }

        // Calculate duration if available
        if (lastLog.startedAt && lastLog.completedAt) {
          const durationMinutes = Math.round((lastLog.completedAt - lastLog.startedAt) / 60000);
          if (durationMinutes < 60) {
            duration = i18n.t('common.duration.minutesShort', { minutes: durationMinutes });
          } else {
            const hours = Math.floor(durationMinutes / 60);
            const mins = durationMinutes % 60;
            duration =
              mins > 0
                ? i18n.t('common.duration.hoursMinutes', { hours, minutes: mins })
                : i18n.t('common.duration.hoursOnly', { hours });
          }
        }
      }
    }

    return {
      id: template.id,
      name: template.name ?? '',
      description: template.description || undefined,
      type: template.type ?? undefined,
      icon: template.icon ?? undefined,
      exerciseCount,
      lastCompleted,
      lastCompletedTimestamp,
      duration,
      image: require('../../assets/icon.png'), // Default image for now
    };
  }

  /**
   * Get workout templates with pagination (for Manage Workout Template Data modal).
   * Active templates only, ordered by created_at desc.
   */
  static async getWorkoutTemplatesPaginated(
    limit: number,
    offset: number
  ): Promise<WorkoutTemplate[]> {
    let query = WorkoutTemplateRepository.getActive();
    if (limit > 0) {
      if (offset > 0) {
        query = query.extend(Q.skip(offset), Q.take(limit));
      } else {
        query = query.extend(Q.take(limit));
      }
    }
    return await query.fetch();
  }

  /**
   * Get templates with metadata and pagination support
   */
  static async getTemplatesWithMetadataPaginated(
    limit?: number,
    offset?: number,
    scope: 'active' | 'archived' = 'active'
  ): Promise<
    {
      id: string;
      name: string;
      description?: string;
      type?: string;
      icon?: string;
      exerciseCount: number;
      lastCompleted?: string;
      lastCompletedTimestamp?: number;
      duration?: string;
      image?: any;
    }[]
  > {
    // Fetch templates with pagination based on scope
    let query =
      scope === 'archived'
        ? WorkoutTemplateRepository.getArchived()
        : WorkoutTemplateRepository.getActive();

    if (limit) {
      if (offset !== undefined && offset !== null && offset > 0) {
        // Apply both skip and take together - skip must come before take
        query = query.extend(Q.skip(offset), Q.take(limit));
      } else {
        query = query.extend(Q.take(limit));
      }
    }

    const templates = await query.fetch();

    // Process each template to get metadata
    const templatesWithMetadata = await Promise.all(
      templates.map((template) => this.processTemplateMetadata(template))
    );

    // Sort by last completed (most recent first), then by creation date
    templatesWithMetadata.sort((a, b) => {
      // If one has lastCompleted and other doesn't, prioritize the one with lastCompleted
      if (a.lastCompletedTimestamp && !b.lastCompletedTimestamp) {
        return -1;
      }
      if (!a.lastCompletedTimestamp && b.lastCompletedTimestamp) {
        return 1;
      }
      // If both have lastCompleted, sort by timestamp (most recent first)
      if (a.lastCompletedTimestamp && b.lastCompletedTimestamp) {
        return b.lastCompletedTimestamp - a.lastCompletedTimestamp;
      }
      // If neither has lastCompleted, maintain original order (by created_at desc)
      return 0;
    });

    return templatesWithMetadata;
  }

  /**
   * Calculate suggested weight for an exercise based on user profile and exercise characteristics
   *
   * Formula based on strength standards research:
   * - Uses bodyweight multipliers from established strength standards (ExRx.net, Strength Level)
   * - Experience factors derived from strength standards ratios:
   *   - Beginner: ~40% of intermediate capacity (based on strength standards showing beginners lift ~0.5x BW vs intermediate ~1.25x BW for bench)
   *   - Intermediate: 100% (baseline)
   *   - Advanced: ~140% of intermediate capacity (based on advanced lifters achieving ~1.75x BW vs intermediate ~1.25x BW)
   * - Age factors: Conservative reduction for older adults, though research shows resistance training remains effective
   *
   * References:
   * - Strength Standards: https://exrx.net/WorkoutTools/StrengthStandards
   * - Bodyweight multipliers vary by exercise and experience level
   *
   * Note: Weight is always stored in kg in the database. If user prefers pounds, we convert to lbs,
   * round to nearest integer, then convert back to kg to ensure clean integer values in the user's preferred unit.
   */
  private static async calculateSuggestedWeight(
    userWeightKg: number,
    loadMultiplier: number,
    liftingExperience: string,
    age: number,
    isBodyweight: boolean
  ): Promise<number> {
    // Bodyweight exercises always return 0
    if (isBodyweight || loadMultiplier === 0) {
      return 0;
    }

    // Experience factor based on strength standards research
    // Strength standards show: Beginner ~0.5x BW, Intermediate ~1.25x BW, Advanced ~1.75x BW (for bench press)
    // Normalized to intermediate as baseline (1.0):
    let experienceFactor: number;
    switch (liftingExperience) {
      case 'beginner':
        // Beginner lifts ~40% of intermediate capacity (0.5/1.25 = 0.4)
        // Using 0.4 for conservative starting point
        experienceFactor = 0.4;
        break;
      case 'intermediate':
        // Intermediate is the baseline (100%)
        experienceFactor = 1.0;
        break;
      case 'advanced':
        // Advanced lifts ~140% of intermediate capacity (1.75/1.25 = 1.4)
        experienceFactor = 1.4;
        break;
      default:
        // Unknown experience level, default to intermediate
        experienceFactor = 1.0;
    }

    // Age factor: Conservative reduction for older users
    // Research shows resistance training remains effective for older adults, but we apply
    // slight reduction for safety and recovery considerations
    let ageFactor: number;
    if (age < 35) {
      ageFactor = 1.0; // No reduction for younger adults
    } else if (age < 50) {
      ageFactor = 0.95; // 5% reduction for middle-aged adults
    } else if (age < 65) {
      ageFactor = 0.9; // 10% reduction for older adults
    } else {
      ageFactor = 0.85; // 15% reduction for seniors (still effective per research)
    }

    // Calculate suggested weight: userWeight × loadMultiplier × experienceFactor × ageFactor
    // The loadMultiplier represents the typical bodyweight multiplier for the exercise at intermediate level
    // We then adjust based on experience and age
    const suggestedWeightKg = userWeightKg * loadMultiplier * experienceFactor * ageFactor;

    return await this.roundWeight(suggestedWeightKg);
  }

  /**
   * Round weight to nearest integer in the user's preferred unit.
   */
  private static async roundWeight(weightKg: number): Promise<number> {
    const units = await SettingsService.getUnits();
    const weightUnit = getWeightUnit(units);

    if (weightUnit === 'lbs') {
      const weightLbs = convert(weightKg, 'kg').to('lb');
      const roundedWeightLbs = Math.round(weightLbs);
      return convert(roundedWeightLbs, 'lb').to('kg') as number;
    } else {
      return Math.round(weightKg);
    }
  }

  /**
   * Get suggested weight (kg) and reps for an exercise when adding to a session.
   * Logic:
   * 1. Check user history for this specific exercise (most recent logged set).
   * 2. If no history, fall back to profile-based calculation.
   * Reps: compound → 10, isolation/machine/etc → 14.
   */
  static async getSuggestedWeightAndRepsForExercise(
    exerciseId: string
  ): Promise<{ weightKg: number; reps: number }> {
    const defaultReps = 10;
    const defaultRepsIsolation = 14;

    let exercise: Exercise | null = null;
    try {
      exercise = await database.get<Exercise>('exercises').find(exerciseId);
    } catch {
      return { weightKg: 0, reps: defaultReps };
    }

    // 1. Try to get from history with Smart Double Progression
    try {
      const logExercises = await database
        .get<WorkoutLogExercise>('workout_log_exercises')
        .query(
          Q.where('exercise_id', exerciseId),
          Q.where('deleted_at', Q.eq(null)),
          Q.sortBy('created_at', Q.desc),
          Q.take(1)
        )
        .fetch();

      if (logExercises.length > 0) {
        const lastSets = await database
          .get<WorkoutLogSet>('workout_log_sets')
          .query(
            Q.where('log_exercise_id', logExercises[0].id),
            Q.where('deleted_at', Q.eq(null)),
            Q.where('difficulty_level', Q.gt(0)),
            Q.sortBy('set_order', Q.asc)
          )
          .fetch();

        if (lastSets.length > 0) {
          const mode = await SettingsService.getProgressionMode();
          const units = await SettingsService.getUnits();
          const weightUnit = getWeightUnit(units);

          const avgRir =
            lastSets.reduce((sum, s) => sum + (s.repsInReserve ?? 0), 0) / lastSets.length;
          const lastWeight = lastSets[0].weight;
          const lastReps = lastSets[0].reps;

          // Increment: 2.5kg or 5lbs
          let incrementKg = 2.5;
          if (weightUnit === 'lbs') {
            incrementKg = convert(5, 'lb').to('kg') as number;
          }

          if (avgRir >= 3) {
            if (mode === 'weight_first') {
              const newWeight = await this.roundWeight(lastWeight + incrementKg);
              return { weightKg: newWeight, reps: lastReps };
            } else {
              // reps_first
              const isCompound = exercise.mechanicType === 'compound';
              const baseReps = isCompound ? defaultReps : defaultRepsIsolation;
              const maxReps = baseReps + 2;
              const minReps = baseReps - 2;

              if (lastReps < maxReps) {
                return { weightKg: lastWeight, reps: lastReps + 1 };
              } else {
                const newWeight = await this.roundWeight(lastWeight + incrementKg);
                return { weightKg: newWeight, reps: minReps };
              }
            }
          } else if (avgRir === 0) {
            const newWeight = await this.roundWeight(Math.max(0, lastWeight - incrementKg));
            return { weightKg: newWeight, reps: lastReps };
          }

          return {
            weightKg: lastWeight,
            reps: lastReps,
          };
        }
      }
    } catch (err) {
      console.warn('Failed to fetch suggested weight from history:', err);
      handleError(err, 'WorkoutTemplateService.getSuggestedWeight');
    }

    // 2. Fallback to profile-based calculation
    const user = await UserService.getCurrentUser();
    const weightMetric = await UserMetricService.getLatest('weight');

    let userWeightKg = 70;
    if (weightMetric) {
      const decrypted = await weightMetric.getDecrypted();
      userWeightKg = decrypted.value;
      if (decrypted.unit === 'lbs') {
        userWeightKg = convert(decrypted.value, 'lb').to('kg') as number;
      }
    }

    const liftingExperience = user?.liftingExperience || 'intermediate';
    const age = user ? user.getAge() : 30;
    const equipmentType = exercise.equipmentType?.toLowerCase() || '';
    const isBodyweight =
      equipmentType.includes('bodyweight') || equipmentType.includes('body weight');
    const loadMultiplier = exercise.loadMultiplier ?? 1.0;

    const weightKg = await this.calculateSuggestedWeight(
      userWeightKg,
      loadMultiplier,
      liftingExperience,
      age,
      isBodyweight
    );

    const reps = exercise.mechanicType === 'compound' ? defaultReps : defaultRepsIsolation;

    return { weightKg, reps };
  }

  /**
   * Create workout templates from a JSON template, splitting by day
   * Each day becomes a separate workout template
   */
  static async createWorkoutsFromJsonTemplate(
    rawTemplate: RawWorkoutTemplate
  ): Promise<{ plan: WorkoutPlan | null; templates: WorkoutTemplate[] }> {
    const theme = await getTheme();
    // Validate that exercises is an array
    if (!Array.isArray(rawTemplate.exercises)) {
      throw new Error('Template exercises must be an array');
    }

    const exercises = rawTemplate.exercises.filter(
      (
        e
      ): e is RawWorkoutTemplateExercise & {
        exerciseId: number;
        day: number;
        sets: number;
        reps: number;
      } =>
        typeof e === 'object' &&
        e !== null &&
        typeof e.exerciseId === 'number' &&
        typeof e.day === 'number' &&
        typeof e.sets === 'number' &&
        typeof e.reps === 'number'
    );

    if (exercises.length === 0) {
      throw new Error('Template has no valid exercises');
    }

    // Fetch user context for weight calculation
    const user = await UserService.getCurrentUser();
    const weightMetric = await UserMetricService.getLatest('weight');

    // Convert user weight to kg (default to 70 kg if not available)
    let userWeightKg = 70; // Default fallback
    if (weightMetric) {
      const decrypted = await weightMetric.getDecrypted();
      userWeightKg = decrypted.value;
      if (decrypted.unit === 'lbs') {
        userWeightKg = convert(decrypted.value, 'lb').to('kg') as number;
      }
    }

    // Get user lifting experience (default to 'intermediate' if not available)
    const liftingExperience = user?.liftingExperience || 'intermediate';

    // Get user age (default to 30 if not available, which gives ageFactor 1.0)
    const age = user ? user.getAge() : 30;

    // App exercise order_index is the stable, zero-based counterpart of exerciseId in the JSON.
    // Fall back to creation order only for legacy databases that have not completed the backfill.
    const allExercises = await database
      .get<Exercise>('exercises')
      .query(Q.where('deleted_at', Q.eq(null)), Q.sortBy('created_at', Q.asc))
      .fetch();

    // Create mapping: exerciseId (1-based) -> database exercise ID
    const exerciseIdMap = new Map<number, string>();
    const indexedExercises = allExercises.filter(
      (exercise) => exercise.orderIndex !== null && exercise.orderIndex !== undefined
    );

    if (indexedExercises.length > 0) {
      indexedExercises.forEach((exercise) => {
        exerciseIdMap.set((exercise.orderIndex ?? 0) + 1, exercise.id);
      });
    } else {
      allExercises.forEach((exercise, index) => {
        exerciseIdMap.set(index + 1, exercise.id);
      });
    }

    // Group exercises by day
    const exercisesByDay = new Map<number, typeof exercises>();
    exercises.forEach((exercise) => {
      const day = exercise.day;
      if (!exercisesByDay.has(day)) {
        exercisesByDay.set(day, []);
      }
      exercisesByDay.get(day)!.push(exercise);
    });

    // Get unique days and sort them
    const days = Array.from(exercisesByDay.keys()).sort((a, b) => a - b);

    const planTemplates: PlanTemplateInput[] = [];

    for (const day of days) {
      const dayExercises = exercisesByDay.get(day)!;

      // Group exercises by exerciseId (in case same exercise appears multiple times)
      // We'll combine them into a single exercise entry with the sets/reps from the first occurrence
      const exerciseMap = new Map<number, (typeof exercises)[0]>();
      dayExercises.forEach((exercise) => {
        if (!exerciseMap.has(exercise.exerciseId)) {
          exerciseMap.set(exercise.exerciseId, exercise);
        }
      });

      // Convert to ExerciseInWorkout format
      const exercisesInWorkout: ExerciseInWorkout[] = [];
      for (const [exerciseId, exerciseData] of exerciseMap) {
        const databaseExerciseId = exerciseIdMap.get(exerciseId);
        if (!databaseExerciseId) {
          console.warn(`Exercise ID ${exerciseId} not found in database, skipping`);
          continue;
        }

        // Get exercise from database to determine if it's bodyweight
        const dbExercise = allExercises.find((ex) => ex.id === databaseExerciseId);
        if (!dbExercise) {
          console.warn(`Exercise with ID ${databaseExerciseId} not found, skipping`);
          continue;
        }

        const equipmentType = dbExercise.equipmentType?.toLowerCase() || '';
        const isBodyweight =
          equipmentType.includes('bodyweight') || equipmentType.includes('body weight');

        const Icon = isBodyweight ? User : Dumbbell;
        const iconBgColor = isBodyweight
          ? theme.colors.background.white5
          : theme.colors.accent.primary10;
        const iconColor = isBodyweight ? theme.colors.text.secondary : theme.colors.accent.primary;

        // Calculate suggested weight based on user profile and exercise characteristics
        const loadMultiplier = dbExercise.loadMultiplier ?? 1.0;
        const suggestedWeight = await this.calculateSuggestedWeight(
          userWeightKg,
          loadMultiplier,
          liftingExperience,
          age,
          isBodyweight
        );

        exercisesInWorkout.push({
          id: databaseExerciseId,
          label: dbExercise.name ?? '',
          description: `${exerciseData.sets} sets × ${exerciseData.reps} reps`,
          icon: Icon,
          iconBgColor,
          iconColor,
          groupId: exerciseData.supersetGroup
            ? // Group ids are only compared within one template, so repeat imports may safely reuse it.
              `${rawTemplate.title}-day-${day}-${exerciseData.supersetGroup}`
            : undefined,
          notes:
            [
              typeof exerciseData.minReps === 'number' && exerciseData.minReps !== exerciseData.reps
                ? `Target ${exerciseData.minReps}–${exerciseData.reps} reps`
                : undefined,
              exerciseData.notes,
            ]
              .filter((note): note is string => !!note)
              .join(' • ') || undefined,
          sets: exerciseData.sets,
          reps: exerciseData.reps,
          weight: suggestedWeight,
          isBodyweight,
          restTimeAfter: exerciseData.restTimeAfter,
        });
      }

      if (exercisesInWorkout.length === 0) {
        console.warn(`No valid exercises for day ${day}, skipping template creation`);
        continue;
      }

      // Create workout template name
      const dayName = rawTemplate.dayNames?.[String(day)];
      const templateName =
        dayName ?? i18n.t('workouts.plans.defaultDayName', { day, defaultValue: `Day ${day}` });

      planTemplates.push({
        template: {
          name: templateName,
          description: rawTemplate.description,
          type: DEFAULT_WORKOUT_TYPE,
          icon: undefined,
          exercises: exercisesInWorkout,
          selectedDays: [],
        },
        position: planTemplates.length,
      });
    }

    if (planTemplates.length === 0) {
      return { plan: null, templates: [] };
    }

    return this.createPlanWithTemplates(
      {
        name: rawTemplate.title,
        description: rawTemplate.description,
        difficulty: rawTemplate.difficulty,
        icon: rawTemplate.icon,
        cycleType: 'rotating',
      },
      planTemplates
    );
  }

  /**
   * Archive a workout template
   */
  static async archiveTemplate(templateId: string): Promise<void> {
    const template = await database.get<WorkoutTemplate>('workout_templates').find(templateId);
    await template.archive();
  }

  /**
   * Unarchive a workout template
   */
  static async unarchiveTemplate(templateId: string): Promise<void> {
    const template = await database.get<WorkoutTemplate>('workout_templates').find(templateId);
    await template.unarchive();
  }

  /**
   * Duplicate a workout template (create a copy)
   */
  static async duplicateTemplate(templateId: string): Promise<WorkoutTemplate> {
    return await database.write(async () => {
      const { template, templateExercises, sets, schedule } =
        await this.getTemplateWithDetails(templateId);

      if (template.deletedAt) {
        throw new Error('Cannot duplicate deleted template');
      }

      const now = Date.now();

      const newTemplate = await database.get<WorkoutTemplate>('workout_templates').create((t) => {
        t.name = `${template.name} (Copy)`;
        t.description = template.description;
        t.workoutInsightsType = parseWorkoutInsightsType(template.workoutInsightsType);
        t.type = template.type ?? DEFAULT_WORKOUT_TYPE;
        t.icon = template.icon ?? undefined;
        t.weekDaysJson = undefined;
        t.isArchived = false;
        t.createdAt = now;
        t.updatedAt = now;
      });

      const templateExercisesCollection = database.get<WorkoutTemplateExercise>(
        'workout_template_exercises'
      );
      const templateSetsCollection = database.get<WorkoutTemplateSet>('workout_template_sets');

      const oldToNewExerciseId = new Map<string, WorkoutTemplateExercise>();
      const preparedExercises: WorkoutTemplateExercise[] = [];
      const preparedSets: WorkoutTemplateSet[] = [];

      for (const te of templateExercises) {
        const newExercise = templateExercisesCollection.prepareCreate((newTe) => {
          newTe.templateId = newTemplate.id;
          newTe.exerciseId = te.exerciseId;
          newTe.notes = te.notes;
          newTe.exerciseOrder = te.exerciseOrder;
          newTe.groupId = te.groupId;
          newTe.createdAt = now;
          newTe.updatedAt = now;
        });
        preparedExercises.push(newExercise);
        oldToNewExerciseId.set(te.id, newExercise);
      }

      for (const set of sets) {
        const newExercise = oldToNewExerciseId.get(set.templateExerciseId);
        if (!newExercise) {
          continue;
        }

        preparedSets.push(
          templateSetsCollection.prepareCreate((ts) => {
            ts.templateExerciseId = newExercise.id;
            ts.targetReps = set.targetReps;
            ts.targetWeight = set.targetWeight;
            ts.restTimeAfter = set.restTimeAfter;
            ts.setOrder = set.setOrder;
            ts.setType = set.setType ?? 'normal';
            ts.createdAt = now;
            ts.updatedAt = now;
          })
        );
      }

      const schedulesCollection = database.get<Schedule>('schedules');
      const preparedSchedules =
        schedule.length > 0
          ? schedule.map((sched) =>
              schedulesCollection.prepareCreate((s) => {
                s.templateId = newTemplate.id;
                s.dayOfWeek = sched.dayOfWeek;
                s.reminderTime = sched.reminderTime;
                s.createdAt = now;
                s.updatedAt = now;
              })
            )
          : (template.weekDaysJson ?? []).map((dayIndex) =>
              schedulesCollection.prepareCreate((s) => {
                s.templateId = newTemplate.id;
                s.dayOfWeek = indexToDayName(dayIndex);
                s.createdAt = now;
                s.updatedAt = now;
              })
            );

      await database.batch(...preparedExercises, ...preparedSets, ...preparedSchedules);

      return newTemplate;
    });
  }

  /**
   * Get all archived templates with metadata
   */
  static async getArchivedTemplatesWithMetadata(): Promise<
    {
      id: string;
      name: string;
      description?: string;
      exerciseCount: number;
      lastCompleted?: string;
      lastCompletedTimestamp?: number;
      duration?: string;
      image?: any;
    }[]
  > {
    const templates = await WorkoutTemplateRepository.getArchived().fetch();

    const templatesWithMetadata = await Promise.all(
      templates.map(async (template) => {
        const templateExercises = await database
          .get<WorkoutTemplateExercise>('workout_template_exercises')
          .query(Q.where('template_id', template.id), Q.where('deleted_at', Q.eq(null)))
          .fetch();

        const exerciseCount = templateExercises.length;

        const workoutLogs = await database
          .get<WorkoutLog>('workout_logs')
          .query(
            Q.where('template_id', template.id),
            Q.where('deleted_at', Q.eq(null)),
            Q.sortBy('completed_at', Q.desc)
          )
          .fetch();

        const lastWorkoutLog = workoutLogs[0];

        let lastCompleted: string | undefined;
        let lastCompletedTimestamp: number | undefined;

        if (lastWorkoutLog?.completedAt) {
          lastCompletedTimestamp = lastWorkoutLog.completedAt;
          lastCompleted = this.formatRelativeDate(lastCompletedTimestamp);
        }

        return {
          id: template.id,
          name: template.name,
          description: template.description,
          exerciseCount,
          lastCompleted,
          lastCompletedTimestamp,
        };
      })
    );

    return templatesWithMetadata;
  }

  /**
   * Format timestamp to relative date string (e.g., "2 days ago", "1 week ago")
   */
  private static formatRelativeDate(timestamp: number): string {
    const now = Date.now();
    const diffMs = now - timestamp;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return i18n.t('common.today');
    }

    if (diffDays === 1) {
      return i18n.t('common.yesterday');
    }

    if (diffDays < 7) {
      return i18n.t('common.daysAgo', { count: diffDays });
    }

    if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      if (weeks === 1) {
        return i18n.t('common.oneWeekAgo');
      }

      return i18n.t('common.weeksAgo', { count: weeks });
    }

    if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return i18n.t('common.monthsAgo', { count: months });
    }

    const years = Math.floor(diffDays / 365);
    return i18n.t('common.yearsAgo', { count: years });
  }

  /**
   * Build a plain-text share message for a workout template.
   * Includes the template name, optional description, and bullet-listed exercise names.
   */
  static async getShareMessage(templateId: string): Promise<string> {
    const { template, templateExercises } = await this.getTemplateWithDetails(templateId);
    const exerciseIds = [
      ...new Set(templateExercises.map((te) => te.exerciseId).filter(Boolean)),
    ] as string[];
    const exercises =
      exerciseIds.length > 0
        ? await database
            .get<Exercise>('exercises')
            .query(Q.where('id', Q.oneOf(exerciseIds)))
            .fetch()
        : [];
    const exerciseNames = templateExercises
      .map((te) => exercises.find((e) => e.id === te.exerciseId)?.name)
      .filter(Boolean) as string[];
    const lines = [
      template.name ?? '',
      ...(template.description ? [template.description] : []),
      ...(exerciseNames.length > 0 ? ['', ...exerciseNames.map((name) => `• ${name}`)] : []),
    ];
    return lines.join('\n');
  }

  /**
   * Delete workout template (soft delete)
   */
  static async deleteTemplate(id: string): Promise<void> {
    return this.deleteTemplateInternal(id);
  }

  private static async deleteTemplateInternal(id: string, repairAttempted = false): Promise<void> {
    try {
      return await database.write(async (writer) => {
        const template = await database.get<WorkoutTemplate>('workout_templates').find(id);
        await writer.callWriter(() => template.markAsDeleted());

        const templateExercises = await database
          .get<WorkoutTemplateExercise>('workout_template_exercises')
          .query(Q.where('template_id', id), Q.where('deleted_at', Q.eq(null)))
          .fetch();

        const templateExerciseIds = templateExercises.map((te) => te.id);

        if (templateExerciseIds.length > 0) {
          const sets = await database
            .get<WorkoutTemplateSet>('workout_template_sets')
            .query(
              Q.where('template_exercise_id', Q.oneOf(templateExerciseIds)),
              Q.where('deleted_at', Q.eq(null))
            )
            .fetch();

          for (const set of sets) {
            await writer.callWriter(() => set.markAsDeleted());
          }
        }

        for (const te of templateExercises) {
          await writer.callWriter(() => te.markAsDeleted());
        }

        const schedules = await database
          .get<Schedule>('schedules')
          .query(Q.where('template_id', id), Q.where('deleted_at', Q.eq(null)))
          .fetch();

        for (const schedule of schedules) {
          await writer.callWriter(() => schedule.markAsDeleted());
        }
      });
    } catch (error) {
      if (!repairAttempted) {
        const repair = await DatabaseRepairService.repairIfNeeded(
          error,
          REPAIR_DESCRIPTORS.workoutTemplates
        );

        if (repair.attempted && (repair.reindexed || repair.deletedRootIds.length > 0)) {
          return this.deleteTemplateInternal(id, true);
        }
      }
      throw error;
    }
  }

  /**
   * Update workout template
   */
  static async updateTemplate(
    id: string,
    updates: {
      name?: string;
      description?: string;
      isArchived?: boolean;
      icon?: string;
    }
  ): Promise<WorkoutTemplate> {
    return await database.write(async () => {
      const template = await database.get<WorkoutTemplate>('workout_templates').find(id);

      if (template.deletedAt) {
        throw new Error('Cannot update deleted template');
      }

      await template.update((record) => {
        if (updates.name !== undefined) {
          record.name = updates.name;
        }

        if (updates.description !== undefined) {
          record.description = updates.description;
        }

        if (updates.isArchived !== undefined) {
          record.isArchived = updates.isArchived;
        }

        if (updates.icon !== undefined) {
          record.icon = updates.icon;
        }

        record.updatedAt = Date.now();
      });

      return template;
    });
  }
}
