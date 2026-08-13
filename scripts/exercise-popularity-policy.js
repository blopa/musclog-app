/**
 * Stable free-exercise-db mappings for the catalogue's popular-exercise flag.
 *
 * free-exercise-db has no popularity data of its own. This list was frozen on
 * 2026-08-14 from usage-based sources rather than editorial "best" lists:
 *
 * - Strength Level's global exercise order, based on 195M+ community lifts:
 *   https://strengthlevel.com/strength-standards
 * - Fitbod's top-ten order, based on sets logged by more than 10M users:
 *   https://fitbod.me/exercises
 * - StrengthLog's 2025 top 25, based on millions of workouts from 700K+ users:
 *   https://www.strengthlog.com/most-popular-exercises/
 *
 * The first list maps the top 105 Strength Level movements to one catalogue
 * exercise each. Ranks 25, 66, 68, 72, 78, 84, and 102 are intentionally
 * omitted because this catalogue has no one-to-one equivalent. Fitbod's
 * Dumbbell Skullcrusher and StrengthLog's Face Pull then complete the top 100;
 * both rank highly in logged workout sets but fall outside Strength Level's
 * strength-standard cutoff. Do not assign one source movement to several local
 * variants or add category quotas: this flag represents observed popularity,
 * not an editorial recommendation.
 */

const STRENGTH_LEVEL_POPULAR_EXERCISES = [
  [1, 'Barbell_Bench_Press_-_Medium_Grip'],
  [2, 'Barbell_Squat'],
  [3, 'Barbell_Deadlift'],
  [4, 'Barbell_Shoulder_Press'],
  [5, 'Pullups'],
  [6, 'Dumbbell_Bench_Press'],
  [7, 'Dumbbell_Bicep_Curl'],
  [8, 'Pushups'],
  [9, 'Leg_Press'],
  [10, 'Barbell_Curl'],
  [11, 'Incline_Dumbbell_Press'],
  [12, 'Barbell_Incline_Bench_Press_-_Medium_Grip'],
  [13, 'Dips_-_Triceps_Version'],
  [14, 'Bent_Over_Barbell_Row'],
  [15, 'Dumbbell_Shoulder_Press'],
  [16, 'Wide-Grip_Lat_Pulldown'],
  [17, 'Front_Barbell_Squat'],
  [18, 'Trap_Bar_Deadlift'],
  [19, 'Chin-Up'],
  [20, 'Barbell_Hip_Thrust'],
  [21, 'Side_Lateral_Raise'],
  [22, 'Leg_Extensions'],
  [23, 'Romanian_Deadlift'],
  [24, 'Power_Clean'],
  [26, 'One-Arm_Dumbbell_Row'],
  [27, 'Standing_Military_Press'],
  [28, 'Sumo_Deadlift'],
  [29, 'Leverage_Chest_Press'],
  [30, 'Triceps_Pushdown'],
  [31, 'Hammer_Curls'],
  [32, 'Seated_Cable_Rows'],
  [33, 'Crunches'],
  [34, 'Sit-Up'],
  [35, 'Seated_Dumbbell_Press'],
  [36, 'Muscle_Up'],
  [37, 'Hack_Squat'],
  [38, 'Bodyweight_Squat'],
  [39, 'Machine_Shoulder_Military_Press'],
  [40, 'Butterfly'],
  [41, 'Split_Squat_with_Dumbbells'],
  [42, 'Clean_and_Jerk'],
  [43, 'Seated_Leg_Curl'],
  [44, 'EZ-Bar_Curl'],
  [45, 'Lying_Triceps_Press'],
  [46, 'Single-Arm_Push-Up'],
  [47, 'Close-Grip_Barbell_Bench_Press'],
  [48, 'Snatch'],
  [49, 'Preacher_Curl'],
  [50, 'Seated_Barbell_Military_Press'],
  [51, 'Goblet_Squat'],
  [52, 'Barbell_Shrug'],
  [53, 'T-Bar_Row_with_Handle'],
  [54, 'Clean'],
  [55, 'Lying_Leg_Curls'],
  [56, 'V-Bar_Pullup'],
  [57, 'Standing_Calf_Raises'],
  [58, 'Dumbbell_Flyes'],
  [59, 'Push_Press'],
  [60, 'Thigh_Adductor'],
  [61, 'Push-Ups_-_Close_Triceps_Position'],
  [62, 'Smith_Machine_Bench_Press'],
  [63, 'Dumbbell_Shrug'],
  [64, 'Decline_Barbell_Bench_Press'],
  [65, 'Dumbbell_Lunges'],
  [67, 'Hanging_Leg_Raise'],
  [69, 'Triceps_Pushdown_-_Rope_Attachment'],
  [70, 'Dumbbell_Incline_Row'],
  [71, 'Stiff-Legged_Dumbbell_Deadlift'],
  [73, 'Clean_and_Press'],
  [74, 'Smith_Machine_Squat'],
  [75, 'Rack_Pulls'],
  [76, 'Standing_Dumbbell_Triceps_Extension'],
  [77, 'Box_Squat'],
  [79, 'Incline_Dumbbell_Curl'],
  [80, 'Standing_Biceps_Cable_Curl'],
  [81, 'Seated_Calf_Raise'],
  [82, 'Close-Grip_Front_Lat_Pulldown'],
  [83, 'Upright_Barbell_Row'],
  [85, 'Machine_Bicep_Curl'],
  [86, 'Zercher_Squats'],
  [87, 'Cable_Crossover'],
  [88, 'Dip_Machine'],
  [89, 'Ab_Crunch_Machine'],
  [90, 'Standing_Low-Pulley_Deltoid_Raise'],
  [91, 'Stiff-Legged_Barbell_Deadlift'],
  [92, 'Star_Jump'],
  [93, 'Arnold_Dumbbell_Press'],
  [94, 'Hang_Clean'],
  [95, 'Reverse_Flyes'],
  [96, 'Concentration_Curls'],
  [97, 'Incline_Dumbbell_Flyes'],
  [98, 'Decline_Push-Up'],
  [99, 'Hyperextensions_Back_Extensions'],
  [100, 'Cable_Crunch'],
  [101, 'Front_Dumbbell_Raise'],
  [103, 'Standing_Overhead_Barbell_Triceps_Extension'],
  [104, 'Good_Morning'],
  [105, 'Floor_Press'],
];

const CROSS_SOURCE_POPULAR_EXERCISE_SLUGS = ['Lying_Dumbbell_Tricep_Extension', 'Face_Pull'];

const POPULAR_EXERCISE_SLUGS = new Set([
  ...STRENGTH_LEVEL_POPULAR_EXERCISES.map(([, slug]) => slug),
  ...CROSS_SOURCE_POPULAR_EXERCISE_SLUGS,
]);

module.exports = {
  CROSS_SOURCE_POPULAR_EXERCISE_SLUGS,
  POPULAR_EXERCISE_SLUGS,
  STRENGTH_LEVEL_POPULAR_EXERCISES,
};
