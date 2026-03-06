import { ChatService, ExerciseService, WorkoutService } from '../database/services';
import {
  type ExerciseInWorkout,
  WorkoutTemplateService,
} from '../database/services/WorkoutTemplateService';
import type {
  CalculateVolumeResponse,
  GenerateWorkoutPlanResponse,
  ParsedWorkout,
} from './coachAI';

/**
 * Process workout volume calculation response from AI
 * Updates workout sets based on AI recommendations and saves feedback to chat
 */
export async function processCalculateVolumeResponse(
  response: CalculateVolumeResponse,
  workoutLogId: string,
  sessionId: string
): Promise<void> {
  try {
    // Prepare set updates from AI response
    const setUpdates = response.workoutVolume.flatMap((exercise) =>
      exercise.sets.map((set) => ({
        setId: set.setId.toString(),
        weight: set.weight,
        reps: set.reps,
      }))
    );

    // Update workout sets if there are recommendations
    if (setUpdates.length > 0) {
      await WorkoutService.updateWorkoutSets(workoutLogId, setUpdates);
    }

    // Save AI feedback message to chat
    await ChatService.saveMessage({
      sessionId,
      sender: 'coach',
      message: response.messageToUser,
      messageType: 'text',
      summarizedMessage: response.messageToUser.substring(0, 200),
    });
  } catch (error) {
    console.error('[workoutAI] Error processing volume response:', error);
    throw error;
  }
}

/**
 * Process recent workout insights response from AI
 * Saves feedback to chat
 */
export async function processFeedbackResponse(
  feedbackMessage: string,
  sessionId: string
): Promise<void> {
  try {
    // Save AI feedback message to chat
    await ChatService.saveMessage({
      sessionId,
      sender: 'coach',
      message: feedbackMessage,
      messageType: 'text',
      summarizedMessage: feedbackMessage.substring(0, 200),
    });
  } catch (error) {
    console.error('[workoutAI] Error processing feedback response:', error);
    throw error;
  }
}

/**
 * Process generated workout plan response from AI
 * Creates new workout templates in the database and saves feedback to chat
 */
export async function processWorkoutPlanResponse(
  response: GenerateWorkoutPlanResponse,
  sessionId: string
): Promise<{ templateIds: string[]; description: string }> {
  try {
    const createdTemplateIds: string[] = [];

    // Get all exercises to match by name
    const allExercises = await ExerciseService.getAllExercises();
    const exercisesByName = new Map(allExercises.map((ex) => [ex.name.toLowerCase(), ex]));

    // Create a template for each workout plan
    for (const plan of response.workoutPlan) {
      // Map AI exercises to ExerciseInWorkout format
      const exercises: ExerciseInWorkout[] = [];

      for (const aiExercise of plan.exercises) {
        // Find exercise by name (case-insensitive)
        const matchedExercise = exercisesByName.get(aiExercise.name.toLowerCase());
        if (!matchedExercise) {
          console.warn(`[workoutAI] Exercise not found: ${aiExercise.name}`);
          continue;
        }

        exercises.push({
          id: matchedExercise.id,
          label: matchedExercise.name,
          description: `${aiExercise.sets}x${aiExercise.reps}`,
          icon: undefined,
          iconBgColor: '',
          iconColor: '',
          sets: aiExercise.sets,
          reps: aiExercise.reps,
          weight: 0, // Default weight estimate (user will adjust)
          isBodyweight: matchedExercise.equipmentType === 'bodyweight',
          restTimeAfter: 60, // Default rest time
          isDropSet: false,
        });
      }

      if (exercises.length === 0) {
        console.warn(`[workoutAI] No matching exercises for plan: ${plan.title}`);
        continue;
      }

      // Parse recurring day (e.g., "Monday" -> 0)
      const dayMap: Record<string, number> = {
        monday: 0,
        tuesday: 1,
        wednesday: 2,
        thursday: 3,
        friday: 4,
        saturday: 5,
        sunday: 6,
      };
      const dayIndex = dayMap[plan.recurringOnWeekDay.toLowerCase()] ?? 0;

      // Create the workout template
      const template = await WorkoutTemplateService.saveTemplate({
        name: plan.title,
        description: plan.description,
        exercises,
        selectedDays: [dayIndex],
      });

      createdTemplateIds.push(template.id);
    }

    // Save AI feedback message to chat
    await ChatService.saveMessage({
      sessionId,
      sender: 'coach',
      message: response.description,
      messageType: 'text',
      summarizedMessage: response.description.substring(0, 200),
    });

    return {
      templateIds: createdTemplateIds,
      description: response.description,
    };
  } catch (error) {
    console.error('[workoutAI] Error processing workout plan:', error);
    throw error;
  }
}

