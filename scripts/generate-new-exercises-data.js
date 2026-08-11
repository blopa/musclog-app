#!/usr/bin/env node
/* eslint-disable no-undef */

/**
 * Generates `data/newExercisesData.json` — the full free-exercise-db catalogue
 * (873 exercises, CC0) re-expressed in this repo's exercise schema.
 *
 * The output is NOT wired into the app. It exists so the catalogue can be
 * reviewed and merged deliberately; nothing imports it yet.
 *
 * Usage:
 *   node scripts/generate-new-exercises-data.js [path-to-free-exercise-db]
 *
 * The source repo is expected at `../free-exercise-db` relative to this repo
 * unless a path is given. Only `dist/exercises.json` is read.
 *
 * Field derivation:
 *   - `exerciseIndex`  continues after the bundled catalogue (257+) so the two
 *                      files can be concatenated without reusing a primary key.
 *   - `muscleGroup`    free-exercise-db's primary muscle folded into the nine
 *                      coarse `EXERCISE_JSON_MUSCLE_GROUPS` names.
 *   - `equipmentType`  their `equipment` mapped onto `EquipmentType`, with the
 *                      Smith-machine family split out of `machine`.
 *   - `mechanicType`   their `category` first (stretching/plyometrics/cardio),
 *                      then their `mechanic` (compound/isolation).
 *   - `targetMuscles`  primary + secondary muscles mapped onto the
 *                      `MUSCLE_SEED_DATA` vocabulary, refined by name for
 *                      deltoid heads and obliques.
 *   - `loadMultiplier` an exercise that already exists in the bundled catalogue
 *                      inherits its value verbatim (see MUSCLOG_ANCHORS); the
 *                      rest are derived from the movement family by the rules
 *                      in AGENTS.md — bodyweight entries carry the fraction of
 *                      body mass moved, holds and cardio stay a hard 0.
 */

const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..');
const sourceRepo = process.argv[2] || path.join(repoRoot, '..', 'free-exercise-db');
const sourceFile = path.join(sourceRepo, 'dist', 'exercises.json');
const outputFile = path.join(repoRoot, 'data', 'newExercisesData.json');

const INDEX_OFFSET = 256;

// ---------------------------------------------------------------------------
// equipmentType
// ---------------------------------------------------------------------------

const EQUIPMENT_BY_SOURCE = {
  bands: 'resistance_band',
  barbell: 'barbell',
  'body only': 'bodyweight',
  cable: 'cable',
  dumbbell: 'dumbbell',
  'e-z curl bar': 'barbell',
  'exercise ball': 'other',
  'foam roll': 'other',
  kettlebells: 'kettlebell',
  machine: 'plate_machine',
  'medicine ball': 'medicine_ball',
  other: 'other',
  null: 'bodyweight',
};

// free-exercise-db files a lot of unlike things under `other`. These are the
// ones where a truer equipment type is unambiguous from the name.
const EQUIPMENT_OVERRIDES = {
  'Atlas Stone Trainer': 'other',
  'Axle Deadlift': 'barbell',
  'Band Assisted Pull-Up': 'resistance_band',
  'Bodyweight Flyes': 'bodyweight',
  'Bodyweight Mid Row': 'bodyweight',
  'Dips - Chest Version': 'bodyweight',
  'Front Plate Raise': 'other',
  'Gironda Sternum Chins': 'bodyweight',
  'Kipping Muscle Up': 'bodyweight',
  'London Bridges': 'bodyweight',
  'Mixed Grip Chin': 'bodyweight',
  'Muscle Up': 'bodyweight',
  'One Arm Chin-Up': 'bodyweight',
  'One Handed Hang': 'bodyweight',
  'Overhead Lat': 'bodyweight',
  'Parallel Bar Dip': 'bodyweight',
  'Ring Dips': 'bodyweight',
  'Rocky Pull-Ups/Pulldowns': 'bodyweight',
  'Rope Climb': 'bodyweight',
  'Side To Side Chins': 'bodyweight',
  'Suspended Fallout': 'bodyweight',
  'Suspended Push-Up': 'bodyweight',
  'Suspended Reverse Crunch': 'bodyweight',
  'Suspended Row': 'bodyweight',
  'Suspended Split Squat': 'bodyweight',
  'Trap Bar Deadlift': 'barbell',
  'Weighted Bench Dip': 'bodyweight',
  'Weighted Pull Ups': 'bodyweight',
  'Weighted Sit-Ups - With Bands': 'resistance_band',
};

function resolveEquipment(entry) {
  if (EQUIPMENT_OVERRIDES[entry.name]) {
    return EQUIPMENT_OVERRIDES[entry.name];
  }
  if (entry.category === 'cardio') {
    return 'cardio';
  }
  if (/\bSmith\b/.test(entry.name)) {
    return 'smith_machine';
  }
  return EQUIPMENT_BY_SOURCE[String(entry.equipment)] ?? 'other';
}

// ---------------------------------------------------------------------------
// mechanicType
// ---------------------------------------------------------------------------

const MECHANIC_BY_CATEGORY = {
  cardio: 'cardio',
  plyometrics: 'plyometric',
  stretching: 'stretching',
};

// The four `strength` entries free-exercise-db leaves without a mechanic.
const MECHANIC_OVERRIDES = {
  'Ankle Circles': 'mobility',
  'Arm Circles': 'mobility',
  'Elbow Circles': 'mobility',
  'Shoulder Circles': 'mobility',
  'Wrist Circles': 'mobility',
  'Wrist Rotations with Straight Bar': 'mobility',
};

function resolveMechanic(entry) {
  if (MECHANIC_OVERRIDES[entry.name]) {
    return MECHANIC_OVERRIDES[entry.name];
  }
  if (MECHANIC_BY_CATEGORY[entry.category]) {
    return MECHANIC_BY_CATEGORY[entry.category];
  }
  if (entry.mechanic === 'compound' || entry.mechanic === 'isolation') {
    return entry.mechanic;
  }
  return 'other';
}

// ---------------------------------------------------------------------------
// muscleGroup — the nine coarse EXERCISE_JSON_MUSCLE_GROUPS names
// ---------------------------------------------------------------------------

const GROUP_BY_PRIMARY = {
  abdominals: 'abdomen',
  abductors: 'legs',
  adductors: 'legs',
  biceps: 'arms',
  calves: 'legs',
  chest: 'chest',
  forearms: 'arms',
  glutes: 'glutes',
  hamstrings: 'legs',
  lats: 'back',
  'lower back': 'back',
  'middle back': 'back',
  // No neck muscle group exists in this schema; shoulders is the nearest.
  neck: 'shoulders',
  quadriceps: 'legs',
  shoulders: 'shoulders',
  // The bundled catalogue files every shrug and upright row under shoulders.
  traps: 'shoulders',
  triceps: 'arms',
};

