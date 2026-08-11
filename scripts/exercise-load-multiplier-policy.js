/** Load multiplier policy for the free-exercise-db catalogue generator. */

const { MUSCLOG_ANCHORS } = require('./exercise-load-multiplier-anchors');

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

module.exports = { resolveLoadMultiplier };
