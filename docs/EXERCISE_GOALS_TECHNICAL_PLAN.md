# Exercise Goals — Technical Implementation Plan (Enhanced)

## Executive Summary

This document provides a comprehensive technical plan for implementing **Exercise Goals** in the Musclog app. While nutrition goals (fitness goals) track body composition and caloric intake, exercise goals will enable users to set and track performance-based targets like "Bench Press 100kg" or "Work out 4 times per week."

This implementation follows the existing codebase patterns for `NutritionGoal` and leverages the already-built `WorkoutAnalytics.getProgressiveOverloadData()` for smart 1RM projections.

---

## Table of Contents

1. [Overview](#overview)
2. [Goal Types](#goal-types)
3. [Database Schema](#database-schema)
4. [Backend Implementation](#backend-implementation)
5. [Frontend Implementation](#frontend-implementation)
6. [UI/UX Design](#uiux-design)
7. [Happy Paths](#happy-paths)
8. [Unhappy Paths](#unhappy-paths)
9. [Potential Bugs & Mitigations](#potential-bugs--mitigations)
10. [Testing Strategy](#testing-strategy)
11. [Implementation Order](#implementation-order)
12. [File Map](#file-map)

---

## Overview

### Current State

The app has `NutritionGoal` (fitness goals) which tracks:

- Caloric targets (calories, protein, carbs, fats)
- Body composition targets (weight, body fat %, BMI, FFMI)
- Target dates

These are managed via `GoalsManagementModal` → `NutritionGoalsModal`.

### Proposed State

Add `ExerciseGoal` to track:

- **1RM Targets**: "Bench Press 100kg by December"
- **Consistency Goals**: "Work out 4 times per week"
- **Future**: Steps per day, running pace, session duration (schema-ready, not v1)

### Key Differentiator: Smart Projections

Unlike simple target tracking, exercise goals use **linear regression** on the user's actual workout history to:

1. Auto-detect current estimated 1RM at goal creation time
2. Calculate weekly progression rate
3. Project realistic timeline ("At your current rate: ~14 weeks")
4. Re-project after every workout automatically

---

## Goal Types

### v1 — Implemented

| Type          | Description                                          | Data Source                                                            | Example             |
| ------------- | ---------------------------------------------------- | ---------------------------------------------------------------------- | ------------------- |
| `1rm`         | Target estimated one-rep max for a specific exercise | `workout_log_sets` via `WorkoutAnalytics.getProgressiveOverloadData()` | "Bench Press 100kg" |
| `consistency` | Minimum workout sessions per week                    | `workout_logs` where `completed_at IS NOT NULL`                        | "Work out 4x/week"  |

### v2 — Planned (Schema-Ready)

| Type                   | Description                    | Data Source                        |
| ---------------------- | ------------------------------ | ---------------------------------- |
| `steps_per_day`        | Daily step count target        | Health Connect / HealthKit         |
| `distance_per_session` | Target run/walk distance       | Health Connect / Future cardio log |
| `pace`                 | Target pace (min/km or min/mi) | Future cardio log                  |
| `duration`             | Target session duration        | Future cardio log                  |

---

## Database Schema

### New Table: `exercise_goals`

```typescript
// database/schema.ts
tableSchema({
  name: 'exercise_goals',
  columns: [
    // Exercise reference (for 1rm goals)
    { name: 'exercise_id', type: 'string', isOptional: true, isIndexed: true },
    // Denormalised name — survives exercise rename/soft-delete
    { name: 'exercise_name_snapshot', type: 'string', isOptional: true },

    // Goal classification
    { name: 'goal_type', type: 'string', isIndexed: true },
    // '1rm' | 'consistency' | 'steps_per_day' | 'distance_per_session' | 'pace' | 'duration'

    // --- 1RM / Strength fields ---
    { name: 'target_weight', type: 'number', isOptional: true }, // kg (metric always)
    // Baseline 1RM at goal creation — used for progress % and regression anchor
    { name: 'baseline_1rm', type: 'number', isOptional: true }, // kg

    // --- Consistency fields ---
    { name: 'target_sessions_per_week', type: 'number', isOptional: true },

    // --- Future cardio fields (TBA) ---
    { name: 'target_steps_per_day', type: 'number', isOptional: true },
    { name: 'target_distance_m', type: 'number', isOptional: true }, // metres
    { name: 'target_duration_s', type: 'number', isOptional: true }, // seconds
    { name: 'target_pace_ms_per_m', type: 'number', isOptional: true }, // ms per metre

    // Shared
    { name: 'target_date', type: 'string', isOptional: true }, // ISO date string, user-overridable
    { name: 'notes', type: 'string', isOptional: true },

    // Snapshot-based history (same pattern as nutrition_goals)
    { name: 'effective_until', type: 'number', isOptional: true }, // null = currently active

    { name: 'created_at', type: 'number' },
    { name: 'updated_at', type: 'number' },
    { name: 'deleted_at', type: 'number', isOptional: true },
  ],
}),
```

### Migration Required

```typescript
// database/migrations/index.ts
{
  toVersion: 8,
  steps: [
    createTable({
      name: 'exercise_goals',
      columns: [
        { name: 'exercise_id', type: 'string', isOptional: true },
        { name: 'exercise_name_snapshot', type: 'string', isOptional: true },
        { name: 'goal_type', type: 'string' },
        { name: 'target_weight', type: 'number', isOptional: true },
        { name: 'baseline_1rm', type: 'number', isOptional: true },
        { name: 'target_sessions_per_week', type: 'number', isOptional: true },
        { name: 'target_steps_per_day', type: 'number', isOptional: true },
        { name: 'target_distance_m', type: 'number', isOptional: true },
        { name: 'target_duration_s', type: 'number', isOptional: true },
        { name: 'target_pace_ms_per_m', type: 'number', isOptional: true },
        { name: 'target_date', type: 'string', isOptional: true },
        { name: 'notes', type: 'string', isOptional: true },
        { name: 'effective_until', type: 'number', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),
    unsafeExecuteSql(
      'CREATE INDEX IF NOT EXISTS exercise_goals_exercise_id ON exercise_goals(exercise_id);'
    ),
    unsafeExecuteSql(
      'CREATE INDEX IF NOT EXISTS exercise_goals_goal_type ON exercise_goals(goal_type);'
    ),
  ],
},
```

### Constants Update

```typescript
// constants/database.ts
export const CURRENT_DATABASE_VERSION = 8; // Bump from 7
```

---

## Backend Implementation

### 1. Model: `ExerciseGoal.ts`

```typescript
// database/models/ExerciseGoal.ts
import { Model } from '@nozbe/watermelondb';
import { date, field, readonly } from '@nozbe/watermelondb/decorators';

export type ExerciseGoalType =
  | '1rm'
  | 'consistency'
  | 'steps_per_day'
  | 'distance_per_session'
  | 'pace'
  | 'duration';

export default class ExerciseGoal extends Model {
  static table = 'exercise_goals';

  @field('exercise_id') exerciseId!: string | null;
  @field('exercise_name_snapshot') exerciseNameSnapshot!: string | null;
  @field('goal_type') goalType!: ExerciseGoalType;

  // 1RM fields
  @field('target_weight') targetWeight!: number | null;
  @field('baseline_1rm') baseline1rm!: number | null;

  // Consistency fields
  @field('target_sessions_per_week') targetSessionsPerWeek!: number | null;

  // Future cardio fields (TBA)
  @field('target_steps_per_day') targetStepsPerDay!: number | null;
  @field('target_distance_m') targetDistanceM!: number | null;
  @field('target_duration_s') targetDurationS!: number | null;
  @field('target_pace_ms_per_m') targetPaceMsPerM!: number | null;

  // Shared
  @field('target_date') targetDate!: string | null;
  @field('notes') notes!: string | null;
  @field('effective_until') effectiveUntil!: number | null;

  @date('created_at') createdAt!: Date;
  @field('updated_at') updatedAt!: number;
  @readonly @date('deleted_at') deletedAt!: Date | null;

  // Helper: Is this goal currently active?
  get isActive(): boolean {
    return this.effectiveUntil === null && this.deletedAt === null;
  }
}
```

### 2. Service: `ExerciseGoalService.ts`

```typescript
// database/services/ExerciseGoalService.ts
import { Q } from '@nozbe/watermelondb';

import { database } from '@/database';
import ExerciseGoal, { type ExerciseGoalType } from '@/database/models/ExerciseGoal';

export interface ExerciseGoalInput {
  goalType: ExerciseGoalType;
  exerciseId?: string;
  exerciseNameSnapshot?: string;
  targetWeight?: number; // kg
  baseline1rm?: number; // kg
  targetSessionsPerWeek?: number;
  targetStepsPerDay?: number;
  targetDistanceM?: number;
  targetDurationS?: number;
  targetPaceMsPerM?: number;
  targetDate?: string | null;
  notes?: string;
}

export class ExerciseGoalService {
  /**
   * Get all active goals (effective_until IS NULL and not deleted)
   */
  static async getActiveGoals(): Promise<ExerciseGoal[]> {
    return await database
      .get<ExerciseGoal>('exercise_goals')
      .query(
        Q.where('effective_until', Q.eq(null)),
        Q.where('deleted_at', Q.eq(null)),
        Q.sortBy('created_at', Q.desc)
      )
      .fetch();
  }

  /**
   * Get active goal for a specific exercise + type combination
   */
  static async getActiveGoalForExercise(
    exerciseId: string,
    goalType: ExerciseGoalType
  ): Promise<ExerciseGoal | null> {
    const goals = await database
      .get<ExerciseGoal>('exercise_goals')
      .query(
        Q.where('exercise_id', exerciseId),
        Q.where('goal_type', goalType),
        Q.where('effective_until', Q.eq(null)),
        Q.where('deleted_at', Q.eq(null)),
        Q.take(1)
      )
      .fetch();
    return goals[0] ?? null;
  }

  /**
   * Get paginated history (effective_until IS NOT NULL)
   */
  static async getGoalHistory(limit?: number, offset?: number): Promise<ExerciseGoal[]> {
    let query = database
      .get<ExerciseGoal>('exercise_goals')
      .query(
        Q.where('effective_until', Q.notEq(null)),
        Q.where('deleted_at', Q.eq(null)),
        Q.sortBy('created_at', Q.desc)
      );

    if (offset) {
      query = query.extend(Q.skip(offset));
    }
    if (limit) {
      query = query.extend(Q.take(limit));
    }

    return await query.fetch();
  }

  /**
   * Save a new goal. Automatically supersedes any existing active goal
   * for the same (exercise_id, goal_type) pair in a single transaction.
   */
  static async saveGoal(data: ExerciseGoalInput): Promise<ExerciseGoal> {
    const now = Date.now();

    // Read BEFORE entering the write block — never nest reads inside
    // database.write() as the LokiJS adapter (web) may not reflect
    // in-transaction writes back to reads, and it avoids deadlock risk.
    let existingGoalToSupersede: ExerciseGoal | null = null;
    let existingConsistencyGoals: ExerciseGoal[] = [];

    if (data.goalType === '1rm' && data.exerciseId) {
      existingGoalToSupersede = await this.getActiveGoalForExercise(data.exerciseId, '1rm');
    }

    if (data.goalType === 'consistency') {
      existingConsistencyGoals = await database
        .get<ExerciseGoal>('exercise_goals')
        .query(
          Q.where('goal_type', 'consistency'),
          Q.where('effective_until', Q.eq(null)),
          Q.where('deleted_at', Q.eq(null))
        )
        .fetch();
    }

    return await database.write(async () => {
      // Supersede old goals
      if (existingGoalToSupersede) {
        await existingGoalToSupersede.update((record) => {
          record.effectiveUntil = now;
          record.updatedAt = now;
        });
      }

      for (const goal of existingConsistencyGoals) {
        await goal.update((record) => {
          record.effectiveUntil = now;
          record.updatedAt = now;
        });
      }

      // Create new goal
      return await database.get<ExerciseGoal>('exercise_goals').create((record) => {
        record.exerciseId = data.exerciseId ?? null;
        record.exerciseNameSnapshot = data.exerciseNameSnapshot ?? null;
        record.goalType = data.goalType;
        record.targetWeight = data.targetWeight ?? null;
        record.baseline1rm = data.baseline1rm ?? null;
        record.targetSessionsPerWeek = data.targetSessionsPerWeek ?? null;
        record.targetStepsPerDay = data.targetStepsPerDay ?? null;
        record.targetDistanceM = data.targetDistanceM ?? null;
        record.targetDurationS = data.targetDurationS ?? null;
        record.targetPaceMsPerM = data.targetPaceMsPerM ?? null;
        record.targetDate = data.targetDate ?? null;
        record.notes = data.notes ?? null;
        record.effectiveUntil = null;
        record.createdAt = now;
        record.updatedAt = now;
      });
    });
  }

  /**
   * Update an existing goal. Does NOT modify baseline_1rm.
   */
  static async updateGoal(id: string, updates: Partial<ExerciseGoalInput>): Promise<ExerciseGoal> {
    return await database.write(async () => {
      const goal = await database.get<ExerciseGoal>('exercise_goals').find(id);

      if (goal.deletedAt) {
        throw new Error('Cannot update deleted goal');
      }

      await goal.update((record) => {
        if (updates.targetWeight !== undefined) {
          record.targetWeight = updates.targetWeight;
        }
        if (updates.targetSessionsPerWeek !== undefined) {
          record.targetSessionsPerWeek = updates.targetSessionsPerWeek;
        }
        if (updates.targetDate !== undefined) {
          record.targetDate = updates.targetDate ?? null;
        }
        if (updates.notes !== undefined) {
          record.notes = updates.notes ?? null;
        }
        // Note: We intentionally do NOT update baseline_1rm here
        // If user wants a fresh baseline, they should create a new goal
        record.updatedAt = Date.now();
      });

      return goal;
    });
  }

  /**
   * Soft-delete a goal. If it was active, promotes the most recent superseded goal back to active.
   */
  static async deleteGoal(id: string): Promise<void> {
    await database.write(async () => {
      const goal = await database.get<ExerciseGoal>('exercise_goals').find(id);

      const wasActive = goal.effectiveUntil === null;
      const goalCreatedAt = goal.createdAt.getTime();
      const goalType = goal.goalType;
      const exerciseId = goal.exerciseId;

      await goal.markAsDeleted();

      // If this was an active goal, try to restore the previous one
      if (wasActive) {
        let query = database
          .get<ExerciseGoal>('exercise_goals')
          .query(
            Q.where('goal_type', goalType),
            Q.where('effective_until', Q.notEq(null)),
            Q.where('deleted_at', Q.eq(null)),
            Q.where('created_at', Q.lt(goalCreatedAt)),
            Q.sortBy('created_at', Q.desc),
            Q.take(1)
          );

        // For 1RM goals, also filter by exercise
        if (goalType === '1rm' && exerciseId) {
          query = database
            .get<ExerciseGoal>('exercise_goals')
            .query(
              Q.where('exercise_id', exerciseId),
              Q.where('goal_type', '1rm'),
              Q.where('effective_until', Q.notEq(null)),
              Q.where('deleted_at', Q.eq(null)),
              Q.where('created_at', Q.lt(goalCreatedAt)),
              Q.sortBy('created_at', Q.desc),
              Q.take(1)
            );
        }

        const previousGoals = await query.fetch();

        if (previousGoals.length > 0) {
          await previousGoals[0].update((record) => {
            record.effectiveUntil = null;
            record.updatedAt = Date.now();
          });
        }
      }
    });
  }
}
```

### 3. Utility: `exerciseGoalProjection.ts`

```typescript
// utils/exerciseGoalProjection.ts
import type { ProgressiveOverloadDataPoint } from '@/database/services/WorkoutAnalytics';

export interface ProjectionInputs {
  dataPoints: ProgressiveOverloadDataPoint[]; // Sorted by date ascending
  baseline1rm: number;
  targetWeight: number;
}

export interface ProjectionResult {
  currentEstimated1RM: number; // kg
  weeklyProgressionRate: number; // kg/week (can be negative)
  projectedWeeks: number | null; // null if rate <= 0 or insufficient data
  projectedDate: Date | null;
  progressPercent: number; // 0–100, clamped, baseline-anchored
  deltaFromBaseline: number; // kg gained since goal started
  status: 'on_track' | 'stalling' | 'declining' | 'achieved' | 'insufficient_data' | 'no_history';
  dataPointCount: number;
}

/**
 * Perform linear regression to find the slope (kg/week)
 */
export function linearRegressionSlope(points: Array<{ x: number; y: number }>): number {
  const n = points.length;
  if (n < 2) return 0;

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  for (const point of points) {
    sumX += point.x;
    sumY += point.y;
    sumXY += point.x * point.y;
    sumX2 += point.x * point.x;
  }

  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) return 0;

  return (n * sumXY - sumX * sumY) / denominator;
}

/**
 * Calculate weeks between two timestamps
 */
function weeksBetween(startMs: number, endMs: number): number {
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  return (endMs - startMs) / msPerWeek;
}

/**
 * Project goal completion based on workout history
 */
export function projectGoal(inputs: ProjectionInputs): ProjectionResult {
  const { dataPoints, baseline1rm, targetWeight } = inputs;

  // No history at all
  if (dataPoints.length === 0) {
    return {
      currentEstimated1RM: baseline1rm,
      weeklyProgressionRate: 0,
      projectedWeeks: null,
      projectedDate: null,
      progressPercent: 0,
      deltaFromBaseline: 0,
      status: 'no_history',
      dataPointCount: 0,
    };
  }

  // Get current estimated 1RM (latest data point)
  const currentEstimated1RM = dataPoints[dataPoints.length - 1].estimated1RM;
  const deltaFromBaseline = currentEstimated1RM - baseline1rm;

  // Already achieved?
  if (currentEstimated1RM >= targetWeight) {
    return {
      currentEstimated1RM,
      weeklyProgressionRate: 0,
      projectedWeeks: 0,
      projectedDate: new Date(),
      progressPercent: 100,
      deltaFromBaseline,
      status: 'achieved',
      dataPointCount: dataPoints.length,
    };
  }

  // Calculate progress percentage (anchored to baseline, not 0)
  const totalGap = targetWeight - baseline1rm;
  const currentGap = targetWeight - currentEstimated1RM;
  const rawProgressPercent = totalGap > 0 ? ((totalGap - currentGap) / totalGap) * 100 : 0;
  const progressPercent = Math.min(100, Math.max(0, rawProgressPercent));

  // Insufficient data for regression
  if (dataPoints.length < 3) {
    return {
      currentEstimated1RM,
      weeklyProgressionRate: 0,
      projectedWeeks: null,
      projectedDate: null,
      progressPercent,
      deltaFromBaseline,
      status: 'insufficient_data',
      dataPointCount: dataPoints.length,
    };
  }

  // Convert data points to weeks since first point for regression
  const firstDate = dataPoints[0].date;
  const regressionPoints = dataPoints.map((dp) => ({
    x: weeksBetween(firstDate, dp.date),
    y: dp.estimated1RM,
  }));

  const weeklyProgressionRate = linearRegressionSlope(regressionPoints);

  // Determine status based on rate
  let status: ProjectionResult['status'];
  if (weeklyProgressionRate > 0.1) {
    status = 'on_track';
  } else if (weeklyProgressionRate > -0.1) {
    status = 'stalling';
  } else {
    status = 'declining';
  }

  // Can't project if not progressing
  if (weeklyProgressionRate <= 0) {
    return {
      currentEstimated1RM,
      weeklyProgressionRate,
      projectedWeeks: null,
      projectedDate: null,
      progressPercent,
      deltaFromBaseline,
      status,
      dataPointCount: dataPoints.length,
    };
  }

  // Calculate projection
  const remainingKg = targetWeight - currentEstimated1RM;
  const projectedWeeks = remainingKg / weeklyProgressionRate;

  // Cap at 2 years to avoid absurd projections
  const MAX_WEEKS = 104; // 2 years
  const cappedWeeks = Math.min(projectedWeeks, MAX_WEEKS);

  const projectedDate = new Date(Date.now() + cappedWeeks * 7 * 24 * 60 * 60 * 1000);

  return {
    currentEstimated1RM,
    weeklyProgressionRate,
    projectedWeeks: cappedWeeks,
    projectedDate,
    progressPercent,
    deltaFromBaseline,
    status,
    dataPointCount: dataPoints.length,
  };
}
```

---

## Frontend Implementation

### 1. Hook: `useExerciseGoals.ts`

```typescript
// hooks/useExerciseGoals.ts
import { Q } from '@nozbe/watermelondb';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { DEFAULT_BATCH_SIZE } from '@/constants/database';
import { database } from '@/database';
import type ExerciseGoal from '@/database/models/ExerciseGoal';
import { ExerciseGoalService } from '@/database/services/ExerciseGoalService';

type Mode = 'active' | 'history';

interface UseExerciseGoalsParams {
  mode: Mode;
  visible?: boolean;
  initialLimit?: number;
  batchSize?: number;
}

interface UseExerciseGoalsResult {
  goals: ExerciseGoal[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useExerciseGoals({
  mode,
  visible = true,
  initialLimit = 5,
  batchSize = DEFAULT_BATCH_SIZE,
}: UseExerciseGoalsParams): UseExerciseGoalsResult {
  const [goals, setGoals] = useState<ExerciseGoal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);

  const loadInitial = useCallback(async () => {
    if (!visible) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setOffset(0);
    setHasMore(true);

    try {
      if (mode === 'active') {
        const activeGoals = await ExerciseGoalService.getActiveGoals();
        setGoals(activeGoals);
        setHasMore(false);
      } else {
        const history = await ExerciseGoalService.getGoalHistory(initialLimit, 0);
        setGoals(history);
        setOffset(history.length);

        if (history.length < initialLimit) {
          setHasMore(false);
        } else {
          // Check if there's more
          const next = await ExerciseGoalService.getGoalHistory(1, initialLimit);
          setHasMore(next.length > 0);
        }
      }
    } catch (err) {
      console.error('Error loading exercise goals:', err);
      setGoals([]);
      setHasMore(false);
    } finally {
      setIsLoading(false);
    }
  }, [mode, visible, initialLimit]);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore || mode !== 'history' || !visible) {
      return;
    }

    setIsLoadingMore(true);

    try {
      const more = await ExerciseGoalService.getGoalHistory(batchSize, offset);
      if (more.length === 0) {
        setHasMore(false);
      } else {
        setGoals((prev) => [...prev, ...more]);
        setOffset((prev) => prev + more.length);

        if (more.length < batchSize) {
          setHasMore(false);
        }
      }
    } catch (err) {
      console.error('Error loading more exercise goals:', err);
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, mode, visible, offset, batchSize]);

  // Subscribe to changes
  useEffect(() => {
    if (!visible) {
      setIsLoading(false);
      return;
    }

    loadInitial();

    // Subscribe to exercise_goals table changes
    const query = database
      .get<ExerciseGoal>('exercise_goals')
      .query(Q.where('deleted_at', Q.eq(null)), Q.sortBy('created_at', Q.desc), Q.take(1));

    const subscription = query.observe().subscribe({
      next: () => loadInitial(),
      error: (err) => console.error('Error observing exercise goals:', err),
    });

    return () => subscription.unsubscribe();
  }, [visible, loadInitial]);

  return useMemo(
    () => ({
      goals,
      isLoading,
      isLoadingMore,
      hasMore,
      loadMore,
      refresh: loadInitial,
    }),
    [goals, isLoading, isLoadingMore, hasMore, loadMore, loadInitial]
  );
}
```

### 2. Hook: `useExerciseGoalProgress.ts`

```typescript
// hooks/useExerciseGoalProgress.ts
import { Q } from '@nozbe/watermelondb';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { database } from '@/database';
import type ExerciseGoal from '@/database/models/ExerciseGoal';
import { WorkoutAnalytics } from '@/database/services';
import type { ProgressiveOverloadDataPoint } from '@/database/services/WorkoutAnalytics';
import { projectGoal, type ProjectionResult } from '@/utils/exerciseGoalProjection';

interface UseExerciseGoalProgressResult {
  projection: ProjectionResult | null;
  isLoading: boolean;
  dataPoints: ProgressiveOverloadDataPoint[];
  refresh: () => Promise<void>;
}

export function useExerciseGoalProgress(goal: ExerciseGoal): UseExerciseGoalProgressResult {
  const [dataPoints, setDataPoints] = useState<ProgressiveOverloadDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (goal.goalType !== '1rm' || !goal.exerciseId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // Use the built-in timeframe param to filter at the DB layer — don't
      // pull all history and filter in JS.
      const goalCreatedAt = goal.createdAt.getTime();
      const filteredData = await WorkoutAnalytics.getProgressiveOverloadData(goal.exerciseId, {
        startDate: goalCreatedAt,
        endDate: Date.now(),
      });

      setDataPoints(filteredData);
    } catch (err) {
      console.error('Error loading exercise goal progress:', err);
      setDataPoints([]);
    } finally {
      setIsLoading(false);
    }
  }, [goal.id, goal.exerciseId, goal.goalType, goal.createdAt]);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Reactive subscription: re-run whenever workout_log_sets or workout_log_exercises
  // change so the card updates after every completed set without manual refresh.
  // Debounced 500 ms to avoid thrashing during a live workout session.
  useEffect(() => {
    if (goal.goalType !== '1rm' || !goal.exerciseId) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const query = database
      .get('workout_log_sets')
      .query(Q.where('deleted_at', Q.eq(null)), Q.take(1));

    const subscription = query.observe().subscribe({
      next: () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          loadData();
        }, 500);
      },
      error: (err) => console.error('useExerciseGoalProgress subscription error:', err),
    });

    return () => {
      subscription.unsubscribe();
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [goal.id, goal.exerciseId, goal.goalType, loadData]);

  const projection = useMemo<ProjectionResult | null>(() => {
    if (goal.goalType !== '1rm') return null;
    if (!goal.targetWeight || !goal.baseline1rm) return null;

    return projectGoal({
      dataPoints,
      baseline1rm: goal.baseline1rm,
      targetWeight: goal.targetWeight,
    });
  }, [dataPoints, goal]);

  return {
    projection,
    isLoading,
    dataPoints,
    refresh: loadData,
  };
}
```

---

## UI/UX Design

### Entry Point: `GoalsManagementModal` Changes

The `GoalsManagementModal` currently only shows nutrition goals. We'll add a section for exercise goals:

```typescript
// In GoalsManagementModal.tsx, add:

// New state
const [exerciseGoalsModalVisible, setExerciseGoalsModalVisible] = useState(false);

// Add section before the closing ScrollView tag
<View className="mb-8">
  <View className="mb-3 flex-row items-center justify-between">
    <Text
      className="font-bold uppercase tracking-widest text-text-secondary"
      style={{ fontSize: theme.typography.fontSize.xs }}
    >
      {t('goalsManagement.exerciseGoals')}
    </Text>
    <ChevronRight size={theme.iconSize.sm} color={theme.colors.text.tertiary} />
  </View>

  <TouchableOpacity
    onPress={() => setExerciseGoalsModalVisible(true)}
    className="rounded-xl border border-border bg-surface p-4"
    activeOpacity={0.7}
  >
    <View className="flex-row items-center justify-between">
      <View className="flex-row items-center gap-3">
        <View
          className="rounded-lg p-2"
          style={{ backgroundColor: theme.colors.accent.secondary10 }}
        >
          <Dumbbell size={theme.iconSize.md} color={theme.colors.accent.secondary} />
        </View>
        <View>
          <Text className="font-semibold text-text-primary">
            {t('goalsManagement.exerciseGoalsTitle')}
          </Text>
          <Text className="text-sm text-text-secondary">
            {t('goalsManagement.exerciseGoalsSubtitle')}
          </Text>
        </View>
      </View>
      <ChevronRight size={theme.iconSize.sm} color={theme.colors.text.tertiary} />
    </View>
  </TouchableOpacity>
</View>

// Add modal at the end
<ExerciseGoalsManagementModal
  visible={exerciseGoalsModalVisible}
  onClose={() => setExerciseGoalsModalVisible(false)}
/>
```

### New Modal: `ExerciseGoalsManagementModal.tsx`

Structure similar to `GoalsManagementModal` but for exercise goals:

```typescript
// components/modals/ExerciseGoalsManagementModal.tsx
interface ExerciseGoalsManagementModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function ExerciseGoalsManagementModal({
  visible,
  onClose,
}: ExerciseGoalsManagementModalProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  const { goals, isLoading, refresh } = useExerciseGoals({ mode: 'active', visible });
  const [creationModalVisible, setCreationModalVisible] = useState(false);

  // Render active goals and history similar to GoalsManagementModal
  // ...
}
```

### New Modal: `ExerciseGoalCreationModal.tsx`

Multi-step creation flow:

```typescript
// components/modals/ExerciseGoalCreationModal.tsx

type CreationStep = 'type' | 'exercise' | 'target' | 'summary';

interface ExerciseGoalCreationModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: () => void;
  editingGoal?: ExerciseGoal | null;
}

export default function ExerciseGoalCreationModal({
  visible,
  onClose,
  onSave,
  editingGoal,
}: ExerciseGoalCreationModalProps) {
  const [step, setStep] = useState<CreationStep>('type');
  const [goalType, setGoalType] = useState<ExerciseGoalType>('1rm');
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [targetWeight, setTargetWeight] = useState('');
  const [sessionsPerWeek, setSessionsPerWeek] = useState(3);
  const [targetDate, setTargetDate] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  // For live projection preview
  const [current1RM, setCurrent1RM] = useState<number | null>(null);
  // Store real data points so projectGoal has the history it needs for regression
  const [exerciseDataPoints, setExerciseDataPoints] = useState<ProgressiveOverloadDataPoint[]>([]);
  const [projection, setProjection] = useState<ProjectionResult | null>(null);

  // Load current 1RM AND data points when exercise is selected
  useEffect(() => {
    if (!selectedExercise || goalType !== '1rm') return;

    WorkoutAnalytics.getProgressiveOverloadData(selectedExercise.id).then((data) => {
      setExerciseDataPoints(data);
      if (data.length > 0) {
        setCurrent1RM(data[data.length - 1].estimated1RM);
      } else {
        setCurrent1RM(null);
      }
    });
  }, [selectedExercise, goalType]);

  // Update live projection whenever target or history changes.
  // Note: baseline1rm is the same as current1RM at creation time — the user
  // hasn't started the goal yet, so there is no separate baseline.
  useEffect(() => {
    if (!current1RM || !targetWeight || goalType !== '1rm') {
      setProjection(null);
      return;
    }

    const targetKg = displayToKg(parseFloat(targetWeight), units);
    const proj = projectGoal({
      dataPoints: exerciseDataPoints, // real history — required for regression slope
      baseline1rm: current1RM,
      targetWeight: targetKg,
    });
    setProjection(proj);
  }, [targetWeight, current1RM, exerciseDataPoints, goalType, units]);

  // Step rendering logic...
}
```

### New Card: `CurrentExerciseGoalCard.tsx`

```typescript
// components/cards/CurrentExerciseGoalCard.tsx

interface CurrentExerciseGoalCardProps {
  goal: ExerciseGoal;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function CurrentExerciseGoalCard({ goal, onEdit, onDelete }: CurrentExerciseGoalCardProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { units } = useSettings();
  const { projection, isLoading } = useExerciseGoalProgress(goal);

  // Render different UI based on goal.goalType
  // For 1RM: Show progress bar, current est, target, projection
  // For consistency: Show weekly progress indicator
}
```

---

## Happy Paths

### Path 1: Creating a 1RM Goal with History

1. User opens `GoalsManagementModal`
2. Taps "Exercise Goals" section
3. `ExerciseGoalsManagementModal` opens with empty state
4. Taps "New Goal" → `ExerciseGoalCreationModal` opens
5. Selects "Lift Goal (1RM)"
6. Searches for "Bench Press" in exercise picker
7. Modal shows: "Your estimated current 1RM: 82.5 kg"
8. User enters target: 100 kg
9. Live projection shows: "At your current rate: ~14 weeks (≈ August 2026)"
10. User taps "Set Goal"
11. Service saves with `baseline_1rm = 82.5`, `target_weight = 100`
12. Goal card appears with progress bar at 0% (baseline-anchored)

### Path 2: Goal Progress After Workouts

1. User logs Bench Press workout with 90kg × 5 reps
2. `WorkoutService.completeWorkout()` triggers
3. `CurrentExerciseGoalCard` re-renders via `useExerciseGoalProgress`
4. Progress bar updates: "Current: 87.5 kg (+5 kg since start)"
5. Projection updates: "At your current rate: ~8 weeks"

### Path 3: Achieving a Goal

1. User's estimated 1RM crosses 100 kg (target)
2. Goal card switches to "Achieved" state with celebration
3. User taps "Set New Goal"
4. Old goal's `effective_until` is stamped
5. New goal creation flow starts with `baseline_1rm = 100`

### Path 4: Creating a Consistency Goal

1. User selects "Workout Consistency"
2. Uses stepper to set "4 sessions per week"
3. Optional target date
4. Goal card shows weekly progress ring
5. Each completed workout increments the counter

---

## Unhappy Paths

| Scenario                                | Handling                                                                                            |
| --------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **No workout history for exercise**     | Show "No sessions yet — we'll start tracking from your first session." Progress = 0, no projection. |
| **< 3 data points**                     | Show "Log at least 3 sessions to see a projection." Progress bar still shown.                       |
| **Stalling/Declining (rate ≤ 0)**       | Orange/red warning: "No recent progress detected." No projected date.                               |
| **Target ≤ current at creation**        | Warning: "You may already be at this level — verify with a max test." Allow save.                   |
| **Target date in past**                 | Allow creation, show "Overdue" badge on card.                                                       |
| **Duplicate active goal**               | Auto-supersede old goal in same transaction — expected upgrade flow.                                |
| **Exercise deleted after goal created** | Use `exerciseNameSnapshot` + "Exercise deleted" chip.                                               |
| **DB write fails mid-supersede**        | Transaction rolls back, show error snackbar.                                                        |
| **Imperial units user**                 | Input in lbs, store as kg via `displayToKg`, display via `kgToDisplay`.                             |
| **Very large workout_log_sets table**   | Already indexed by `exercise_id` through `workout_log_exercises`.                                   |

---

## Potential Bugs & Mitigations

### 1. Unit Conversion Bug

**Risk:** User types 100 in lbs-mode; saved as 100 kg (220 lbs). Goal appears "achieved" immediately.

**Mitigation:**

- Use `displayToKg(value, units)` before saving
- Use `kgToDisplay(value, units)` when displaying
- Add unit tests for conversion at service boundary

### 2. Stale Baseline on Edit

**Risk:** User edits goal months later; baseline shows misleading progress %.

**Mitigation:**

- Never update `baseline_1rm` on edit
- Document: "For fresh baseline, create new goal"
- Show baseline date in UI: "Started tracking from July 2025"

### 3. Regression Over All History

**Risk:** Old rapid progress skews projection; or recent injury not reflected.

**Mitigation:**

- Filter `getProgressiveOverloadData` to `createdAt` onward
- Consider "Last 12 weeks" toggle for advanced users

### 4. Missing Migration

**Risk:** Crash on app update if migration missing.

**Mitigation:**

- Must add to both `schema.ts` AND `migrations/index.ts`
- Bump `CURRENT_DATABASE_VERSION`
- Test on fresh install and upgrade path

### 5. Progress Bar > 100%

**Risk:** User exceeds target (110 kg vs 100 kg target), bar breaks layout.

**Mitigation:**

- Clamp: `Math.min(100, rawPercent)`
- Switch to "Achieved" state when `current >= target`

### 6. Missing `.web.tsx` for Charts

**Risk:** Web build crashes if using Skia components.

**Mitigation:**

- Use plain `View` progress bar (NativeWind), not Victory charts
- If sparkline added later, create `.web.tsx` counterpart

### 7. Race Condition with PR Detection

**Risk:** Post-workout: PR detection and goal progress hook both fire.

**Mitigation:**

- `useExerciseGoalProgress` debounces refetch (500ms)
- Separate code paths, no shared state conflict

### 8. Week Boundary Ambiguity

**Risk:** "Sessions in last 7 days" shifts by 1 depending on query time.

**Mitigation:**

- Use `localDayStartMs` from `utils/calendarDate.ts`
- Anchor to start of local day

### 9. Multiple Active Goals After Failed Transaction

**Risk:** Supersede succeeds but insert fails → no active goal exists.

**Mitigation:**

- Single `database.write()` block for entire operation
- WatermelonDB transactions are atomic

### 10. Stale Exercise Name

**Risk:** Exercise renamed, history shows old name.

**Mitigation:**

- Active goal: prefer live `exercise.name` lookup
- History: use `exerciseNameSnapshot`
- Show "(renamed)" chip if different

### 11. Read Inside `database.write()` Block

**Risk:** `saveGoal` originally queried for existing goals inside the write block. WatermelonDB's LokiJS adapter (web) may not reflect in-transaction state back to read queries within the same write, and it violates the AGENTS.md guideline against nesting DB access in write blocks.

**Mitigation:**

- Always read existing goals **before** entering `database.write()` (fetch pre-read variables)
- The write block only contains `record.update()` and `record.create()` calls — no `.fetch()` calls inside

### 12. `useExerciseGoalProgress` Not Reactive

**Risk:** Hook only loads data once on mount. If the user logs a workout while the goal card is visible, the progress bar won't update without a manual refresh.

**Mitigation:**

- Add a `workout_log_sets` WatermelonDB observable subscription inside the hook
- Debounce the refetch 500 ms to avoid hammering the DB during a live workout session (one set logged every few seconds)
- Use `useCallback` on `loadData` so the subscription effect has a stable dependency

### 13. Creation Modal Projection Using Empty Data Points

**Risk:** The live projection preview in `ExerciseGoalCreationModal` was calling `projectGoal({ dataPoints: [], ... })`. With no data points, `linearRegressionSlope` returns 0 and the projection always shows `insufficient_data` — making the feature useless.

**Mitigation:**

- Fetch and store the exercise's full data point history when the exercise is selected
- Pass `exerciseDataPoints` (not `[]`) to `projectGoal` in the live preview `useEffect`

---

## Testing Strategy

### Unit Tests

```typescript
// utils/__tests__/exerciseGoalProjection.test.ts
describe('projectGoal', () => {
  it('returns achieved status when current >= target', () => {});
  it('returns insufficient_data when < 3 data points', () => {});
  it('returns stalling when rate ≈ 0', () => {});
  it('returns declining when rate < 0', () => {});
  it('caps projection at 2 years', () => {});
  it('calculates correct progress percent from baseline', () => {});
});

describe('linearRegressionSlope', () => {
  it('calculates positive slope for increasing data', () => {});
  it('returns 0 for flat data', () => {});
  it('returns negative for declining data', () => {});
});
```

### Service Tests

```typescript
// database/services/__tests__/ExerciseGoalService.test.ts
describe('ExerciseGoalService', () => {
  describe('saveGoal', () => {
    it('supersedes existing 1RM goal for same exercise', () => {});
    it('supersedes existing consistency goal', () => {});
    it('creates goal with correct baseline', () => {});
  });

  describe('deleteGoal', () => {
    it('restores previous goal when active goal deleted', () => {});
    it('soft-deletes without restore when already superseded', () => {});
  });
});
```

### Integration Tests

- Create goal → Log workout → Verify progress updates
- Change units (metric ↔ imperial) → Verify display updates
- Delete exercise → Verify goal shows snapshot name

### Manual QA Checklist

- [ ] Create 1RM goal with history
- [ ] Create 1RM goal without history
- [ ] Create consistency goal
- [ ] Edit goal (target only, not baseline)
- [ ] Delete goal (restores previous)
- [ ] Complete workout → Verify progress updates
- [ ] Imperial units mode
- [ ] German locale (number formatting)
- [ ] Web build (no Skia errors)

---

## Implementation Order

1. **Database Layer**
   - `constants/database.ts` — bump version to 8
   - `database/schema.ts` — add `exercise_goals` table
   - `database/migrations/index.ts` — add migration v8

2. **Model**
   - `database/models/ExerciseGoal.ts`
   - `database/models/index.ts` — export
   - `database/database-instance.ts` — register

3. **Utility**
   - `utils/exerciseGoalProjection.ts`
   - `utils/__tests__/exerciseGoalProjection.test.ts`

4. **Service**
   - `database/services/ExerciseGoalService.ts`
   - `database/services/index.ts` — export

5. **Hooks**
   - `hooks/useExerciseGoals.ts`
   - `hooks/useExerciseGoalProgress.ts`

6. **Translations**
   - `lang/locales/en-us/exerciseGoals.json`
   - `lang/locales/pt-br/exerciseGoals.json`
   - `lang/locales/ru-ru/exerciseGoals.json`
   - Update `lang/locales/*/goalsManagement.json` with entry point

7. **UI Components**
   - `components/modals/ExerciseGoalCreationModal.tsx`
   - `components/cards/CurrentExerciseGoalCard.tsx`
   - `components/cards/ExerciseGoalHistoryCard.tsx`
   - `components/modals/ExerciseGoalsManagementModal.tsx`

8. **Integration**
   - `components/modals/GoalsManagementModal.tsx` — add entry point

9. **Post-Workout Integration (v1.1)**
   - Update `app/workout/workout-summary.tsx` to check for goal progress
   - Show nudge when PR relates to active goal

10. **Polish**
    - Widget considerations (future)
    - Analytics/metrics tracking

---

## File Map

### New Files

| File                                                 | Purpose                   |
| ---------------------------------------------------- | ------------------------- |
| `database/models/ExerciseGoal.ts`                    | WatermelonDB model        |
| `database/services/ExerciseGoalService.ts`           | CRUD + supersede logic    |
| `utils/exerciseGoalProjection.ts`                    | Pure projection functions |
| `utils/__tests__/exerciseGoalProjection.test.ts`     | Unit tests                |
| `hooks/useExerciseGoals.ts`                          | Reactive list hook        |
| `hooks/useExerciseGoalProgress.ts`                   | Per-goal projection hook  |
| `components/modals/ExerciseGoalsManagementModal.tsx` | Main management UI        |
| `components/modals/ExerciseGoalCreationModal.tsx`    | Multi-step creation       |
| `components/cards/CurrentExerciseGoalCard.tsx`       | Active goal display       |
| `components/cards/ExerciseGoalHistoryCard.tsx`       | Historical goal display   |
| `lang/locales/en-us/exerciseGoals.json`              | English strings           |
| `lang/locales/pt-br/exerciseGoals.json`              | Portuguese strings        |
| `lang/locales/ru-ru/exerciseGoals.json`              | Russian strings           |

### Modified Files

| File                                         | Change                               |
| -------------------------------------------- | ------------------------------------ |
| `constants/database.ts`                      | Bump `CURRENT_DATABASE_VERSION` to 8 |
| `database/schema.ts`                         | Add `exercise_goals` table           |
| `database/migrations/index.ts`               | Add migration v8                     |
| `database/database-instance.ts`              | Register `ExerciseGoal` model        |
| `database/models/index.ts`                   | Export `ExerciseGoal`                |
| `database/services/index.ts`                 | Export `ExerciseGoalService`         |
| `components/modals/GoalsManagementModal.tsx` | Add exercise goals entry point       |
| `lang/locales/en-us/goalsManagement.json`    | Add entry point labels               |
| `lang/locales/pt-br/goalsManagement.json`    | Add entry point labels               |
| `lang/locales/ru-ru/goalsManagement.json`    | Add entry point labels               |

---

## Translation Keys (New)

```json
// lang/locales/en-us/exerciseGoals.json
{
  "exerciseGoals": {
    "title": "Exercise Goals",
    "newGoal": "New Goal",
    "active": "Active",
    "currentGoals": "Current Goals",
    "history": "History",
    "emptyState": "Set your first exercise goal to start tracking strength progress.",
    "deleteGoal": "Delete Goal",
    "deleteGoalMessage": "This goal and its progress history will be permanently deleted.",
    "goalTypes": {
      "1rm": "Lift Goal",
      "consistency": "Consistency",
      "steps_per_day": "Daily Steps",
      "distance_per_session": "Distance",
      "pace": "Pace",
      "duration": "Duration"
    },
    "creation": {
      "title": "New Exercise Goal",
      "chooseType": "What do you want to track?",
      "comingSoon": "Coming soon",
      "chooseExercise": "Choose an Exercise",
      "searchPlaceholder": "Search exercises…",
      "currentEstimated1RM": "Your estimated current 1RM: {{value}} {{unit}}",
      "noHistoryForExercise": "No workout history yet — we'll start tracking from your first session.",
      "targetWeight": "Target {{unit}}",
      "sessionsPerWeek": "Sessions per Week",
      "targetDate": "Target Date (optional)",
      "notes": "Notes (optional)",
      "save": "Set Goal",
      "projectionPreview": "At your current rate, ~{{weeks}} weeks (≈ {{date}})",
      "projectionFaster": "That's {{percent}}% faster than your current rate.",
      "projectionSlower": "You're ahead of schedule by {{weeks}} weeks.",
      "summaryTitle": "Goal Summary"
    },
    "card": {
      "target": "Target",
      "currentEstimate": "Current est. 1RM",
      "deltaSinceStart": "+{{value}} {{unit}} since start",
      "projectedDate": "At your current rate: ~{{weeks}} weeks (≈ {{date}})",
      "averageFrequency": "Logging every {{days}} days on average",
      "stalling": "No recent progress detected. Consider adjusting your programming.",
      "declining": "Your estimated 1RM has trended down recently.",
      "achieved": "You've reached your goal! Set a new one?",
      "insufficientData": "Log at least 3 sessions to see a projection.",
      "noHistory": "No sessions logged yet. Start tracking to see progress.",
      "daysLeft": "{{days}} days left",
      "overdue": "Target date passed",
      "sessionsThisWeek": "{{count}} of {{target}} sessions this week"
    }
  }
}
```

```json
// Add to lang/locales/en-us/goalsManagement.json
{
  "goalsManagement": {
    "exerciseGoals": "EXERCISE GOALS",
    "exerciseGoalsTitle": "Strength & Consistency",
    "exerciseGoalsSubtitle": "Track 1RM targets and workout frequency"
  }
}
```

```json
// Add to lang/locales/pt-br/goalsManagement.json
{
  "goalsManagement": {
    "exerciseGoals": "METAS DE EXERCÍCIO",
    "exerciseGoalsTitle": "Força & Consistência",
    "exerciseGoalsSubtitle": "Acompanhe metas de 1RM e frequência de treinos"
  }
}
```

```json
// Add to lang/locales/ru-ru/goalsManagement.json
{
  "goalsManagement": {
    "exerciseGoals": "ЦЕЛИ ТРЕНИРОВОК",
    "exerciseGoalsTitle": "Сила и постоянство",
    "exerciseGoalsSubtitle": "Отслеживайте цели по 1ПМ и частоте тренировок"
  }
}
```

---

## Future Enhancements (Post-v1)

1. **AI-Suggested Goals**: "Based on your progress, you could hit 110kg in 3 months"
2. **Push Notifications**: "You hit your Bench Press goal! 🎉"
3. **Social Sharing**: Share goal achievements
4. **Advanced Metrics**: Wilks score, relative strength tracking
5. **Periodization**: Auto-adjust goals based on training phase
6. **Cardio Goals**: Steps, distance, pace (schema ready)
7. **Home Screen Widget**: Show active exercise goals

---

## Questions for Product/Design

1. Should we allow multiple active 1RM goals (different exercises)? **Answer: Yes**
2. Should consistency goals have a "streak" feature? **Answer: Future enhancement**
3. Should achieved goals trigger a celebration animation? **Answer: Yes**
4. Should we show exercise goals in the workout completion summary? **Answer: Yes, v1.1**
5. Should goals integrate with the AI coach? **Answer: Future enhancement**