/**
 * Prepare completed workout data for AI analysis
 * Formats workout details in a structure suitable for AI prompts
 */
export async function prepareWorkoutDataForAI(workoutLogId: string): Promise<string> {
  try {
    const { workoutLog, sets } = await WorkoutService.getWorkoutWithDetails(workoutLogId);

    // Build a formatted workout summary for AI
    const exercisesByName = new Map<string, { sets: typeof sets; exercise: any }>();

    for (const set of sets) {
      if (!set.exercise) {
        continue;
      }

      const exerciseName = set.exercise.name;
      if (!exercisesByName.has(exerciseName)) {
        exercisesByName.set(exerciseName, { sets: [], exercise: set.exercise });
      }
      exercisesByName.get(exerciseName)!.sets.push(set);
    }

    // Format as readable workout log
    const workoutData = {
      title: workoutLog.workoutName,
      date: new Date(workoutLog.startedAt).toISOString(),
      duration: workoutLog.completedAt
        ? Math.round((workoutLog.completedAt - workoutLog.startedAt) / 60000)
        : 0,
      exercises: Array.from(exercisesByName.entries()).map(([name, data]) => ({
        name,
        muscleGroup: data.exercise.muscleGroup,
        sets: data.sets.map((set) => ({
          reps: set.reps,
          weight: set.weight,
          partials: set.partials || 0,
          repsInReserve: set.repsInReserve || 0,
        })),
      })),
    };

    return JSON.stringify(workoutData);
  } catch (error) {
    console.error('[workoutAI] Error preparing workout data:', error);
    throw error;
  }
}

/**
 * Process parsed workouts from AI and save to database
 * Creates workout logs from the parsed data
 */
export async function processParsedWorkouts(
  workouts: ParsedWorkout[]
): Promise<{ workoutLogIds: string[]; count: number }> {
  try {
    const createdWorkoutIds: string[] = [];

    for (const parsedWorkout of workouts) {
      // Parse the date from the parsed workout
      const workoutDate = new Date(parsedWorkout.date);

      // Create a free-form workout log for each parsed workout
      const workoutLog = await WorkoutService.startFreeWorkout(
        parsedWorkout.title || 'Imported Workout',
        `imported_${Date.now()}`
      );

      // Add exercises and sets to the workout
      const setUpdates = [];
      let setCount = 0;

      for (const exercise of parsedWorkout.exercises) {
        // Find exercise by name
        const allExercises = await ExerciseService.getAllExercises();
        const matchedExercise = allExercises.find(
          (ex) => ex.name.toLowerCase() === exercise.name.toLowerCase()
        );

        if (!matchedExercise) {
          console.warn(`[workoutAI] Exercise not found during import: ${exercise.name}`);
          continue;
        }

        // Create sets for this exercise
        for (const set of exercise.sets) {
          setCount++;
          setUpdates.push({
            setId: `new_${setCount}`,
            exerciseId: matchedExercise.id,
            reps: set.reps,
            weight: set.weight,
            isNew: true,
            setOrder: setCount,
          });
        }
      }

      // Add all sets to the workout
      if (setUpdates.length > 0) {
        await WorkoutService.updateWorkoutSets(workoutLog.id, setUpdates);
      }

      // Complete the workout with the parsed date
      const result = await WorkoutService.completeWorkout(workoutLog.id);
      if (result.workoutLog) {
        createdWorkoutIds.push(result.workoutLog.id);
      }
    }

    return {
      workoutLogIds: createdWorkoutIds,
      count: createdWorkoutIds.length,
    };
  } catch (error) {
    console.error('[workoutAI] Error processing parsed workouts:', error);
    throw error;
  }
}