const FULL_BODY_PATTERNS =
  /\b(clean|snatch|jerk|thruster|turkish get-up|burpee|swing|yoke|atlas stone|tire flip|keg|sandbag|log lift|conan|rickshaw|farmer|sled|prowler|deadlift)\b/i;

// free-exercise-db files some plainly regional movements under the olympic and
// strongman categories (`Romanian Deadlift from Deficit` is "olympic
// weightlifting"), and names an accessory after the lift it assists
// (`Front Squat (Clean Grip)`, `Sled Reverse Flye`). These veto the whole-body
// reading and send the exercise back to its primary muscle's group.
const REGIONAL_VETO =
  /\b(stiff|romanian|good morning|calf raise|flye|fly|triceps extension|shrug|deltoid|muscle up|row)\b/i;
const SQUAT_VETO = /\bsquats?\b/i;
// ...except where the squat is the lift rather than the accessory. The bundled
// catalogue files Overhead Squat under full_body, so this keeps parity with it.
const SQUAT_KEEP = /overhead squat|squat (jerk|clean|snatch)|turkish get-up/i;

function isRegionalMovement(entry) {
  // An isolation exercise is regional by definition, whatever it is named after.
  if (entry.mechanic === 'isolation') {
    return true;
  }
  if (REGIONAL_VETO.test(entry.name)) {
    return true;
  }
  return SQUAT_VETO.test(entry.name) && !SQUAT_KEEP.test(entry.name);
}

// The bundled catalogue splits cardio: machines that drive the whole body are
// full_body, the rest sit with the legs that do the work.
const FULL_BODY_CARDIO = /rowing|elliptical|rope jumping/i;

const CORE_PATTERNS =
  /\b(plank|bridge|pallof|vacuum|hollow|superman|dead bug|fallout|rollout|roller|russian twist|wood chop|woodchop|judo flip|standing cable lift|windmill|bent press|side bend|suitcase|spider crawl|isometric wipers)\b/i;

function resolveMuscleGroup(entry, equipmentType) {
  const primary = entry.primaryMuscles[0];

  if (equipmentType === 'cardio') {
    return FULL_BODY_CARDIO.test(entry.name) ? 'full_body' : (GROUP_BY_PRIMARY[primary] ?? 'legs');
  }

  // Olympic lifts, loaded carries and strongman implements move the whole body;
  // their primary muscle in the source data (usually hamstrings) understates it.
  const isWholeBodyLift =
    entry.category === 'olympic weightlifting' ||
    entry.category === 'strongman' ||
    FULL_BODY_PATTERNS.test(entry.name);

  if (isWholeBodyLift && !isRegionalMovement(entry)) {
    return 'full_body';
  }
  if (primary === 'abdominals' && CORE_PATTERNS.test(entry.name)) {
    return 'core';
  }
  if (primary === 'abdominals' && entry.force === 'static') {
    return 'core';
  }
  if (primary === 'glutes' || /\bglute kickback\b/i.test(entry.name)) {
    return 'glutes';
  }

  return GROUP_BY_PRIMARY[primary] ?? 'full_body';
}

// ---------------------------------------------------------------------------
// targetMuscles — the MUSCLE_SEED_DATA vocabulary
// ---------------------------------------------------------------------------

const MUSCLE_BY_SOURCE = {
  abdominals: 'rectus_abdominis',
  abductors: 'abductors',
  adductors: 'adductors',
  biceps: 'biceps',
  calves: 'calves',
  chest: 'pectoralis_major',
  forearms: 'forearms',
  glutes: 'glutes',
  hamstrings: 'hamstrings',
  lats: 'lats',
  'lower back': 'erector_spinae',
  'middle back': 'rhomboids',
  // No neck muscle exists in MUSCLE_SEED_DATA; the upper traps are the closest.
  neck: 'upper_traps',
  quadriceps: 'quadriceps',
  shoulders: 'shoulders',
  traps: 'traps',
  triceps: 'triceps',
};

const LATERAL_DELT = /\b(lateral raise|side lateral|deltoid raise|side laterals|scaption)\b/i;
const POSTERIOR_DELT =
  /\b(rear delt|rear lateral|reverse fly|reverse flye|reverse flyes|face pull|rear-delt|back flyes|pull apart|rear pull)\b/i;
const ANTERIOR_DELT = /\b(press|front raise|front dumbbell raise|front cable raise|jerk|push)\b/i;
const OBLIQUES =
  /\b(oblique|twist|side bend|side crunch|wood chop|woodchop|judo|windmill|side jackknife|heel touch|rotation|side plank|side bridge)\b/i;
const DEEP_CORE =
  /\b(plank|bridge|vacuum|hollow|dead bug|pallof|fallout|rollout|roller|bird dog)\b/i;

function resolveTargetMuscles(entry) {
  const muscles = [];
  const push = (m) => {
    if (m && !muscles.includes(m)) {
      muscles.push(m);
    }
  };

  for (const source of entry.primaryMuscles) {
    if (source === 'shoulders') {
      if (LATERAL_DELT.test(entry.name)) {
        push('lateral_deltoid');
      } else if (POSTERIOR_DELT.test(entry.name)) {
        push('posterior_deltoid');
      } else if (ANTERIOR_DELT.test(entry.name)) {
        push('anterior_deltoid');
      } else {
        push('shoulders');
      }
      continue;
    }
    push(MUSCLE_BY_SOURCE[source]);
  }

  if (entry.primaryMuscles.includes('abdominals')) {
    if (OBLIQUES.test(entry.name)) {
      push('external_obliques');
    }
    if (DEEP_CORE.test(entry.name)) {
      push('transverse_abdominis');
    }
  }

  for (const source of entry.secondaryMuscles) {
    if (source === 'shoulders') {
      push(POSTERIOR_DELT.test(entry.name) ? 'posterior_deltoid' : 'anterior_deltoid');
      continue;
    }
    push(MUSCLE_BY_SOURCE[source]);
  }

  return muscles;
}

// ---------------------------------------------------------------------------
// loadMultiplier
// ---------------------------------------------------------------------------

