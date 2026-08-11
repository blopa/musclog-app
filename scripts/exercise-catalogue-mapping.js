/** Structural field mappings for the free-exercise-db catalogue generator. */

// free-exercise-db currently leaves these five instruction arrays empty.
const DESCRIPTION_FALLBACKS = {
  Iron_Cross:
    'Hold your arms straight out to the sides at shoulder height while supporting your body on gymnastics rings, keeping your core braced and your body still.',
  'One-Arm_Kettlebell_Swings':
    'Hinge at the hips and swing a kettlebell forward with one arm, using powerful hip extension while keeping the working arm relaxed and controlled.',
  Push_Press:
    'Dip slightly through the knees and hips, then drive a barbell overhead with your legs before finishing with your arms fully extended.',
  Side_Bridge:
    'Support your body on one forearm and the side of one foot, keeping your hips lifted and your body in a straight line.',
  Side_Jackknife:
    'Lie on your side and bring your upper leg and torso toward each other, using your obliques to lift and control the movement.',
};

function descriptionFor(entry) {
  const instructions = entry.instructions
    .filter((instruction) => typeof instruction === 'string' && instruction.trim().length > 0)
    .map((instruction) => instruction.trim());

  if (instructions.length > 0) {
    return instructions.join(' ');
  }

  const fallback = DESCRIPTION_FALLBACKS[entry.id];
  if (!fallback) {
    throw new Error(`Exercise "${entry.name}" has no English description`);
  }
  return fallback;
}

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
  // The legacy catalogue files every shrug and upright row under shoulders.
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
// ...except where the squat is the lift rather than the accessory. The legacy
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

// The legacy catalogue splits cardio: machines that drive the whole body are
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

function assertSourceMusclesMapped(source) {
  const sourceMuscles = new Set(
    source.flatMap((entry) => [...entry.primaryMuscles, ...entry.secondaryMuscles])
  );

  for (const muscle of sourceMuscles) {
    if (!GROUP_BY_PRIMARY[muscle] || !MUSCLE_BY_SOURCE[muscle]) {
      throw new Error(`Source muscle "${muscle}" is not mapped in this script`);
    }
  }
}

module.exports = {
  assertSourceMusclesMapped,
  descriptionFor,
  resolveEquipment,
  resolveMechanic,
  resolveMuscleGroup,
  resolveTargetMuscles,
};
