/**
 * Exercise names as the common logging apps write them, mapped to the free-exercise-db slug of the
 * catalogue movement they mean. Exact catalogue matching fails for most lifts ("Bench Press
 * (Barbell)" vs "Barbell Bench Press - Medium Grip"), so this table closes that gap.
 *
 * Only a name whose catalogue row really is the same movement belongs here. An assisted pull-up is
 * not a pull-up and a leg-press calf raise is not a standing calf raise: leave the name out and it
 * is matched by the other rules or proposed as a custom exercise.
 *
 * Keys are stored in normalised form (`tokenizeExerciseText`), so case, plurals, punctuation and
 * brackets do not matter. `utils/__tests__/foreignExerciseNames.test.ts` pins that every slug exists
 * in the bundled catalogue.
 */
import { tokenizeExerciseText } from '@/utils/exerciseSearch';

const RAW_FOREIGN_EXERCISE_SLUGS: readonly (readonly [name: string, slug: string])[] = [
  // Chest
  ['Bench Press (Barbell)', 'Barbell_Bench_Press_-_Medium_Grip'],
  ['Flat Barbell Bench Press', 'Barbell_Bench_Press_-_Medium_Grip'],
  ['Barbell Bench Press', 'Barbell_Bench_Press_-_Medium_Grip'],
  ['Bench Press (Dumbbell)', 'Dumbbell_Bench_Press'],
  ['Dumbbell Bench Press', 'Dumbbell_Bench_Press'],
  ['Bench Press (Smith Machine)', 'Smith_Machine_Bench_Press'],
  ['Incline Bench Press (Barbell)', 'Barbell_Incline_Bench_Press_-_Medium_Grip'],
  ['Incline Barbell Bench Press', 'Barbell_Incline_Bench_Press_-_Medium_Grip'],
  ['Incline Bench Press (Dumbbell)', 'Incline_Dumbbell_Press'],
  ['Incline Dumbbell Bench Press', 'Incline_Dumbbell_Press'],
  ['Decline Bench Press (Barbell)', 'Decline_Barbell_Bench_Press'],
  ['Decline Bench Press (Dumbbell)', 'Decline_Dumbbell_Bench_Press'],
  ['Chest Press (Machine)', 'Leverage_Chest_Press'],
  ['Incline Chest Press (Machine)', 'Leverage_Incline_Chest_Press'],
  ['Decline Chest Press (Machine)', 'Leverage_Decline_Chest_Press'],
  ['Dumbbell Fly', 'Dumbbell_Flyes'],
  ['Chest Fly (Dumbbell)', 'Dumbbell_Flyes'],
  ['Incline Dumbbell Fly', 'Incline_Dumbbell_Flyes'],
  ['Incline Chest Fly (Dumbbell)', 'Incline_Dumbbell_Flyes'],
  ['Cable Crossover', 'Cable_Crossover'],
  ['Cable Fly', 'Cable_Crossover'],
  ['Low Cable Fly', 'Low_Cable_Crossover'],
  ['Push Up', 'Pushups'],
  ['Chest Dip', 'Dips_-_Chest_Version'],
  ['Triceps Dip', 'Dips_-_Triceps_Version'],
  ['Dumbbell Pullover', 'Bent-Arm_Dumbbell_Pullover'],
  // Legs and hips
  ['Squat (Barbell)', 'Barbell_Squat'],
  ['Barbell Squat', 'Barbell_Squat'],
  ['Back Squat (Barbell)', 'Barbell_Squat'],
  ['Squat (Smith Machine)', 'Smith_Machine_Squat'],
  ['Squat (Dumbbell)', 'Dumbbell_Squat'],
  ['Dumbbell Squat', 'Dumbbell_Squat'],
  ['Front Squat (Barbell)', 'Front_Barbell_Squat'],
  ['Goblet Squat (Kettlebell)', 'Goblet_Squat'],
  ['Hack Squat (Machine)', 'Hack_Squat'],
  ['Leg Press (Machine)', 'Leg_Press'],
  ['Leg Press', 'Leg_Press'],
  ['Leg Extension (Machine)', 'Leg_Extensions'],
  ['Leg Extension', 'Leg_Extensions'],
  ['Leg Curl (Machine)', 'Lying_Leg_Curls'],
  ['Lying Leg Curl', 'Lying_Leg_Curls'],
  ['Seated Leg Curl', 'Seated_Leg_Curl'],
  ['Standing Leg Curl', 'Standing_Leg_Curl'],
  ['Standing Calf Raise (Machine)', 'Standing_Calf_Raises'],
  ['Seated Calf Raise (Machine)', 'Seated_Calf_Raise'],
  ['Standing Calf Raise (Dumbbell)', 'Standing_Dumbbell_Calf_Raise'],
  ['Deadlift (Barbell)', 'Barbell_Deadlift'],
  ['Deadlift', 'Barbell_Deadlift'],
  ['Sumo Deadlift (Barbell)', 'Sumo_Deadlift'],
  ['Romanian Deadlift (Barbell)', 'Romanian_Deadlift'],
  ['Stiff Leg Deadlift (Barbell)', 'Stiff-Legged_Barbell_Deadlift'],
  ['Hip Thrust (Barbell)', 'Barbell_Hip_Thrust'],
  ['Good Morning (Barbell)', 'Good_Morning'],
  ['Barbell Walking Lunge', 'Barbell_Walking_Lunge'],
  ['Lunge (Dumbbell)', 'Dumbbell_Lunges'],
  ['Dumbbell Lunge', 'Dumbbell_Lunges'],
  ['Step Up (Dumbbell)', 'Dumbbell_Step_Ups'],
  ['Glute Kickback', 'Glute_Kickback'],
  ['Glute Kickback (Cable)', 'One-Legged_Cable_Kickback'],
  // Shoulders
  ['Overhead Press (Barbell)', 'Standing_Military_Press'],
  ['Barbell Overhead Press', 'Standing_Military_Press'],
  ['Shoulder Press (Barbell)', 'Barbell_Shoulder_Press'],
  ['Shoulder Press (Dumbbell)', 'Dumbbell_Shoulder_Press'],
  ['Dumbbell Shoulder Press', 'Dumbbell_Shoulder_Press'],
  ['Seated Shoulder Press (Dumbbell)', 'Seated_Dumbbell_Press'],
  ['Arnold Press (Dumbbell)', 'Arnold_Dumbbell_Press'],
  ['Shoulder Press (Machine)', 'Leverage_Shoulder_Press'],
  ['Lateral Raise (Dumbbell)', 'Side_Lateral_Raise'],
  ['Dumbbell Lateral Raise', 'Side_Lateral_Raise'],
  ['Lateral Raise (Cable)', 'Cable_Seated_Lateral_Raise'],
  ['Rear Delt Fly (Dumbbell)', 'Reverse_Flyes'],
  ['Reverse Fly (Dumbbell)', 'Reverse_Flyes'],
  ['Face Pull (Cable)', 'Face_Pull'],
  ['Upright Row (Barbell)', 'Upright_Barbell_Row'],
  ['Shrug (Barbell)', 'Barbell_Shrug'],
  ['Shrug (Dumbbell)', 'Dumbbell_Shrug'],
  // Back
  ['Bent Over Row (Barbell)', 'Bent_Over_Barbell_Row'],
  ['Barbell Bent Over Row', 'Bent_Over_Barbell_Row'],
  ['Bent Over Row (Dumbbell)', 'Bent_Over_Two-Dumbbell_Row'],
  ['One Arm Dumbbell Row', 'One-Arm_Dumbbell_Row'],
  ['Dumbbell Row (One Arm)', 'One-Arm_Dumbbell_Row'],
  ['Seated Cable Row (Cable)', 'Seated_Cable_Rows'],
  ['Seated Cable Row', 'Seated_Cable_Rows'],
  ['Lat Pulldown (Cable)', 'Wide-Grip_Lat_Pulldown'],
  ['Lat Pulldown (Machine)', 'Wide-Grip_Lat_Pulldown'],
  ['Lat Pulldown', 'Wide-Grip_Lat_Pulldown'],
  ['Close Grip Lat Pulldown (Cable)', 'Close-Grip_Front_Lat_Pulldown'],
  ['Straight Arm Pulldown (Cable)', 'Rope_Straight-Arm_Pulldown'],
  ['Pull Up', 'Pullups'],
  ['Pullup', 'Pullups'],
  ['Chin Up', 'Chin-Up'],
  ['Chin-Up', 'Chin-Up'],
  ['Back Extension', 'Hyperextensions_Back_Extensions'],
  ['Hyperextension', 'Hyperextensions_Back_Extensions'],
  ['T-Bar Row', 'T-Bar_Row_with_Handle'],
  // Arms
  ['Bicep Curl (Dumbbell)', 'Dumbbell_Bicep_Curl'],
  ['Dumbbell Curl', 'Dumbbell_Bicep_Curl'],
  ['Bicep Curl (Barbell)', 'Barbell_Curl'],
  ['Barbell Curl', 'Barbell_Curl'],
  ['Hammer Curl (Dumbbell)', 'Hammer_Curls'],
  ['Incline Curl (Dumbbell)', 'Incline_Dumbbell_Curl'],
  ['Incline Dumbbell Curl', 'Incline_Dumbbell_Curl'],
  ['Preacher Curl (Barbell)', 'Preacher_Curl'],
  ['Concentration Curl (Dumbbell)', 'Concentration_Curls'],
  ['Triceps Pushdown (Cable - Straight Bar)', 'Triceps_Pushdown'],
  ['Triceps Pushdown (Cable)', 'Triceps_Pushdown'],
  ['Triceps Pushdown (Cable - Rope)', 'Triceps_Pushdown_-_Rope_Attachment'],
  ['Triceps Pushdown (Cable - V Bar)', 'Triceps_Pushdown_-_V-Bar_Attachment'],
  ['Triceps Extension (Dumbbell)', 'Standing_Dumbbell_Triceps_Extension'],
  ['Overhead Triceps Extension (Dumbbell)', 'Standing_Dumbbell_Triceps_Extension'],
  ['Lying Triceps Extension (EZ Bar)', 'EZ-Bar_Skullcrusher'],
  ['Skull Crusher (Barbell)', 'EZ-Bar_Skullcrusher'],
  ['Skull Crusher (Dumbbell)', 'Lying_Dumbbell_Tricep_Extension'],
  ['Wrist Curl (Dumbbell)', 'Seated_Dumbbell_Palms-Down_Wrist_Curl'],
  // Core
  ['Crunch', 'Crunches'],
  ['Sit Up', 'Sit-Up'],
  ['Plank', 'Plank'],
  ['Hanging Leg Raise', 'Hanging_Leg_Raise'],
  ['Russian Twist', 'Russian_Twist'],
  ['Ab Wheel Rollout', 'Ab_Roller'],
  ['Reverse Crunch', 'Reverse_Crunch'],
  ['Cable Crunch', 'Rope_Crunch'],
  // Full body and carries
  ['Farmer’s Walk', 'Farmers_Walk'],
  ['Farmers Walk', 'Farmers_Walk'],
  ['Mountain Climber', 'Mountain_Climbers'],
  ['Power Clean (Barbell)', 'Power_Clean'],
  ['Clean (Barbell)', 'Clean'],
  ['Snatch (Barbell)', 'Snatch'],
];

const CURATED_SLUG_BY_KEY = new Map<string, string>();
for (const [name, slug] of RAW_FOREIGN_EXERCISE_SLUGS) {
  const key = tokenizeExerciseText(name).join(' ');
  if (!CURATED_SLUG_BY_KEY.has(key)) {
    CURATED_SLUG_BY_KEY.set(key, slug);
  }
}

/** The catalogue slug for a normalised name key, or undefined when the name is not curated. */
export function curatedExerciseSlug(key: string): string | undefined {
  return CURATED_SLUG_BY_KEY.get(key);
}

/** Every curated slug, for the bundled-catalogue check. */
export function curatedExerciseSlugs(): string[] {
  return [...new Set(CURATED_SLUG_BY_KEY.values())];
}

/** Raw name, slug pairs, for tests that check the table itself. */
export function rawCuratedExerciseNames(): readonly (readonly [string, string])[] {
  return RAW_FOREIGN_EXERCISE_SLUGS;
}