// free-exercise-db name -> the bundled catalogue exercise it is the same
// movement as. These inherit `loadMultiplier` verbatim, so the new catalogue
// stays anchored to the scale already established in `exercisesData.json`.
const MUSCLOG_ANCHORS = {
  'Ab Crunch Machine': 'Crunch Machine',
  'Ab Roller': 'Ab Wheel Rollout',
  'Alternate Hammer Curl': 'Hammer Curl',
  'Alternate Incline Dumbbell Curl': 'Incline Dumbbell Curl',
  'Alternating Cable Shoulder Press': 'Cable One Arm Shoulder Press',
  'Alternating Renegade Row': 'Renegade Row',
  'Arnold Dumbbell Press': 'Arnold Press',
  'Barbell Bench Press - Medium Grip': 'Bench Press',
  'Barbell Deadlift': 'Deadlift',
  'Barbell Full Squat': 'Barbell Back Squat',
  'Barbell Glute Bridge': 'Hip Thrust',
  'Barbell Hip Thrust': 'Hip Thrust',
  'Barbell Incline Bench Press - Medium Grip': 'Inclined Bench Press',
  'Barbell Seated Calf Raise': 'Seated Calf Raise',
  'Barbell Shoulder Press': 'Overhead Shoulder Press',
  'Barbell Shrug': 'Barbell Shrug',
  'Barbell Shrug Behind The Back': 'Barbell Shrug',
  'Barbell Squat': 'Squat',
  'Barbell Step Ups': 'Step-Up',
  'Barbell Walking Lunge': 'Walking Lunge',
  'Battling Ropes': 'Battle Ropes',
  'Bench Dips': 'Bench Dip',
  'Bent Over Barbell Row': 'Bent Over Row',
  'Bent Over Low-Pulley Side Lateral': 'Cable One Arm Rear Delt',
  'Bent Over One-Arm Long Bar Row': 'Landmine Row',
  'Bent Over Two-Arm Long Bar Row': 'Landmine Row',
  'Bent-Arm Dumbbell Pullover': 'Dumbbell Pullover',
  Bicycling: 'Cycling',
  'Bicycling, Stationary': 'Cycling',
  'Box Squat': 'Box Squat',
  'Box Squat with Bands': 'Box Squat',
  'Box Squat with Chains': 'Box Squat',
  'Butt Lift (Bridge)': 'Glute Bridge',
  Butterfly: 'Pec Fly Machine',
  'Cable Chest Press': 'Cable Chest Press',
  'Cable Crossover': 'Cable Crossover',
  'Cable Crunch': 'Cable Crunch',
  'Cable Deadlifts': 'Cable Romanian Deadlift',
  'Cable Hammer Curls - Rope Attachment': 'Cable Standing Hammer Curl',
  'Cable Hip Adduction': 'Cable Hip Adduction',
  'Cable Incline Pushdown': 'Cable Pullover',
  'Cable Internal Rotation': 'Cable Internal Rotator',
  'Cable Iron Cross': 'Cable Pec Fly',
  'Cable One Arm Tricep Extension': 'Cable One Arm Push Down',
  'Cable Rear Delt Fly': 'Cable Reverse Fly',
  'Cable Reverse Crunch': 'Cable Reverse Ab Crunch',
  'Cable Rope Overhead Triceps Extension': 'Cable Overhead Tricep Extension',
  'Cable Rope Rear-Delt Rows': 'Cable Seated Rear Delt Row',
  'Cable Russian Twists': 'Russian Twist',
  'Cable Seated Lateral Raise': 'Cable Lateral Raise',
  'Cable Shoulder Press': 'Cable Standing Shoulder Press',
  'Cable Shrugs': 'Cable Shrugs',
  'Cable Wrist Curl': 'Cable Wrist Curl',
  'Chin-Up': 'Chin-Up',
  Clean: 'Squat Clean',
  'Clean and Jerk': 'Clean and Jerk',
  'Clean and Press': 'Clean and Press',
  'Clean from Blocks': 'Squat Clean',
  'Clean Pull': 'Clean Pull',
  'Close-Grip Barbell Bench Press': 'Close-Grip Bench Press',
  'Close-Grip EZ Bar Curl': 'EZ Bar Curl',
  'Close-Grip Front Lat Pulldown': 'Narrow Grip Lat Pulldown',
  'Close-Grip Push-Up off of a Dumbbell': 'Diamond Push-Up',
  'Close-Grip Standing Barbell Curl': 'Barbell Curl',
  'Concentration Curls': 'Concentration Biceps',
  'Dead Bug': 'Dead Bug',
  'Decline Barbell Bench Press': 'Declined Bench Press',
  'Decline Dumbbell Bench Press': 'Decline Dumbbell Bench Press',
  'Decline Reverse Crunch': 'Reverse Crunch',
  'Deficit Deadlift': 'Deficit Deadlift',
  'Dips - Chest Version': 'Dips',
  'Dips - Triceps Version': 'Dips',
  'Donkey Calf Raises': 'Donkey Calf Raise',
  'Dumbbell Alternate Bicep Curl': 'Bicep Curl',
  'Dumbbell Bench Press': 'Dumbbell Bench Press',
  'Dumbbell Bench Press with Neutral Grip': 'Dumbbell Bench Press',
  'Dumbbell Bicep Curl': 'Bicep Curl',
  'Dumbbell Flyes': 'Dumbbell Fly',
  'Dumbbell Lunges': 'Forward Lunge',
  'Dumbbell One-Arm Shoulder Press': 'Single Arm Dumbbell Press',
  'Dumbbell Rear Lunge': 'Reverse Lunge',
  'Dumbbell Seated One-Leg Calf Raise': 'Seated Calf Raise',
  'Dumbbell Shoulder Press': 'Dumbbell Shoulder Press',
  'Dumbbell Shrug': 'Dumbbell Shrug',
  'Dumbbell Step Ups': 'Dumbbell Step-Up',
  'Elliptical Trainer': 'Elliptical Trainer',
  'External Rotation with Cable': 'Cable External Rotator',
  'EZ-Bar Curl': 'EZ Bar Curl',
  'EZ-Bar Skullcrusher': 'Skull Crusher',
  'Face Pull': 'Cable Face Pull',
  "Farmer's Walk": "Farmer's Walk",
  'Flat Bench Cable Flyes': 'Cable Pec Fly',
  'Flat Bench Lying Leg Raise': 'Lying Leg Raise',
  'Floor Glute-Ham Raise': 'Glute-Ham Raise',
  'Floor Press': 'Floor Press',
  'Floor Press with Chains': 'Floor Press',
  'Front Barbell Squat': 'Front Squat',
  'Front Box Jump': 'Box Jump',
  'Front Cable Raise': 'Cable Front Raise',
  'Front Dumbbell Raise': 'Front Raise',
  'Front Squat (Clean Grip)': 'Front Squat',
  'Full Range-Of-Motion Lat Pulldown': 'Lat Pulldown',
  'Glute Ham Raise': 'Glute-Ham Raise',
  'Glute Kickback': 'Bodyweight Quadruped Glute Kickback',
  'Goblet Squat': 'Goblet Squat',
  'Good Morning': 'Good Morning',
  'Good Morning off Pins': 'Good Morning',
  'Hack Squat': 'Hack Squat',
  'Hammer Curls': 'Hammer Curl',
  'Hang Clean': 'Hang Clean',
  'Hang Clean - Below the Knees': 'Hang Clean',
  'Hang Snatch': 'Hang Snatch',
  'Hang Snatch - Below Knees': 'Hang Snatch',
  'Hanging Leg Raise': 'Hanging Leg Raise',
  'Heaving Snatch Balance': 'Snatch Balance',
  'Hip Extension with Bands': 'Banded Glute Kickback',
  'Incline Cable Chest Press': 'Cable Seated Incline Press',
  'Incline Cable Flye': 'Cable Low-to-High Fly',
  'Incline Dumbbell Curl': 'Incline Dumbbell Curl',
  'Incline Dumbbell Flyes': 'Incline Dumbbell Fly',
  'Incline Dumbbell Flyes - With A Twist': 'Incline Dumbbell Fly',
  'Incline Dumbbell Press': 'Incline Dumbbell Press',
  'Inverted Row': 'Inverted Row',
  'Inverted Row with Straps': 'Inverted Row',
  'Jefferson Squats': 'Jefferson Deadlift',
  'Jogging, Treadmill': 'Running',
  'Kettlebell One-Legged Deadlift': 'Single Leg Romanian Deadlift',
  'Kettlebell Thruster': 'Dumbbell Thruster',
  'Kettlebell Turkish Get-Up (Lunge style)': 'Turkish Get-Up',
  'Kettlebell Turkish Get-Up (Squat style)': 'Turkish Get-Up',
  'Kneeling High Pulley Row': 'Cable Kneeling High Row',
  'Kneeling Single-Arm High Pulley Row': 'Cable Kneeling High Row',
  'Knee/Hip Raise On Parallel Bars': 'Hanging Knee Raise',
  'Leg Extensions': 'Leg Extension Machine',
  'Leg Press': 'Leg Press Machine',
  'Leverage Chest Press': 'Chest Press Machine',
  'Leverage High Row': 'Unilateral High Row Machine',
  'Leverage Iso Row': 'Unilateral Row Machine',
  'Leverage Shoulder Press': 'Machine Shoulder Press',
  'Low Cable Crossover': 'Cable Low-to-High Fly',
  'Low Pulley Row To Neck': 'Cable Seated Rear Delt Row',
  'Lying Cambered Barbell Row': 'Bent Over Row',
  'Lying Leg Curls': 'Lying Leg Curl',
  'Lying T-Bar Row': 'T-Bar Row',
  'Lying Triceps Press': 'Skull Crusher',
  'Machine Bench Press': 'Chest Press Machine',
  'Machine Shoulder (Military) Press': 'Machine Shoulder Press',
  'Mixed Grip Chin': 'Chin-Up',
  'Mountain Climbers': 'Mountain Climbers',
  'Muscle Snatch': 'Muscle Snatch',
  'Narrow Stance Hack Squats': 'Hack Squat',
  'Natural Glute Ham Raise': 'Nordic Hamstring Curl',
  'Olympic Squat': 'Barbell Back Squat',
  'One-Arm Dumbbell Row': 'Single-Arm Dumbbell Row',
  'One-Arm Kettlebell Clean and Jerk': 'Kettlebell Clean and Press',
  'One-Arm Kettlebell Snatch': 'One Arm Kettlebell Snatch',
  'One-Arm Kettlebell Split Snatch': 'One Arm Kettlebell Snatch',
  'One-Arm Kettlebell Swings': 'Kettlebell Swing',
  'One-Arm Long Bar Row': 'Landmine Row',
  'One-Arm Medicine Ball Slam': 'Medicine Ball Slam',
  'One-Legged Cable Kickback': 'Cable Glute Kickback',
  'Overhead Slam': 'Medicine Ball Slam',
  'Overhead Squat': 'Overhead Squat',
  'Pallof Press': 'Pallof Press',
  'Pallof Press With Rotation': 'Pallof Press',
  Plank: 'Plank',
  'Power Clean': 'Power Clean',
  'Power Clean from Blocks': 'Power Clean',
  'Power Jerk': 'Push Jerk',
  'Power Snatch': 'Power Snatch',
  'Power Snatch from Blocks': 'Power Snatch',
  'Preacher Curl': 'Preacher Curl',
  Pullups: 'Pull-Up',
  'Push Press': 'Push Press',
  'Push-Ups - Close Triceps Position': 'Diamond Push-Up',
  Pushups: 'Push-Up',
  'Pushups (Close and Wide Hand Positions)': 'Push-Up',
  'Rack Pull with Bands': 'Rack Pull',
  'Rack Pulls': 'Rack Pull',
  'Recumbent Bike': 'Cycling',
  'Reverse Crunch': 'Reverse Crunch',
  'Reverse Flyes': 'Bent-Over Dumbbell Rear Delt Fly',
  'Reverse Grip Bent-Over Rows': 'Bent Over Row',
  'Reverse Grip Triceps Pushdown': 'Cable Underhand Push Down',
  'Reverse Machine Flyes': 'Reverse Pec Deck Fly',
  'Reverse Triceps Bench Press': 'Reverse Grip Bench Press',
  'Romanian Deadlift': 'Romanian Deadlift',
  'Romanian Deadlift from Deficit': 'Romanian Deadlift',
  'Rope Crunch': 'Cable Crunch',
  'Rope Jumping': 'Jump Rope',
  'Rope Straight-Arm Pulldown': 'Straight-Arm Pulldown',
  'Rowing, Stationary': 'Rowing Machine',
  'Running, Treadmill': 'Running',
  'Russian Twist': 'Russian Twist',
  'Seated Bent-Over One-Arm Dumbbell Triceps Extension':
    'Seated Bent-Over Dumbbell Triceps Kickback',
  'Seated Bent-Over Rear Delt Raise': 'Bent-Over Dumbbell Rear Delt Fly',
  'Seated Bent-Over Two-Arm Dumbbell Triceps Extension': 'Two-Arm Dumbbell Triceps Kickback',
  'Seated Barbell Military Press': 'Overhead Shoulder Press',
  'Seated Cable Rows': 'Seated Row',
  'Seated Cable Shoulder Press': 'Cable Seated Shoulder Press',
  'Seated Calf Raise': 'Seated Calf Raise',
  'Seated Dumbbell Press': 'Dumbbell Shoulder Press',
  'Seated Good Mornings': 'Good Morning',
  'Seated Leg Curl': 'Leg Curl Machine',
  'Seated One-arm Cable Pulley Rows': 'Cable Bench One Arm Row',
  'Seated Triceps Press': 'Tricep Overhead Extension',
  'Shotgun Row': 'Cable Standing One Arm Row',
  'Side Bridge': 'Side Plank',
  'Side Lateral Raise': 'Lateral Raise',
  'Single Leg Glute Bridge': 'Glute Bridge',
  'Single-Arm Cable Crossover': 'Cable Pec Fly-Standing',
  'Single-Leg Leg Extension': 'Unilateral Leg Extension Machine',
  'Smith Machine Bench Press': 'Smith Machine Bench Press',
  'Smith Machine Squat': 'Smith Machine Squat',
  Snatch: 'Snatch',
  'Snatch Balance': 'Snatch Balance',
  'Snatch from Blocks': 'Snatch',
  'Snatch Pull': 'Snatch Pull',
  'Speed Box Squat': 'Box Squat',
  'Split Jerk': 'Split Jerk',
  'Split Squat with Dumbbells': 'Bulgarian Split Squat',
  Stairmaster: 'Stair Climber',
  'Standing Barbell Calf Raise': 'Standing Calf Raise',
  'Standing Biceps Cable Curl': 'Cable Standing Arm Curl',
  'Standing Cable Chest Press': 'Cable Standing Chest Press',
  'Standing Cable Wood Chop': 'Cable Woodchopper',
  'Standing Calf Raises': 'Standing Calf Raise',
  'Standing Dumbbell Calf Raise': 'Seated Calf Raise',
  'Standing Dumbbell Press': 'Dumbbell Shoulder Press',
  'Standing Leg Curl': 'Unilateral Leg Curl Machine',
  'Standing Low-Pulley Deltoid Raise': 'Cable One Arm Lateral Raise',
  'Standing Low-Pulley One-Arm Triceps Extension': 'Cable One Arm Overhead Triceps Extension',
  'Standing Military Press': 'Overhead Shoulder Press',
  'Standing One-Arm Cable Curl': 'Cable One Arm Curl-Supinating',
  'Standing Bent-Over One-Arm Dumbbell Triceps Extension': 'Dumbbell Triceps Kickback',
  'Standing Bent-Over Two-Arm Dumbbell Triceps Extension': 'Two-Arm Dumbbell Triceps Kickback',
  'Standing Concentration Curl': 'Concentration Biceps',
  'Standing Dumbbell Triceps Extension': 'Tricep Overhead Extension',
  'Standing Palm-In One-Arm Dumbbell Press': 'Single Arm Dumbbell Press',
  'Step Mill': 'Stair Climber',
  'Stiff-Legged Dumbbell Deadlift': 'Dumbbell Romanian Deadlift',
  'Stiff Leg Barbell Good Morning': 'Good Morning',
  'Straight-Arm Dumbbell Pullover': 'Dumbbell Pullover',
  'Straight-Arm Pulldown': 'Straight-Arm Pulldown',
  'Standing Rope Crunch': 'Cable Crunch',
  'Sumo Deadlift': 'Sumo Deadlift',
  'Suspended Row': 'Inverted Row',
  'Suspended Split Squat': 'Bulgarian Split Squat',
  'T-Bar Row with Handle': 'T-Bar Row',
  'Thigh Abductor': 'Hip Abduction Machine',
  'Thigh Adductor': 'Hip Adduction Machine',
  'Trail Running/Walking': 'Running',
  'Trap Bar Deadlift': 'Trap Bar Deadlift',
  'Tricep Dumbbell Kickback': 'Dumbbell Triceps Kickback',
  'Triceps Overhead Extension with Rope': 'Cable Overhead Tricep Extension',
  'Triceps Pushdown': 'Cable Tricep Pushdown',
  'Triceps Pushdown - Rope Attachment': 'Cable Tricep Pushdown',
  'Triceps Pushdown - V-Bar Attachment': 'Cable Tricep Pushdown',
  'Underhand Cable Pulldowns': 'Supinated Lat Pulldown',
  'Upright Barbell Row': 'Upright Row',
  'Upright Cable Row': 'Cable Upright Row',
  'V-Bar Pulldown': 'Narrow Grip Lat Pulldown',
  'Walking, Treadmill': 'Treadmill',
  'Weighted Bench Dip': 'Bench Dip',
  'Weighted Sissy Squat': 'Sissy Squat',
  'Wide-Grip Lat Pulldown': 'Lat Pulldown',
  'Zercher Squats': 'Zercher Squat',
  'Zottman Curl': 'Zottman Curl',
  'Zottman Preacher Curl': 'Zottman Curl',
  'Bodyweight Walking Lunge': 'Walking Lunge',
  'Barbell Lunge': 'Forward Lunge',
  'Kettlebell Pistol Squat': 'Pistol Squat',
  'Smith Machine Pistol Squat': 'Pistol Squat',
  'Alternate Heel Touchers': 'Russian Twist',
  'Standing Cable Lift': 'Cable Woodchopper',
  'Cable Judo Flip': 'Cable Woodchopper',
  'Barbell Rear Delt Row': 'Bent Over Row',
  'Exercise Ball Crunch': 'Swiss Ball Crunch',
  'Wide-Grip Barbell Bench Press': 'Bench Press',
  'Wide-Grip Decline Barbell Bench Press': 'Declined Bench Press',
  'Landmine Linear Jammer': 'Landmine Press',
  'Single-Arm Linear Jammer': 'Landmine Press',
  'Kettlebell Sumo High Pull': 'High Pull',
  'Push Press - Behind the Neck': 'Push Press',
  'Wide-Grip Standing Barbell Curl': 'Barbell Curl',
  'Barbell Curl': 'Barbell Curl',
  'Squat with Bands': 'Squat',
  'Squat with Chains': 'Squat',
  'Squats - With Bands': 'Squat',
  'Speed Squats': 'Squat',
  'Wide Stance Barbell Squat': 'Squat',
  'Narrow Stance Squats': 'Squat',
  'Deadlift with Bands': 'Deadlift',
  'Deadlift with Chains': 'Deadlift',
  'Sumo Deadlift with Bands': 'Sumo Deadlift',
  'Sumo Deadlift with Chains': 'Sumo Deadlift',
  'Stiff-Legged Barbell Deadlift': 'Romanian Deadlift',
  'Clean Deadlift': 'Deadlift',
  'Snatch Deadlift': 'Deadlift',
  'Bench Press - With Bands': 'Bench Press',
  'Bench Press with Chains': 'Bench Press',
  'Bench Press - Powerlifting': 'Bench Press',
};

