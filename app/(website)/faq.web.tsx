'use client';

import Head from 'expo-router/head';
import { BookOpen, ChevronDown, Dumbbell, FlaskConical, HelpCircle, Salad } from 'lucide-react-native';
import { useState } from 'react';

import { DotPattern } from '@/components/website/WebsiteBackgrounds';

const BRAND_GREEN = '#22C55E';
const BRAND_GREEN_BRIGHT = '#00FFA3';
const BODY_TEXT_SOFT = '#9CA3AF';
const MUTED = '#6B7280';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Citation {
  label: string;
  url: string;
}

interface FaqItem {
  question: string;
  answer: string;
  answer2?: string;
  formula?: string;
  formulaCaption?: string;
  bullets?: string[];
  citations?: Citation[];
  table?: { head: string[]; rows: string[][] };
}

interface FaqCategory {
  id: string;
  label: string;
  icon: typeof HelpCircle;
  color: string;
  borderColor: string;
  bgColor: string;
  items: FaqItem[];
}

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

const FAQ_CATEGORIES: FaqCategory[] = [
  {
    id: 'general',
    label: 'General',
    icon: HelpCircle,
    color: BRAND_GREEN_BRIGHT,
    borderColor: 'rgba(0,255,163,0.25)',
    bgColor: 'rgba(0,255,163,0.06)',
    items: [
      {
        question: 'What is Musclog?',
        answer:
          'Musclog is a privacy-first fitness app for tracking workouts, nutrition, and body composition. All your data is stored locally on your device — nothing is sent to any server unless you explicitly enable optional AI features.',
      },
      {
        question: 'Does the app work without an internet connection?',
        answer:
          'Yes. All core features — logging workouts, tracking meals, viewing progress, and running the nutrition calculator — work fully offline. An internet connection is only needed for optional AI-powered features (meal recognition, AI coach), food database lookups from external sources, and Health Connect / HealthKit sync.',
      },
      {
        question: 'How accurate are the nutrition calculations?',
        answer:
          'The calculator uses well-validated population equations (Katch-McArdle / Mifflin-St Jeor for BMR, Hall 2008 body-composition model for projections). No equation is perfectly accurate for every individual — typical error for BMR equations is ±10 %. The best results come from feeding the app real tracking data over 2–4 weeks so it can compute your empirical TDEE directly from calories in vs. weight change.',
      },
      {
        question: 'What units does the app support?',
        answer:
          'The database always stores metric values (kg, cm, g, kcal). You can switch to imperial (lbs, inches, oz) in Settings at any time — the app converts all displayed values automatically. Body fat percentage, BMI, and FFMI are unitless and are never converted.',
      },
    ],
  },
  {
    id: 'nutrition',
    label: 'Nutrition Science',
    icon: Salad,
    color: '#38BDF8',
    borderColor: 'rgba(56,189,248,0.25)',
    bgColor: 'rgba(56,189,248,0.06)',
    items: [
      {
        question: 'How is my Basal Metabolic Rate (BMR) calculated?',
        answer:
          'Musclog uses two equations depending on whether you have provided a body fat percentage.',
        bullets: [
          'Katch-McArdle (preferred when BF % is available): BMR = 370 + 21.6 × Lean Body Mass (kg). Because it ignores fat mass — which has very low metabolic activity — this equation is more accurate for athletes and people with non-average body compositions.',
          'Mifflin-St Jeor (default, no BF % needed): BMR = 10 × weight + 6.25 × height − 5 × age ± gender constant (+5 male, −161 female). Validated as the most accurate general-population BMR equation across several meta-analyses.',
        ],
        citations: [
          {
            label: 'Katch-McArdle (1996)',
            url: 'https://en.wikipedia.org/wiki/Basal_metabolic_rate#cite_note-27',
          },
          {
            label: 'Mifflin et al. (1990)',
            url: 'https://pubmed.ncbi.nlm.nih.gov/2305711/',
          },
          {
            label: 'Frankenfield et al. meta-analysis (2005)',
            url: 'https://pubmed.ncbi.nlm.nih.gov/15883556/',
          },
        ],
      },
      {
        question: 'How is my Total Daily Energy Expenditure (TDEE) estimated?',
        answer:
          'Musclog uses two modes, automatically choosing the best one for your data.',
        bullets: [
          'Statistical (new users): TDEE = BMR × Activity Multiplier. Multipliers range from 1.2 (sedentary) to 1.9 (very active + physical job), based on the Harris-Benedict / Mifflin-St Jeor scale.',
          'Empirical / Observed TDEE (preferred, requires ≥2 weeks of food + weight data): Applies the First Law of Thermodynamics directly. TDEE = (Calories in − Energy stored in tissue) / Days. Fat tissue stores 7,730 kcal/kg when catabolised and costs 8,840 kcal/kg to build; muscle stores 1,250 kcal/kg and costs 3,900 kcal/kg. These asymmetric values account for thermodynamic synthesis efficiency.',
          'TDEE Drift Correction: The empirical TDEE represents the mid-period average. To project it to the current body state, three stacked adjustments are applied: (1) Resting Tissue Drop — lean tissue burns ~13 kcal/kg/day and fat ~4.5 kcal/kg/day (Elia 1992); (2) Activity-Scaled Drop — mechanical cost of movement scales with body mass; (3) Adaptive Thermogenesis penalty of 20 kcal/day per kg of body mass lost, reflecting NEAT suppression and hormonal adaptation (leptin, thyroid).',
        ],
        citations: [
          {
            label: 'Hall (2008) — Energy deficit per unit weight loss',
            url: 'https://journals.plos.org/ploscompbiol/article?id=10.1371/journal.pcbi.1000045',
          },
          {
            label: 'Elia (1992) — RMR tissue coefficients',
            url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4192648/',
          },
          {
            label: 'Müller et al. (2022) — Adaptive thermogenesis',
            url: 'https://pubmed.ncbi.nlm.nih.gov/36863769/',
          },
          {
            label: 'Hall et al. (NIH) — Dynamic energy balance',
            url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC3880593/',
          },
        ],
      },
      {
        question: 'How does providing body fat percentage improve the calculation?',
        answer:
          'When a valid body fat percentage (5–60 %) is entered, three things change:',
        bullets: [
          'BMR switches to Katch-McArdle, which is body-composition-aware and ignores metabolically inert fat mass.',
          'The fat/lean split of weight changes is computed from the Forbes Curve (Hall 2007), solved analytically via the Lambert W function. The key insight: leaner individuals lose a higher fraction of lean mass per kg because the body defends fat stores more aggressively. A person at 12 % BF loses tissue at roughly 5,800–6,200 kcal/kg, far below the classical "7,700 kcal/kg" rule which assumes pure fat loss.',
          'A ±4 % uncertainty band (typical BIA/skinfold error) generates a realistic min/max calorie range instead of a single number, communicating the inherent imprecision of body fat measurement.',
        ],
        formula: 'effective_kcal/kg = 9,440 × fat_fraction + 1,820 × lean_fraction',
        formulaCaption:
          'Hall (2008) blended energy density — fat fraction determined by Forbes curve / Lambert W',
        citations: [
          {
            label: 'Forbes (1987) — Body Composition: Growth, Aging, Nutrition, and Activity',
            url: 'https://link.springer.com/book/10.1007/978-1-4612-4654-1',
          },
          {
            label: 'Hall (2007) — Predicting metabolic adaptation, body weight, and body fat changes',
            url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC2376748/',
          },
          {
            label: 'Hall (2008) — Required Energy Deficit per unit Weight Loss',
            url: 'https://journals.plos.org/ploscompbiol/article?id=10.1371/journal.pcbi.1000045',
          },
        ],
      },
      {
        question: 'How is my recommended calorie deficit or surplus set?',
        answer:
          'Musclog scales the calorie adjustment to your body weight, rather than using a fixed ±500 kcal, and clamps it to evidence-based safe ranges.',
        bullets: [
          'Cut (weight loss): The recommended weekly loss rate is 0.5 % of body weight per week by default. When body fat is known, this is refined using ACE clinical thresholds — lean individuals (BF < 10 % male / < 20 % female) get a conservative 0.35 %/week to protect muscle, while higher-BF individuals can safely lose at up to 0.65 %/week. The resulting daily deficit is clamped to 250–750 kcal to prevent severe metabolic adaptation.',
          'Bulk (weight gain): A surplus of approximately 0.25 % body weight per week is targeted, which minimises fat spillover while supporting muscle protein synthesis. The surplus is clamped to 150–400 kcal/day.',
          'Minimum calorie floors: 1,200 kcal/day for females, 1,500 kcal/day for males, and never below 80 % of BMR — consistent with IOM / National Academies guidelines.',
        ],
        citations: [
          {
            label: 'Garthe et al. (2011) — Rate of weight loss and body composition',
            url: 'https://pubmed.ncbi.nlm.nih.gov/21558571/',
          },
          {
            label: 'Iraki et al. (2019) — Nutrition recommendations for natural bodybuilders',
            url: 'https://pubmed.ncbi.nlm.nih.gov/31247944/',
          },
          {
            label: 'ACE — Body fat percentage classifications',
            url: 'https://www.acefitness.org/about-ace/press-room/in-the-news/8602/body-fat-percentage-charting-averages-in-men-and-women-very-well-health/',
          },
        ],
      },
      {
        question: 'How does the weight projection model work?',
        answer:
          'The projection uses two phases to accurately predict 90-day weight change.',
        bullets: [
          'Early phase — Glycogen depletion: The whole-body glycogen pool is approximately 15 g/kg of body weight (dry), bound to about 3 g of water each, totalling roughly 6 % of body weight as hydrated glycogen. Only the portion of the cumulative calorie deficit that fits within this glycogen energy pool (~4,206 kcal/kg dry) drives the early "water weight" loss. This prevents wildly over-predicting early losses for aggressive deficits.',
          'Steady-state phase: All remaining deficit drives fat/lean tissue loss at the composition-aware energy density from the Hall/Forbes model. The reported "weekly rate" always reflects this steady-state figure — what users experience after the first few days.',
          'Surplus projection: Glycogen stores are assumed to be full, so all surplus goes to fat/lean synthesis at experience-weighted costs (beginner ~5,300 kcal/kg gained; intermediate ~6,370 kcal/kg; advanced ~7,430 kcal/kg).',
        ],
        citations: [
          {
            label: 'Hall (2008) — Energy density of weight loss tissue',
            url: 'https://journals.plos.org/ploscompbiol/article?id=10.1371/journal.pcbi.1000045',
          },
          {
            label: 'Schoenfeld et al. — Hypertrophy effect sizes, trained vs untrained',
            url: 'https://pubmed.ncbi.nlm.nih.gov/33497853/',
          },
        ],
      },
      {
        question: 'How are my daily macros calculated?',
        answer:
          'Macro splits are based on fitness goal, using IOM AMDR ranges as the framework and ISSN/ACSM sport-specific research for refinement.',
        table: {
          head: ['Goal', 'Carbs', 'Protein', 'Fat', 'Rationale'],
          rows: [
            ['Weight Loss', '40 %', '30 %', '30 %', 'High protein to preserve muscle in deficit (ISSN/Helms 2014)'],
            ['Hypertrophy', '45 %', '30 %', '25 %', 'Protein for MPS; carbs support volume training'],
            ['Strength', '50 %', '30 %', '20 %', 'Carbs for glycolytic demand of heavy compound work'],
            ['Endurance', '55 %', '20 %', '25 %', 'Glycogen priority (ACSM 6–10 g/kg/day guidance)'],
            ['General', '45 %', '25 %', '30 %', 'Centered within IOM AMDR for general fitness'],
          ],
        },
        answer2:
          'For Weight Loss and Hypertrophy goals, when body fat % is known, protein is upgraded from a percentage target to an absolute FFM-based target (2.7 g/kg FFM for weight loss; 2.0 g/kg FFM for hypertrophy), with remaining calories split proportionally between carbs and fats.',
        citations: [
          {
            label: 'IOM Dietary Reference Intakes (2005) — AMDR',
            url: 'https://doi.org/10.17226/10490',
          },
          {
            label: 'Jäger et al. (2017) — ISSN Protein and Exercise Position Stand',
            url: 'https://pubmed.ncbi.nlm.nih.gov/28642676/',
          },
          {
            label: 'Helms et al. (2014) — Evidence-based bodybuilding nutrition recommendations',
            url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4033492/',
          },
          {
            label: 'Thomas et al. (2016) — ACSM/ADA/DC Joint Position Stand',
            url: 'https://pubmed.ncbi.nlm.nih.gov/26891166/',
          },
        ],
      },
      {
        question: 'How does lifting experience affect the bulk calculation?',
        answer:
          'The fraction of gained weight that is lean mass vs fat depends heavily on training history. Untrained individuals have far greater hypertrophy potential than advanced lifters who have already captured most of their genetic muscle ceiling.',
        bullets: [
          'Beginner: ~60 % lean / 40 % fat per kg gained. Effective build cost ≈ 5,304 kcal/kg.',
          'Intermediate: ~50 % lean / 50 % fat. Effective build cost ≈ 6,370 kcal/kg.',
          'Advanced: ~40 % lean / 60 % fat. Effective build cost ≈ 7,434 kcal/kg.',
          'These splits use the thermodynamic build costs: 8,840 kcal/kg for fat and 3,900 kcal/kg for muscle, reflecting ~87 % synthesis efficiency for fat and ~32 % efficiency for muscle (most muscle synthesis energy is lost as heat).',
        ],
        citations: [
          {
            label: 'Schoenfeld et al. — Resistance training load meta-analysis',
            url: 'https://pubmed.ncbi.nlm.nih.gov/33497853/',
          },
          {
            label: 'Sports Med (2023) — Plateau in muscle growth with resistance training',
            url: 'https://pubmed.ncbi.nlm.nih.gov/37787845/',
          },
          {
            label: 'Smith et al. (2020) / Slater et al. (2023) — Intermediate fat/lean gain partitioning',
            url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6942464/',
          },
          {
            label: 'NCBI (2021) — Thermodynamic efficiency of muscle protein synthesis',
            url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8387577/#sec-10title',
          },
        ],
      },
      {
        question: 'How is RMR adjusted for obesity or older age?',
        answer:
          'Two evidence-based penalty multipliers are applied to the Resting Metabolic Rate tissue coefficients (lean: 13 kcal/kg/day; fat: 4.5 kcal/kg/day):',
        bullets: [
          'BMI > 30 (Obesity): −2 % reduction to both lean and fat tissue coefficients, reflecting impaired mitochondrial function in obese individuals (Müller et al. 2013).',
          'Age > 50: −3 % reduction, reflecting the decline in cellular turnover rate (St-Onge & Gallagher 2010).',
          'Both penalties stack additively when applicable (e.g. obese person over 50 → −5 % total).',
        ],
        citations: [
          {
            label: 'Müller et al. (2013) — Metabolic adaptation to caloric restriction',
            url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4535334/',
          },
          {
            label: 'St-Onge & Gallagher (2010) — Body composition changes with aging',
            url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC2880224/',
          },
        ],
      },
    ],
  },
  {
    id: 'workout',
    label: 'Workout Science',
    icon: Dumbbell,
    color: '#A78BFA',
    borderColor: 'rgba(167,139,250,0.25)',
    bgColor: 'rgba(167,139,250,0.06)',
    items: [
      {
        question: 'How are one-rep max (1RM) estimates calculated?',
        answer:
          'Musclog calculates 1RM using an ensemble of seven published formulas and averages their outputs. Averaging reduces the systematic error of any single formula, which each have different accuracy profiles across rep ranges.',
        table: {
          head: ['Formula', 'Equation', 'Best For'],
          rows: [
            ['Brzycki (1993)', 'w / (1.0278 − 0.0278 × r)', '2–10 reps; most widely used'],
            ['Epley (1985)', 'w × (1 + r / 30)', 'General use; slightly conservative'],
            ['Lander (1985)', 'w / (1.013 − 0.0267 × r)', 'Moderate rep ranges'],
            ['Lombardi (1989)', 'w × r^0.1', 'Low rep ranges'],
            ['Mayhew et al. (1992)', 'w / (0.522 + 0.419 × e^{−0.055r})', 'Wide rep range; exponential model'],
            ["O'Connor et al. (1989)", 'w × (1 + 0.025 × r)', 'Linear; conservative'],
            ['Wathan (1994)', 'w / (0.488 + 0.539 × e^{−0.035r})', 'Higher rep ranges'],
          ],
        },
        answer2:
          'Reps in Reserve (RIR) is added to actual reps before applying any formula (adjusted_reps = reps + RIR). This maps submaximal effort to a full-effort equivalent, so a set of 8 reps with 2 RIR is treated as 10 reps at failure for 1RM estimation purposes.',
        citations: [
          {
            label: 'Brzycki (1993)',
            url: 'https://doi.org/10.1080/07303084.1993.10606684',
          },
          {
            label: 'Epley (1985)',
            url: 'https://en.wikipedia.org/wiki/One-repetition_maximum#Epley_formula',
          },
          {
            label: 'Lander (1985)',
            url: 'https://journals.lww.com/nsca-jscr/abstract/1985/01000/maximum_based_on_reps.3.aspx',
          },
          {
            label: 'Lombardi (1989)',
            url: 'https://books.google.com/books/about/Beginning_Weight_Training.html',
          },
          {
            label: 'Mayhew et al. (1992)',
            url: 'https://journals.lww.com/nsca-jscr/Abstract/1992/05000/A_Derivation_of_a_Formula_to_Predict.3.aspx',
          },
          {
            label: "O'Connor et al. (1989)",
            url: 'https://en.wikipedia.org/wiki/One-repetition_maximum#O\'Connor_et_al._formula',
          },
          {
            label: 'Wathan (1994)',
            url: 'https://books.google.com/books/about/Essentials_of_Strength_Training_and_Cond.html',
          },
        ],
      },
      {
        question: 'How is workout volume calculated?',
        answer:
          'Musclog uses the average 1RM estimate as the unit of volume for each set, rather than raw tonnage (weight × reps). This produces a more meaningful measure because the 1RM normalises for the fact that higher-rep sets represent more total effort than the raw weight would suggest.',
        bullets: [
          'For bodyweight exercises, the user\'s current body weight is added to the bar weight before the 1RM calculation.',
          'Total session volume = sum of average 1RM estimates across all sets in the session.',
          'Progressive overload tracking compares this number across sessions for the same exercises.',
        ],
      },
      {
        question: 'How are calories burned from daily steps calculated?',
        answer:
          'Musclog uses the ACSM metabolic walking equations to compute net (not gross) calorie expenditure from step count. Using net expenditure prevents double-counting against the BMR/TDEE already factored in.',
        formula: 'Net Calories = (0.1 × distance_m × weight_kg) / 200',
        formulaCaption:
          'Derived from ACSM VO₂ walking equation. Time cancels out: speed (m/min) × duration (min) = distance (m). 1 L O₂ ≈ 5 kcal, so ÷1000 × 5 = ÷200.',
        bullets: [
          'Stride length is estimated from height using gender-specific empirical ratios: 0.415 × height (cm) / 100 for males, 0.413 for females.',
          'Distance = steps × stride length.',
          'The derivation eliminates the need to know cadence, removing the "cadence paradox" where faster walking looks identical to slower walking at the same step count.',
        ],
        citations: [
          {
            label: 'ACSM Metabolic Equations — Walking VO₂',
            url: 'https://www.scribd.com/document/811373428/ecuaciones-acsm',
          },
          {
            label: 'Pratama et al. (2012) — Stride length estimation',
            url: 'https://www.mdpi.com/2072-4292/11/1/55',
          },
          {
            label: 'Hoover et al. (2017) — Stride length and height ratios',
            url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9646807/',
          },
        ],
      },
      {
        question: 'How does the app calculate weight and reps for a target RIR?',
        answer:
          'Two inverse 1RM problems are solved:',
        bullets: [
          'Weight for target RIR: All seven 1RM formulas are linear in weight (1RM = weight × f(reps, RIR)), so weight = 1RM / f(reps, RIR). The multiplier f is computed by calling the ensemble with weight = 1.',
          'Reps for target weight: The averaged ensemble has no closed-form inverse, so the app uses binary search. Because 1RM estimates are monotonically increasing in reps, binary search converges within ~6 iterations for any practical rep range (1–50). See Helms et al. (2016) for RIR-based autoregulation research basis.',
        ],
        citations: [
          {
            label: 'Helms et al. (2016) — RPE and RIR-based autoregulation',
            url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4961270/',
          },
        ],
      },
    ],
  },
  {
    id: 'methodology',
    label: 'Methodology',
    icon: FlaskConical,
    color: '#F59E0B',
    borderColor: 'rgba(245,158,11,0.25)',
    bgColor: 'rgba(245,158,11,0.06)',
    items: [
      {
        question: 'Why does the app show a calorie range instead of one number?',
        answer:
          'Body fat percentage measurements — whether from bioelectrical impedance (BIA), skinfold calipers, or DEXA — carry a typical measurement error of ±3–5 %. Musclog applies a ±4 % band (a conservative midpoint) to your entered body fat percentage and recalculates BMR, TDEE, and target calories at both extremes.',
        bullets: [
          'Min target calories = calculation at BF% + 4 % (more fat → less lean mass → lower BMR).',
          'Max target calories = calculation at BF% − 4 % (less fat → more lean mass → higher BMR).',
          'The single "target" in the middle is the best-estimate result using your entered BF% directly.',
          'This range communicates realistic uncertainty and helps you understand that the "correct" number for you personally may sit anywhere within the band.',
        ],
      },
      {
        question: 'What is the Forbes Curve and why does it matter?',
        answer:
          'The Forbes Curve, developed by Gilbert Forbes (1987) and further formalised by Kevin Hall (2007), describes how the body partitions weight changes between fat mass and lean mass. It has a critical, counter-intuitive implication:',
        bullets: [
          'Leaner people sacrifice more lean mass per kg lost — the body defends fat stores more aggressively when fat reserves are low.',
          'Conversely, people with high body fat lose a higher proportion of fat per kg, making their effective energy density closer to the classic 7,700 kcal/kg rule.',
          'The curve is parameterised by a constant C (≈13.8 for males, ≈10.4 for females), solved using the Lambert W function (principal branch). Musclog implements this solver numerically with Newton\'s method to avoid any library dependency.',
          'Without this model, cuts for lean individuals are systematically under-estimated — the classic rule treats all weight loss as fat and would over-predict how much fat is actually lost.',
        ],
        citations: [
          {
            label: 'Forbes (1987) — Human Body Composition',
            url: 'https://link.springer.com/book/10.1007/978-1-4612-4654-1',
          },
          {
            label: 'Hall (2007) — PMC2376748 — Forbes curve formalisation',
            url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC2376748/',
          },
        ],
      },
      {
        question: 'What is Adaptive Thermogenesis and how does the app account for it?',
        answer:
          'Adaptive thermogenesis (AT) is the phenomenon where the body\'s energy expenditure drops by more than can be explained by changes in body mass alone, in response to sustained caloric restriction. It is driven by:',
        bullets: [
          'Hormonal suppression: leptin falls with fat loss, reducing sympathetic nervous system activity and thyroid hormone output.',
          'NEAT (Non-Exercise Activity Thermogenesis) reduction: the body unconsciously reduces fidgeting, posture changes, and spontaneous movement.',
          'Mitochondrial efficiency changes: cells extract more ATP per calorie burned.',
          'Musclog models AT as a 20 kcal/day penalty per kg of total body mass lost (using the midpoint of the Hall et al. range of 20–30 kcal/day/kg). This is applied in the TDEE drift correction when computing from empirical tracking data, and in the 90-day projection to show a realistic weight loss trajectory rather than a linear one.',
        ],
        citations: [
          {
            label: 'Müller et al. (2022) — Magnitude of AT in clinical trials',
            url: 'https://pubmed.ncbi.nlm.nih.gov/36863769/',
          },
          {
            label: 'Hall et al. (NIH) — Dynamic energy balance model (20–30 kcal/kg range)',
            url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC3880593/',
          },
        ],
      },
      {
        question: 'How is the daily water intake recommendation calculated?',
        answer:
          'Water recommendation scales linearly with TDEE at a ratio of 0.75 ml per kcal of daily energy expenditure. This is derived from two independently converging guidelines:',
        bullets: [
          'The U.S. Food and Nutrition Board (1945): "1 ml per kcal of energy expended" (Musclog uses 0.75 ml to represent the beverage fraction, as ~25 % of water comes from food).',
          'Dietary surveys show that beverages contribute approximately 70–80 % of total water intake in adults (Gandy et al. 2016).',
        ],
        citations: [
          {
            label: 'PMC7692653 — Water intake from beverages vs food',
            url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7692653/#:~:text=In%201945%2C%20the%20U.S.%20Food',
          },
          {
            label: 'PMC5946122 — Percentage of water intake from beverages',
            url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5946122/',
          },
        ],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CitationChip({ label, url }: Citation) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all hover:scale-[1.02]"
      style={{
        borderColor: 'rgba(56,189,248,0.3)',
        backgroundColor: 'rgba(56,189,248,0.06)',
        color: '#38BDF8',
      }}
    >
      <BookOpen size={11} color="#38BDF8" />
      {label}
    </a>
  );
}

function FormulaBlock({ formula, caption }: { formula: string; caption?: string }) {
  return (
    <div
      className="my-4 overflow-x-auto rounded-xl border px-5 py-3"
      style={{
        borderColor: 'rgba(0,255,163,0.2)',
        backgroundColor: 'rgba(0,255,163,0.04)',
      }}
    >
      <code
        className="block text-sm font-mono tracking-wide"
        style={{ color: BRAND_GREEN_BRIGHT }}
      >
        {formula}
      </code>
      {caption ? (
        <p className="mt-2 text-xs" style={{ color: MUTED }}>
          {caption}
        </p>
      ) : null}
    </div>
  );
}

function DataTable({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="my-4 overflow-x-auto rounded-xl border" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
      <table className="w-full min-w-[520px] text-sm">
        <thead>
        <tr style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}>
          {head.map((h) => (
            <th
              key={h}
              className="px-4 py-3 text-left font-semibold text-white first:rounded-tl-xl last:rounded-tr-xl"
            >
              {h}
            </th>
          ))}
        </tr>
        </thead>
        <tbody>
        {rows.map((row, i) => (
          <tr
            key={i}
            className="border-t"
            style={{ borderColor: 'rgba(255,255,255,0.06)' }}
          >
            {row.map((cell, j) => (
              <td
                key={j}
                className="px-4 py-3"
                style={{ color: j === 0 ? '#E5E7EB' : BODY_TEXT_SOFT }}
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
        </tbody>
      </table>
    </div>
  );
}

function AccordionItem({
                         item,
                         isOpen,
                         onToggle,
                         accentColor,
                       }: {
  item: FaqItem;
  isOpen: boolean;
  onToggle: () => void;
  accentColor: string;
}) {
  return (
    <div
      className="overflow-hidden rounded-2xl border transition-all"
      style={{
        borderColor: isOpen ? `${accentColor}33` : 'rgba(255,255,255,0.08)',
        backgroundColor: isOpen ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.015)',
      }}
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <span className="text-base font-semibold text-white">{item.question}</span>
        <span
          className={`shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        >
          <ChevronDown size={18} color={isOpen ? accentColor : MUTED} />
        </span>
      </button>

      {isOpen ? (
        <div className="px-6 pb-6">
          <div
            className="mb-4 border-t"
            style={{ borderColor: 'rgba(255,255,255,0.06)' }}
          />

          <p className="mb-3 leading-relaxed text-sm" style={{ color: BODY_TEXT_SOFT }}>
            {item.answer}
          </p>

          {item.bullets && item.bullets.length > 0 ? (
            <ul className="mb-3 space-y-2">
              {item.bullets.map((b, i) => (
                <li key={i} className="flex gap-2.5 text-sm" style={{ color: BODY_TEXT_SOFT }}>
                  <span className="mt-1 shrink-0" style={{ color: accentColor }}>›</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {item.formula ? (
            <FormulaBlock formula={item.formula} caption={item.formulaCaption} />
          ) : null}

          {item.table ? <DataTable head={item.table.head} rows={item.table.rows} /> : null}

          {item.answer2 ? (
            <p className="mb-3 leading-relaxed text-sm" style={{ color: BODY_TEXT_SOFT }}>
              {item.answer2}
            </p>
          ) : null}

          {item.citations && item.citations.length > 0 ? (
            <div className="mt-4">
              <p
                className="mb-2.5 text-xs font-semibold uppercase tracking-widest"
                style={{ color: MUTED }}
              >
                Sources
              </p>
              <div className="flex flex-wrap gap-2">
                {item.citations.map((c) => (
                  <CitationChip key={c.url} label={c.label} url={c.url} />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function Faq() {
  const [activeCategoryId, setActiveCategoryId] = useState<string>('general');
  const [openQuestion, setOpenQuestion] = useState<string | null>(null);

  const activeCategory = FAQ_CATEGORIES.find((c) => c.id === activeCategoryId) ?? FAQ_CATEGORIES[0];

  const handleCategoryChange = (id: string) => {
    setActiveCategoryId(id);
    setOpenQuestion(null);
  };

  return (
    <>
      <Head>
        <title>FAQ & Science — Musclog</title>
      </Head>
      <main className="relative overflow-hidden pb-24 pt-24">
        <DotPattern className="text-primary/20" />
        <div className="from-background/60 to-background/60 absolute inset-0 bg-gradient-to-b via-transparent" />

        {/* Ambient glows */}
        <div
          className="absolute left-1/4 top-32 h-96 w-96 rounded-full blur-[120px]"
          style={{ backgroundColor: 'rgba(0,255,163,0.07)' }}
          aria-hidden="true"
        />
        <div
          className="absolute bottom-32 right-1/4 h-80 w-80 rounded-full blur-[100px]"
          style={{ backgroundColor: 'rgba(56,189,248,0.07)' }}
          aria-hidden="true"
        />

        <div className="container relative z-10 mx-auto max-w-4xl px-4">
          {/* Hero */}
          <div className="mb-14 text-center">
            <div
              className="mb-4 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-widest"
              style={{
                borderColor: 'rgba(0,255,163,0.25)',
                backgroundColor: 'rgba(0,255,163,0.06)',
                color: BRAND_GREEN_BRIGHT,
              }}
            >
              <FlaskConical size={12} color={BRAND_GREEN_BRIGHT} />
              Evidence-Based
            </div>
            <h1 className="mb-4 text-4xl font-bold text-white md:text-5xl">
              FAQ &{' '}
              <span style={{ color: BRAND_GREEN_BRIGHT }}>The Science</span>
            </h1>
            <p className="mx-auto max-w-xl leading-relaxed text-sm md:text-base" style={{ color: BODY_TEXT_SOFT }}>
              Every number Musclog shows you comes from peer-reviewed research. This page explains the models, formulas, and studies behind each calculation — with links to the original sources.
            </p>
          </div>

          {/* Category tabs */}
          <div className="mb-8 flex flex-wrap justify-center gap-2">
            {FAQ_CATEGORIES.map((cat) => {
              const isActive = cat.id === activeCategoryId;
              const Icon = cat.icon;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleCategoryChange(cat.id)}
                  className="inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-semibold transition-all"
                  style={{
                    borderColor: isActive ? cat.borderColor : 'rgba(255,255,255,0.1)',
                    backgroundColor: isActive ? cat.bgColor : 'transparent',
                    color: isActive ? cat.color : BODY_TEXT_SOFT,
                  }}
                >
                  <Icon size={15} color={isActive ? cat.color : MUTED} />
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Category header */}
          <div
            className="mb-6 flex items-center gap-3 rounded-2xl border px-5 py-4"
            style={{
              borderColor: activeCategory.borderColor,
              backgroundColor: activeCategory.bgColor,
            }}
          >
            {(() => {
              const Icon = activeCategory.icon;
              return (
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border"
                  style={{
                    borderColor: activeCategory.borderColor,
                    backgroundColor: `${activeCategory.color}18`,
                  }}
                >
                  <Icon size={18} color={activeCategory.color} />
                </div>
              );
            })()}
            <div>
              <h2 className="font-semibold text-white">{activeCategory.label}</h2>
              <p className="text-xs" style={{ color: MUTED }}>
                {activeCategory.items.length} question{activeCategory.items.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* Accordion */}
          <div className="space-y-3">
            {activeCategory.items.map((item) => (
              <AccordionItem
                key={item.question}
                item={item}
                isOpen={openQuestion === item.question}
                onToggle={() =>
                  setOpenQuestion(openQuestion === item.question ? null : item.question)
                }
                accentColor={activeCategory.color}
              />
            ))}
          </div>

          {/* Footer note */}
          <div
            className="mt-14 rounded-2xl border p-6 text-center"
            style={{
              borderColor: 'rgba(255,255,255,0.08)',
              backgroundColor: 'rgba(255,255,255,0.02)',
            }}
          >
            <p className="text-sm leading-relaxed" style={{ color: BODY_TEXT_SOFT }}>
              Found an inaccuracy or a newer study that supersedes one of these sources?{' '}
              <a
                href="mailto:support@musclog.app"
                className="font-medium hover:underline"
                style={{ color: BRAND_GREEN_BRIGHT }}
              >
                Let us know
              </a>{' '}
              — the science is always evolving and so is Musclog.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