// Ordered movement-family rules, consulted only when an exercise has no anchor
// above. First match wins, so the specific patterns come before the general
// ones. Values follow AGENTS.md: a bodyweight-relative benchmark for loaded
// work, the fraction of body mass moved for bodyweight work.
const RULES_BY_EQUIPMENT = {
  barbell: [
    [/rack pull|block pull/i, 1.3],
    [/sumo deadlift/i, 1.8],
    [/deficit/i, 0.9],
    [/(stiff|straight).?leg|romanian/i, 1.0],
    [/deadlift/i, 1.8],
    [/hip thrust|glute bridge|kneeling squat|kneeling jump squat/i, 1.4],
    [/front squat|frankenstein/i, 0.85],
    [/box squat/i, 0.95],
    [/overhead squat/i, 0.5],
    [/zercher|jefferson/i, 0.85],
    [/hack squat/i, 1.0],
    [/(side split|one leg|single.?leg|split|elevated back lunge|lunge|step ups)/i, 0.6],
    [/squat to a bench|squat with plate|jump squat/i, 1.2],
    [/squat/i, 1.4],
    [/good morning|hanging bar good morning|wide stance stiff/i, 0.7],
    [/board press|pin press|reverse band bench/i, 1.05],
    [/guillotine|neck press/i, 0.75],
    [/decline.*(bench|press)/i, 1.1],
    [/incline.*(bench press|press)/i, 0.9],
    [/close.?grip.*(bench|press)/i, 0.9],
    [/floor press/i, 0.85],
    [/bench press/i, 1.0],
    [/jm press|decline close-grip/i, 0.5],
    [/skullcrusher|skull crusher|triceps extension|triceps press|lying close-grip/i, 0.3],
    [/pullover/i, 0.3],
    [/(clean|snatch) shrug/i, 0.9],
    [/shrug/i, 0.85],
    [/(pendlay|cambered|bench mid row|incline bench pull)/i, 0.85],
    [/long bar row|t-bar row/i, 0.9],
    [/row/i, 0.8],
    [/clean pull/i, 1.1],
    [/snatch pull/i, 0.9],
    [/power clean/i, 0.85],
    [/hang clean/i, 0.6],
    [/split clean|squat clean|\bclean\b/i, 0.75],
    [/muscle snatch/i, 0.45],
    [/power snatch/i, 0.55],
    [/hang snatch|split snatch/i, 0.5],
    [/snatch balance|jerk balance/i, 0.5],
    [/\bsnatch\b/i, 0.7],
    [/jerk dip|power jerk|squat jerk|rack delivery/i, 0.7],
    [/split jerk|\bjerk\b/i, 0.75],
    [/high pull/i, 0.6],
    [/push press/i, 0.55],
    [/behind neck|bradford|rocky press/i, 0.4],
    [/military press|shoulder press|anti-gravity press/i, 0.6],
    [/upright row/i, 0.4],
    [/front .*raise|shoulder raise|straight raises|car drivers/i, 0.15],
    [/preacher|spider curl/i, 0.25],
    [/reverse.*curl|drag curl/i, 0.3],
    [/wrist curl|finger curls|wrist rotation/i, 0.15],
    [/curl/i, 0.42],
    [/calf raise/i, 1.0],
    [/side bend|seated barbell twist|landmine 180/i, 0.3],
    [/ab rollout|rollout|press sit-up/i, 0.15],
    [/landmine|jammer/i, 0.5],
  ],
  dumbbell: [
    [/(stiff|straight).?leg|romanian/i, 0.5],
    [/squat to a bench|plie|dumbbell squat/i, 0.5],
    [/split squat/i, 0.4],
    [/lunge/i, 0.3],
    [/step ups|seated box jump/i, 0.35],
    [/calf raise/i, 0.8],
    [/shrug|middle back shrug/i, 0.5],
    [/incline.*(row)/i, 0.3],
    [/\brow\b/i, 0.4],
    [/decline.*(bench|press|flye)/i, 0.32],
    [/incline.*(bench|press)/i, 0.3],
    [/floor press|close-grip.*press|one arm dumbbell bench/i, 0.3],
    [/bench press|hammer grip incline/i, 0.35],
    [/around the world|flye|fly/i, 0.15],
    [/pullover/i, 0.3],
    [/arnold/i, 0.22],
    [/see-saw|alternating dumbbell press|palms-in dumbbell press/i, 0.25],
    [
      /one-arm.*press|palm-in one-arm|shoulder press|seated dumbbell press|standing dumbbell press|cuban press/i,
      0.25,
    ],
    [/upright row/i, 0.15],
    [
      /(lateral raise|side lateral|deltoid raise|iron cross|power partials|single dumbbell raise|dumbbell raise)/i,
      0.1,
    ],
    [/(rear lateral|rear delt|reverse flye)/i, 0.12],
    [/incline shoulder raise/i, 0.15],
    [/scaption|front.*raise|straight-arm front delt/i, 0.08],
    [/(external|internal) rotation|lying (pronation|supination)/i, 0.06],
    [/kickback|one-arm.*triceps|tate press|lying dumbbell tricep|tricep extension/i, 0.2],
    [/triceps.*extension|seated triceps|triceps press/i, 0.25],
    [/concentration/i, 0.22],
    [/preacher/i, 0.2],
    [/hammer|cross body hammer/i, 0.18],
    [/incline.*curl|prone incline curl|flexor incline/i, 0.18],
    [/zottman/i, 0.2],
    [/reverse curl/i, 0.18],
    [/curl/i, 0.35],
    [/wrist curl/i, 0.12],
    [/side bend|spell caster/i, 0.3],
    [/\bclean\b/i, 0.35],
    [/vertical swing|swing/i, 0.4],
  ],
  kettlebell: [
    [/windmill|bent press|pass between|figure 8|pirate ships/i, 0.2],
    [/turkish get-up/i, 0.2],
    [/front squats with two|overhead kettlebell squat|pistol squat/i, 0.4],
    [/high pull/i, 0.3],
    [/\brow\b/i, 0.4],
    [/floor press/i, 0.3],
    [/thruster/i, 0.25],
    [/jerk/i, 0.35],
    [/push press|seesaw|seated press|military press|para press|arnold press|press/i, 0.25],
    [/snatch/i, 0.35],
    [/clean/i, 0.35],
    [/swing/i, 0.4],
    [/one-legged deadlift|deadlift/i, 0.5],
    [/pushups|push-up/i, 0.7],
    [/lunge/i, 0.3],
  ],
  cable: [
    [/deadlift/i, 1.0],
    [/pulldown|pull down|pulldowns/i, 0.7],
    [/elevated cable rows|seated cable rows|mid row/i, 0.7],
    [/one-arm.*row|one arm row|single-arm.*row|shotgun row/i, 0.35],
    [/rear-delt row|row to neck/i, 0.45],
    [/\brow\b/i, 0.7],
    [/pull through/i, 0.5],
    [/incline pushdown|straight-arm/i, 0.45],
    [/one arm.*(push ?down|tricep)/i, 0.28],
    [/reverse grip triceps pushdown|pushdown/i, 0.5],
    [
      /overhead triceps|incline triceps|lying triceps|kneeling cable triceps|low cable triceps/i,
      0.35,
    ],
    [/triceps extension/i, 0.35],
    [/preacher curl/i, 0.3],
    [/one-arm.*curl|lying cable curl|high cable curls|overhead cable curl/i, 0.22],
    [/hammer curl/i, 0.4],
    [/reverse cable curl/i, 0.3],
    [/curl/i, 0.42],
    [/low cable crossover/i, 0.4],
    [/crossover|iron cross|flye|fly/i, 0.45],
    [/incline.*press/i, 0.6],
    [/standing.*chest press/i, 0.65],
    [/chest press/i, 0.85],
    [/shoulder press/i, 0.45],
    [/face pull/i, 0.35],
    [/(lateral raise|side lateral|deltoid raise)/i, 0.12],
    [/rear delt|reverse fly/i, 0.12],
    [/front.*raise/i, 0.12],
    [/(external|internal) rotation/i, 0.09],
    [/shrug/i, 0.8],
    [/upright.*row/i, 0.4],
    [/hip adduction|hip abduction/i, 0.35],
    [/kickback/i, 0.3],
    [/reverse crunch/i, 0.3],
    [/crunch/i, 0.6],
    [/wood chop|judo flip|standing cable lift|russian twist|side bend/i, 0.4],
    [/wrist curl/i, 0.2],
  ],
  plate_machine: [
    [/leg press/i, 3.5],
    [/calf press/i, 3.0],
    [/hack squat/i, 1.5],
    [/leverage deadlift|lying machine squat/i, 1.5],
    [/chair squat|squat/i, 1.2],
    [/leg extension/i, 0.5],
    [/leg curl|reverse hyperextension/i, 0.4],
    [/glute ham raise/i, 0.85],
    [/thigh abductor|thigh adductor/i, 0.6],
    [/calf raise|standing calf/i, 1.0],
    [/pulldown|pull down/i, 0.7],
    [/high row|iso row|t-bar row/i, 0.75],
    [/\brow\b/i, 0.7],
    [/incline chest press|decline chest press/i, 0.85],
    [/chest press|bench press/i, 0.9],
    [/shoulder press/i, 0.6],
    [/butterfly|pec deck|reverse machine flye/i, 0.5],
    [/dip machine/i, 0.8],
    [/shrug/i, 0.9],
    [/triceps extension/i, 0.4],
    [/preacher curl|bicep curl/i, 0.3],
    [/crunch|hip raise/i, 0.5],
    [/lunge sprint/i, 0.3],
  ],
  smith_machine: [
    [/leg press/i, 3.0],
    [/(stiff|straight).?leg|deadlift/i, 1.0],
    [/pistol squat|single-leg split squat|split squat/i, 0.5],
    [/squat/i, 1.3],
    [/calf raise/i, 1.0],
    [/incline.*press/i, 0.9],
    [/decline.*press/i, 1.0],
    [/close-grip bench/i, 0.9],
    [/bench press/i, 1.0],
    [/overhead shoulder press|shoulder press/i, 0.6],
    [/one-arm upright row/i, 0.2],
    [/upright row/i, 0.4],
    [/shrug/i, 0.9],
    [/bent over row/i, 0.8],
    [/hang power clean/i, 0.7],
    [/hip raise/i, 0.5],
    [/incline shoulder raise/i, 0.3],
  ],
  resistance_band: [
    [/bench press|squat|good morning/i, 0.3],
    [/calf raise/i, 0.3],
    [/skull crusher|overhead triceps/i, 0.12],
    [/hip extension|hip lift|hip adduction|hip flexion|monster walk/i, 0.1],
    [/shoulder press/i, 0.15],
    [/upright row/i, 0.15],
    [/cross over/i, 0.12],
    [/(external|internal) rotation/i, 0.05],
    [/pull apart|back flyes|lateral raise/i, 0.08],
    [/sit-ups/i, 0.3],
    [/assisted pull-?up/i, 0.7],
  ],
  medicine_ball: [[/.*/, 0]],
  cardio: [[/.*/, 0]],
  bodyweight: [
    // Isometric holds credit no displacement — the model is mass x distance.
    [/push-? ?up to side plank/i, 0.7],
    [/plank|hold|hang\b|one handed hang|isometric|stomach vacuum|wall sit|bridge hold/i, 0],
    [
      /muscle up|rope climb|chin|pull-?up|pullup|pull ups|gironda|london bridges|overhead lat/i,
      0.99,
    ],
    [/\bdip\b|dips|body-up/i, 0.99],
    [/calf raise|knee circles/i, 0.97],
    [/pistol|single leg push-off|one leg/i, 0.97],
    [
      /burpee|star jump|split jump|knee tuck jump|rocket jump|jump squat|scissors jump|standing long jump|bench jump/i,
      0.9,
    ],
    [/handstand push-?up/i, 0.9],
    [/sissy squat/i, 0.89],
    [/bodyweight squat|freehand|sit squats|squat/i, 0.88],
    [/step-?up|lunge|butt kick|fast skipping|long jump/i, 0.88],
    [/glute ham raise|natural glute ham|nordic/i, 0.85],
    [/pike push-?up/i, 0.78],
    [/feet elevated|decline push-?up|push-?ups with feet/i, 0.75],
    [/incline push-?up/i, 0.55],
    [/push-?up|pushup|plyo push|clock push|isometric chest/i, 0.7],
    [/inverted row|mid row|suspended row/i, 0.6],
    [/bench dip|tricep press|towel triceps|overhead triceps/i, 0.55],
    [/fallout/i, 0.3],
    [/hyperextension|superman|back curl/i, 0.45],
    [/inchworm|spider crawl|groiners/i, 0.7],
    [
      /leg raise|leg pull-in|flutter|scissor kick|hanging pike|cocoons|leg tucks|bent-knee hip raise|butt-ups|bottoms up/i,
      0.41,
    ],
    [/knee raise|gorilla chin|jackknife|janda|sit-?up|toe touch/i, 0.35],
    [/air bike|oblique crunch|cross-body crunch|elbow to knee|crunch|heel touch/i, 0.3],
    [/glute kickback|leg lift|rear leg raises|side leg raises|hip circles|lying crossover/i, 0.2],
    [/dead bug|wipers|scapular/i, 0.15],
    [/neck exercise|wind sprints/i, 0],
    [/manual hamstring/i, 0.12],
    [/flyes/i, 0.7],
  ],
  other: [
    [/yoke walk/i, 2.0],
    [/axle deadlift|car deadlift|rickshaw deadlift|tire flip/i, 1.5],
    [/atlas stone|conan|sandbag|keg load/i, 1.0],
    [/donkey calf raise/i, 1.0],
    [/rickshaw carry|farmer/i, 0.6],
    [/log lift|circus bell/i, 0.6],
    [/sled overhead triceps/i, 0.3],
    [/\bsled\b|bear crawl|backward drag|forward drag|power stairs|prowler/i, 0.6],
    [/weighted squat/i, 1.2],
    [/high box squat/i, 0.9],
    [/ball leg curl|physioball hip bridge|weighted ball hyperextension/i, 0.4],
    [/exercise ball crunch|ball pull-in|weighted ball side bend|torso rotation/i, 0.3],
    [/push-?ups with feet on an exercise ball/i, 0.72],
    [/parallel bar dip|ring dips/i, 0.99],
    [/band assisted pull-?up/i, 0.7],
    [/plate pinch|standing olympic plate hand squeeze|wrist roller/i, 0.1],
    [/front plate raise|crucifix/i, 0.15],
    [/plate twist/i, 0.2],
    [/weighted crunches|otis-up|weighted sit-ups/i, 0.35],
    [/chain handle extension/i, 0.3],
    [/reverse plate curls/i, 0.2],
    [/suspended fallout/i, 0.3],
    [/chain press|drop push|heavy bag thrust|svend press|forward drag with press/i, 0.4],
    [/hyperextensions/i, 0.45],
    [/seated band hamstring curl|platform hamstring slides/i, 0.35],
    [/sledgehammer|suspended fallout/i, 0.3],
    [/one arm chin|side to side chins|rocky pull-?ups|weighted pull ups|kipping muscle up/i, 0.99],
    [/suspended push-?up/i, 0.7],
    [/suspended reverse crunch/i, 0.35],
    [/suspended split squat/i, 0.4],
    [/lying face (down|up) plate neck|seated head harness/i, 0.1],
    [/balance board|downward facing balance|pyramid|hug a ball/i, 0],
  ],
};

// Plyometrics are filed under a grab-bag of equipment types in the source data,
// so they resolve against the movement before the equipment rules get a look.
// A jump displaces body mass the way its strength counterpart does; a sprint or
// footwork drill has no rep displacement to credit, the same as an isometric.
const PLYOMETRIC_RULES = [
  [
    /sprint|wall drill|start technique|claw series|arm drill|quick step|shuffle|skating|carioca/i,
    0,
  ],
  [/single-?leg|single leg|one leg|push-off/i, 0.9],
  [/incline push-?up|push-?up/i, 0.7],
  [/depth jump|box jump|box squat|hop|bound|leap|skip|jump|throw|slam|toss/i, 0.88],
];

// Anything whose mechanic is a stretch or a mobility drill moves no external
// load and has no rep displacement worth crediting.
const ZERO_MECHANICS = new Set(['stretching', 'mobility']);

// ...unless it is performed with an implement, which still has to be lifted.
const LOADED_EQUIPMENT = new Set([
  'barbell',
  'cable',
  'dumbbell',
  'kettlebell',
  'plate_machine',
  'resistance_band',
  'smith_machine',
]);

function resolveLoadMultiplier(entry, equipmentType, mechanicType, anchorMultipliers, stats) {
  const anchor = MUSCLOG_ANCHORS[entry.name];
  if (anchor !== undefined) {
    const value = anchorMultipliers.get(anchor);
    if (value === undefined) {
      throw new Error(`Anchor "${anchor}" for "${entry.name}" is not in exercisesData.json`);
    }
    stats.anchored += 1;
    return value;
  }

  if (
    equipmentType === 'cardio' ||
    (ZERO_MECHANICS.has(mechanicType) && !LOADED_EQUIPMENT.has(equipmentType))
  ) {
    stats.zeroed += 1;
    return 0;
  }

  if (mechanicType === 'plyometric' && equipmentType !== 'medicine_ball') {
    for (const [pattern, value] of PLYOMETRIC_RULES) {
      if (pattern.test(entry.name)) {
        stats.ruled += 1;
        return value;
      }
    }
  }

  for (const [pattern, value] of RULES_BY_EQUIPMENT[equipmentType] ?? []) {
    if (pattern.test(entry.name)) {
      stats.ruled += 1;
      return value;
    }
  }

  stats.fallback.push(entry.name);
  if (equipmentType === 'bodyweight' || equipmentType === 'other') {
    return 0;
  }
  return mechanicType === 'isolation' ? 0.2 : 0.5;
}

// ---------------------------------------------------------------------------

async function main() {
  if (!fs.existsSync(sourceFile)) {
    console.error(`Could not find ${sourceFile}`);
    console.error('Pass the free-exercise-db checkout path as the first argument.');
    process.exit(1);
  }

  const source = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));

  // A muscle missing from either table degrades silently — the group falls back
  // to `full_body` and the muscle is dropped from `targetMuscles` — so fail loudly
  // instead if the source catalogue ever grows a name these tables do not know.
  const sourceMuscles = new Set(
    source.flatMap((e) => [...e.primaryMuscles, ...e.secondaryMuscles])
  );
  for (const muscle of sourceMuscles) {
    if (!GROUP_BY_PRIMARY[muscle] || !MUSCLE_BY_SOURCE[muscle]) {
      throw new Error(`Source muscle "${muscle}" is not mapped in this script`);
    }
  }

  const bundled = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'data', 'exercisesData.json'), 'utf8')
  );
  const anchorMultipliers = new Map(bundled.map((e) => [e.__exerciseName, e.loadMultiplier]));

  const stats = { anchored: 0, ruled: 0, zeroed: 0, fallback: [] };

  const sorted = [...source].sort((a, b) => a.name.localeCompare(b.name));
  const output = sorted.map((entry, i) => {
    const equipmentType = resolveEquipment(entry);
    const mechanicType = resolveMechanic(entry);

    return {
      exerciseIndex: INDEX_OFFSET + i + 1,
      muscleGroup: resolveMuscleGroup(entry, equipmentType),
      equipmentType,
      mechanicType,
      targetMuscles: resolveTargetMuscles(entry),
      loadMultiplier: resolveLoadMultiplier(
        entry,
        equipmentType,
        mechanicType,
        anchorMultipliers,
        stats
      ),
      __exerciseName: entry.name,
      __freeExerciseDbId: entry.id,
    };
  });

  // Formatted the way `npm run format` would, so regenerating leaves no diff
  // for the lint suite to pick up.
  const prettier = require('prettier');
  const config = await prettier.resolveConfig(outputFile);
  const json = await prettier.format(JSON.stringify(output), {
    ...config,
    filepath: outputFile,
    parser: 'json',
  });
  fs.writeFileSync(outputFile, json);

  console.log(`Wrote ${output.length} exercises to ${path.relative(repoRoot, outputFile)}`);
  console.log(`  loadMultiplier from a bundled anchor : ${stats.anchored}`);
  console.log(`  loadMultiplier from a family rule    : ${stats.ruled}`);
  console.log(`  loadMultiplier zeroed (stretch/cardio): ${stats.zeroed}`);
  console.log(`  loadMultiplier from the fallback     : ${stats.fallback.length}`);
  if (stats.fallback.length > 0) {
    for (const name of stats.fallback) {
      console.log(`    - ${name}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
