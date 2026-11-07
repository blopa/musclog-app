/**
 * Every route under `app/app/` the layout audit knows about, and every button of the
 * `/app/test/modals` fixture. `routes.test.ts` fails when a screen or a fixture button exists
 * that is listed in neither place, so coverage cannot rot silently.
 */

import { MODAL_BUTTON_TEXTS } from '@/tests/helpers/modalFixture';

export interface AuditRoute {
  /** The report name. */
  name: string;
  /** Path under `/app`, with an optional query string. */
  path: string;
  /** The route file it stands for, relative to `app/app/` and without the extension. */
  file: string;
  /** Needs a signed-off onboarding (demo data) before it shows what a user sees. */
  area: 'main' | 'onboarding';
  /**
   * A sheet the route opens by itself the first time (a one-time welcome). It would otherwise sit
   * over every capture, hiding the screen and flagging everything under it as occluded, so the
   * audit measures the sheet alone, dismisses it through its button, then measures the screen.
   */
  introSheet?: {
    /** The `testID` of a view inside the sheet. */
    testId: string;
    /** Where the dismiss button's translated label lives: a `lang/locales/<locale>/<file>.json` key path. */
    dismiss: { file: string; keyPath: string[] };
  };
}

/** A route file that is deliberately not audited, with the reason. */
export interface UnauditedRoute {
  file: string;
  reason: string;
}

const YEAR = new Date().getFullYear();

export const MAIN_ROUTES: AuditRoute[] = [
  { name: 'home', path: '', file: 'index', area: 'main' },
  { name: 'food', path: '/nutrition/food', file: 'nutrition/food', area: 'main' },
  { name: 'progress', path: '/progress', file: 'progress', area: 'main' },
  { name: 'profile', path: '/profile', file: 'profile', area: 'main' },
  { name: 'settings', path: '/settings', file: 'settings', area: 'main' },
  { name: 'notes', path: '/notes', file: 'notes', area: 'main' },
  { name: 'cycle', path: '/cycle', file: 'cycle', area: 'main' },
  { name: 'comeback', path: '/comeback', file: 'comeback', area: 'main' },
  {
    name: 'weekly-review',
    path: '/weekly-review',
    file: 'weekly-review',
    area: 'main',
    introSheet: {
      testId: 'weekly-review-welcome',
      dismiss: { file: 'workoutSession', keyPath: ['weeklyReview', 'welcome', 'cta'] },
    },
  },
  {
    name: 'year-in-review',
    path: `/year-in-review?year=${YEAR}`,
    file: 'year-in-review',
    area: 'main',
  },
  { name: 'workouts', path: '/workout/workouts', file: 'workout/workouts', area: 'main' },
];

/**
 * Onboarding is audited in a context that has not finished it. Several screens read a draft the
 * earlier steps write and may redirect without one; the report records where each one landed.
 */
export const ONBOARDING_ROUTES: AuditRoute[] = [
  { name: 'landing', path: '/onboarding/landing', file: 'onboarding/landing' },
  { name: 'quick-goals', path: '/onboarding/quick-goals', file: 'onboarding/quick-goals' },
  {
    name: 'quick-body-stats',
    path: '/onboarding/quick-body-stats',
    file: 'onboarding/quick-body-stats',
  },
  {
    name: 'quick-preferences',
    path: '/onboarding/quick-preferences',
    file: 'onboarding/quick-preferences',
  },
  {
    name: 'training-setup-quick',
    path: '/onboarding/training-setup?mode=quick',
    file: 'onboarding/training-setup',
  },
  {
    name: 'training-setup-personalized',
    path: '/onboarding/training-setup?mode=personalized',
    file: 'onboarding/training-setup',
  },
  {
    name: 'personalized-goals',
    path: '/onboarding/personalized-goals',
    file: 'onboarding/personalized-goals',
  },
  {
    name: 'personalized-body-stats',
    path: '/onboarding/personalized-body-stats',
    file: 'onboarding/personalized-body-stats',
  },
  {
    name: 'personalized-experience',
    path: '/onboarding/personalized-experience',
    file: 'onboarding/personalized-experience',
  },
  {
    name: 'personalized-preferences',
    path: '/onboarding/personalized-preferences',
    file: 'onboarding/personalized-preferences',
  },
  {
    name: 'personalized-cycle',
    path: '/onboarding/personalized-cycle',
    file: 'onboarding/personalized-cycle',
  },
  { name: 'cycle-setup', path: '/onboarding/cycle-setup', file: 'onboarding/cycle-setup' },
  { name: 'coach-persona', path: '/onboarding/coach-persona', file: 'onboarding/coach-persona' },
  {
    name: 'nutrition-goals',
    path: '/onboarding/nutrition-goals',
    file: 'onboarding/nutrition-goals',
  },
  {
    name: 'nutrition-goals-results',
    path: '/onboarding/nutrition-goals-results',
    file: 'onboarding/nutrition-goals-results',
  },
  { name: 'first-workout', path: '/onboarding/first-workout', file: 'onboarding/first-workout' },
  { name: 'health-connect', path: '/onboarding/health-connect', file: 'onboarding/health-connect' },
  { name: 'musclog-api', path: '/onboarding/musclog-api', file: 'onboarding/musclog-api' },
  { name: 'ai-setup', path: '/onboarding/ai-setup', file: 'onboarding/ai-setup' },
  { name: 'ai-provider', path: '/onboarding/ai-provider', file: 'onboarding/ai-provider' },
  { name: 'ai-chat', path: '/onboarding/ai-chat', file: 'onboarding/ai-chat' },
  { name: 'ai-external', path: '/onboarding/ai-external', file: 'onboarding/ai-external' },
  { name: 'ai-review', path: '/onboarding/ai-review', file: 'onboarding/ai-review' },
].map((route) => ({ ...route, area: 'onboarding' as const }));

/**
 * A state no URL can carry, reached by tapping through the app (see `tests/layoutAudit/flows/`).
 * Each flow runs in its own seeded browser context, since it changes the data as it goes (a
 * workout is started and finished, a review decided, a comeback begun). `steps` are the report
 * names the flow measures; one ending in `)` may carry a variant inside the brackets
 * (`whats-new (tour page 3)`), and measuring a name that is not declared here fails that step.
 */
export interface AuditFlow {
  name: string;
  /** Route files under `app/app/` the flow audits (they need no entry of their own). */
  files: string[];
  steps: string[];
}

export const AUDIT_FLOWS: AuditFlow[] = [
  {
    name: 'workout',
    files: [
      'workout/workout-session',
      'workout/workout-summary',
      'workout/rest-timer',
      'workout/rest-over',
      'workout/exercise-transition',
    ],
    steps: [
      'workout-session (guided)',
      'workout-session (inline)',
      'workout-session (set states)',
      'workout-session (rest panel)',
      'workout-session (get ready)',
      'workout-session (rest over)',
      'workout-session (set details)',
      'workout-session (why)',
      'workout-session (notes)',
      'workout-session (workout options)',
      'workout-session (end workout)',
      'workout-rest-timer',
      'workout-rest-over',
      'workout-exercise-transition',
      'workout-summary',
      'workout-summary (session feedback)',
    ],
  },
  {
    name: 'whats-new',
    files: [],
    steps: [
      'whats-new (tour intro)',
      'whats-new (tour page)',
      'whats-new (workout settings)',
      'whats-new (cardio log)',
      'whats-new (replay intro)',
      'whats-new (replay page)',
    ],
  },
  {
    name: 'weekly-review-flow',
    files: [],
    steps: [
      'weekly-review (training decided)',
      'weekly-review (weekly targets)',
      'weekly-review (log weight)',
      'weekly-review (recommendation ready)',
      'weekly-review (edit recommendation)',
      'weekly-review (applied)',
      'weekly-review (earlier review)',
      'weekly-review (legacy check-in)',
      'weekly-review (week off)',
    ],
  },
  {
    name: 'comeback-flow',
    files: [],
    steps: [
      'comeback (home offer)',
      'comeback (setup)',
      'comeback (running)',
      'comeback (home active)',
      'comeback (tailor)',
      'comeback (edit)',
      'comeback (home stalled)',
      'comeback (graduated)',
    ],
  },
  {
    name: 'diary',
    files: [],
    steps: [
      'diary (food entry)',
      'diary (grouped meal)',
      'diary (my meals)',
      'diary (meal options)',
      'diary (saved meal)',
      'diary (day summary menu)',
      'diary (selection)',
    ],
  },
  {
    name: 'cycle-flow',
    files: [],
    steps: [
      'cycle (day log)',
      'cycle (prediction details)',
      'cycle (appointment summary)',
      'cycle (log past period)',
      'cycle (periods)',
      'cycle (edit period)',
      'cycle (life stage)',
      'cycle (compare)',
      'cycle (trends)',
      'cycle (reminder explainer)',
    ],
  },
];

/** Route files that are not audited at all, with the reason. */
export const UNAUDITED_ROUTES: UnauditedRoute[] = [
  { file: '_layout', reason: 'layout, renders no screen of its own' },
  {
    file: 'nutrition/checkin-list',
    reason: 'deprecated redirect to the Weekly Review, kept for saved links',
  },
];

/**
 * The fixture buttons the app-store capture spec does not click but the audit does: a modal it
 * never captures, and four inline pickers that open a date/time sheet.
 */
export const AUDIT_ONLY_MODAL_BUTTONS = [
  'Open Cycle Settings Modal',
  'Date (default)',
  'Time (default)',
  'Date (compact)',
  'Time (compact)',
];

export const MODAL_AUDIT_BUTTONS: string[] = [...MODAL_BUTTON_TEXTS, ...AUDIT_ONLY_MODAL_BUTTONS];

/**
 * How each modal, sheet and menu under `components/` is audited: through a `/app/test/modals`
 * button (with the fixture's props), a flow step (with real data, reached by tapping), or not at
 * all and why. `routes.test.ts` fails when a `*Modal`, `*Sheet` or `*Menu` file is missing here,
 * so a new one cannot go unaudited without a line saying so. "not scripted yet" marks a reachable
 * one no flow opens: that is a gap to close, not a reason.
 */
export type ModalCoverage = { fixture: string } | { flow: string } | { unaudited: string };

export const MODAL_COVERAGE: Record<string, ModalCoverage> = {
  'components/BottomPopUpMenu.tsx': { flow: 'diary (meal options)' },
  'components/DailySummaryBottomMenu.tsx': { flow: 'diary (day summary menu)' },
  'components/NavigationMenu.tsx': {
    unaudited: 'the bottom tab bar, not a modal; audited on every screen that shows it',
  },
  'components/WorkoutDetailsMenu.tsx': {
    unaudited: 'not scripted yet: Workouts → a workout card’s menu',
  },
  'components/ZoomableImageModal.tsx': {
    unaudited: 'not scripted yet: a meal photo thumbnail (no seeded meal has a photo)',
  },
  'components/aiOnboarding/PasteJsonSheet.tsx': {
    unaudited: 'not scripted yet: onboarding → set up with ChatGPT or Claude → paste the answer',
  },
  'components/cards/IngredientListModal.tsx': {
    unaudited:
      'not scripted yet: food details → nutrition card → ingredients (needs a food with an ingredient list)',
  },
  'components/comeback/ComebackSetupModal.tsx': { flow: 'comeback (setup)' },
  'components/cycle/AppointmentSummarySheet.tsx': { flow: 'cycle (appointment summary)' },
  'components/cycle/CycleDaySheet.tsx': { flow: 'cycle (day log)' },
  'components/cycle/PredictionDetailsSheet.tsx': { flow: 'cycle (prediction details)' },
  'components/cycle/ReminderExplainerSheet.tsx': { flow: 'cycle (reminder explainer)' },
  'components/modals/AINotConfiguredModal.tsx': { fixture: 'Open AI Not Configured Modal' },
  'components/modals/AINutritionTrackingContextModal.tsx': {
    fixture: 'Open AI Nutrition Context Modal',
  },
  'components/modals/AISettingsModal.tsx': { fixture: 'Open AI Settings Modal' },
  'components/modals/AddExerciseModal.tsx': { fixture: 'Open Add Exercise Modal' },
  'components/modals/AddExerciseToSessionModal.tsx': {
    fixture: 'Open Add Exercise To Session Modal',
  },
  'components/modals/AddFoodItemToMealModal.tsx': { fixture: 'Open Add Food Item to Meal Modal' },
  'components/modals/AddFoodModal.tsx': { fixture: 'Open Add Food Modal' },
  'components/modals/AddMealModal.tsx': { fixture: 'Open Add Meal Modal' },
  'components/modals/AddUserMetricEntryModal.tsx': { flow: 'weekly-review (log weight)' },
  'components/modals/AdvancedSettingsModal.tsx': { fixture: 'Open App Preferences Modal' },
  'components/modals/AiCustomPromptEditModal.tsx': { fixture: 'Open AI Custom Prompt Edit Modal' },
  'components/modals/AiCustomPromptsModal.tsx': { fixture: 'Open AI Custom Prompts Modal' },
  'components/modals/AppLockSettingsModal.tsx': {
    unaudited: 'Settings hides App lock on web (it needs a device credential)',
  },
  'components/modals/BarcodeCameraModal.tsx': { fixture: 'Open Barcode Camera Modal' },
  'components/modals/BarcodeTextSearchSheet.tsx': {
    unaudited: 'not scripted yet: the barcode camera → type a barcode instead',
  },
  'components/modals/BasicSettingsModal.tsx': { fixture: 'Open Basic Settings Modal' },
  'components/modals/BleDevicePreviewModal.tsx': {
    unaudited: 'native Bluetooth preview; web renders BleDevicePreviewModal.web instead',
  },
  'components/modals/BleDevicePreviewModal.web.tsx': {
    unaudited:
      'not scripted yet: Settings → Bluetooth devices → a scanned device, which needs Web Bluetooth and a sensor',
  },
  'components/modals/BleWorkoutDataModal.tsx': {
    unaudited: 'not scripted yet: Settings → Backups and data → Sensor data',
  },
  'components/modals/BodyMetricsHistoryFilterMenu.tsx': {
    unaudited: 'not scripted yet: Body metrics history → filter',
  },
  'components/modals/BodyMetricsHistoryModal.tsx': { fixture: 'Open Body Metrics History Modal' },
  'components/modals/BrowseTemplatesModal.tsx': { fixture: 'Open Browse Templates Modal' },
  'components/modals/CenteredModal.tsx': { fixture: 'Open Centered Modal' },
  'components/modals/CheckinDetailsModal.tsx': { flow: 'weekly-review (legacy check-in)' },
  'components/modals/CircadianScienceModal.tsx': {
    unaudited: 'not scripted yet: the calories burned card → how this is calculated',
  },
  'components/modals/CoachModal.tsx': { fixture: 'Open Coach Modal' },
  'components/modals/CoachQuickSettingsModal.tsx': {
    unaudited: 'not scripted yet: the coach → its settings button',
  },
  'components/modals/CombineIntoMealModal.tsx': {
    unaudited: 'not scripted yet: diary selection of two logs → Actions → Combine into meal',
  },
  'components/modals/ConfirmationModal.tsx': { fixture: 'Default Variant' },
  'components/modals/CopyDayFromHistoryModal.tsx': {
    unaudited: 'not scripted yet: diary → More options → copy a day',
  },
  'components/modals/CreateCustomFoodModal.tsx': { fixture: 'Open New Custom Food Modal' },
  'components/modals/CreateEditPlanModal.tsx': {
    unaudited: 'not scripted yet: Workouts → a plan section → edit plan',
  },
  'components/modals/CreateExerciseModal.tsx': { fixture: 'Open Create Exercise Modal' },
  'components/modals/CreateFoodPortionModal.tsx': { fixture: 'Open Create Food Portion Modal' },
  'components/modals/CreateMealModal.tsx': { fixture: 'Open Create Meal Modal' },
  'components/modals/CreateWorkoutModal.tsx': { fixture: 'Open Create Workout Modal' },
  'components/modals/CreateWorkoutOptionsModal.tsx': { fixture: 'Open Create Workout Options' },
  'components/modals/CustomCoachPersonaModal.tsx': {
    unaudited: 'not scripted yet: Settings → AI → coach persona → write your own',
  },
  'components/modals/CycleContextModal.tsx': { flow: 'cycle (life stage)' },
  'components/modals/CyclePortabilityModal.tsx': {
    unaudited: 'not scripted yet: cycle settings → export or import cycle data',
  },
  'components/modals/CycleSettingsModal.tsx': { fixture: 'Open Cycle Settings Modal' },
  'components/modals/DataLogModal.tsx': { fixture: 'Open Food Data Modal' },
  'components/modals/DataSettingsModal.tsx': { fixture: 'Open Data Settings Modal' },
  'components/modals/DatePickerModal.tsx': { fixture: 'Date (default)' },
  'components/modals/DynamicMealCreatorModal.tsx': {
    unaudited: 'not scripted yet: My meals → create with AI',
  },
  'components/modals/EditFitnessDetailsModal.tsx': { fixture: 'Open Edit Fitness Details Modal' },
  'components/modals/EditGymModal.tsx': {
    unaudited: 'not scripted yet: workout settings → add a gym',
  },
  'components/modals/EditPastWorkoutDataModal.tsx': {
    fixture: 'Open Edit Past Workout Data Modal',
  },
  'components/modals/EditPeriodModal.tsx': { flow: 'cycle (edit period)' },
  'components/modals/EditPersonalInfoModal.tsx': { fixture: 'Open Edit Personal Info Modal' },
  'components/modals/EditSetDetailsModal.tsx': { fixture: 'Open Edit Set Details Modal' },
  'components/modals/EditWorkoutMetadataModal.tsx': { fixture: 'Open Edit Workout Metadata Modal' },
  'components/modals/EndWorkoutModal.tsx': { flow: 'workout-session (end workout)' },
  'components/modals/ExerciseGoalCreationModal.tsx': {
    unaudited: 'not scripted yet: Goals → add a fitness goal',
  },
  'components/modals/ExerciseGoalDetailModal.tsx': {
    unaudited: 'not scripted yet: Goals → a fitness goal (the audit seed creates two)',
  },
  'components/modals/ExercisesModal.tsx': { fixture: 'Open Exercises Modal' },
  'components/modals/FilterWorkoutsModal.tsx': { fixture: 'Open Filter Workouts Modal' },
  'components/modals/FoodMealDetailsModal.tsx': { flow: 'diary (food entry)' },
  'components/modals/FoodMealTrackingDetailsModal.tsx': { flow: 'diary (saved meal)' },
  'components/modals/FoodNotFoundModal.tsx': { fixture: 'Open Food Not Found Modal' },
  'components/modals/FoodSearchModal.tsx': { fixture: 'Open Food Search Modal' },
  'components/modals/FreeSessionExerciseCompleteModal.tsx': {
    fixture: 'Open Free Session Exercise Complete Modal',
  },
  'components/modals/FullScreenModal.tsx': { fixture: 'Open Full Screen Modal' },
  'components/modals/GenerateWorkoutWithAiModal.tsx': {
    unaudited: 'not scripted yet: Workouts → create workout → generate with AI',
  },
  'components/modals/GenericEditModal.tsx': { fixture: 'Open Generic Edit Modal' },
  'components/modals/GoalCreationMethodModal.tsx': {
    unaudited: 'not scripted yet: Goals → add a goal',
  },
  'components/modals/GoalWizardModal.tsx': {
    unaudited: 'not scripted yet: Goals → add a goal → guided',
  },
  'components/modals/GoalsManagementModal.tsx': { fixture: 'Open Goals Management Modal' },
  'components/modals/HeightPickerModal.tsx': {
    unaudited: 'not scripted yet: body stats → height (onboarding and Profile)',
  },
  'components/modals/ImportNutritionModal.tsx': { fixture: 'Open Import Nutrition Modal' },
  'components/modals/ImportWorkoutsModal.tsx': { fixture: 'Open Import Workouts Modal' },
  'components/modals/LocalBackupsModal.tsx': {
    unaudited: 'not scripted yet: Settings → Backups and data → recovery points',
  },
  'components/modals/LogCardioModal.tsx': { flow: 'whats-new (cardio log)' },
  'components/modals/LogMealModal.tsx': { fixture: 'Open Log Meal Modal' },
  'components/modals/LogSetPerformanceModal.tsx': { fixture: 'Open Log Set Performance Modal' },
  'components/modals/ManageBleDevicesModal.tsx': {
    unaudited: 'not scripted yet: Settings → Bluetooth devices',
  },
  'components/modals/ManageSupplementsModal.tsx': {
    unaudited: 'not scripted yet: Advanced settings → supplements',
  },
  'components/modals/MealEstimationModal.tsx': { fixture: 'Open Meal Estimation Modal' },
  'components/modals/MealGroupDetailsModal.tsx': { flow: 'diary (grouped meal)' },
  'components/modals/MealInsightsModal.tsx': {
    unaudited: 'not scripted yet: diary → a grouped meal’s menu → insights (AI)',
  },
  'components/modals/MoveCopyMealModal.tsx': { fixture: 'Move Mode' },
  'components/modals/MyMealsModal.tsx': { flow: 'diary (my meals)' },
  'components/modals/NotificationsModal.tsx': { fixture: 'Open Notifications Modal' },
  'components/modals/NotificationsSettingsModal.tsx': {
    fixture: 'Open Notifications Settings Modal',
  },
  'components/modals/NutritionConfirmationModal.tsx': {
    fixture: 'Open Nutrition Confirmation Modal',
  },
  'components/modals/NutritionGoalsModal.tsx': { fixture: 'Open Nutrition Goals Modal' },
  'components/modals/OpticalReceiveModal.tsx': {
    unaudited:
      'not scripted yet: Settings → Backups and data → Optical transfer → receive (needs a camera)',
  },
  'components/modals/OpticalSendModal.tsx': {
    unaudited: 'not scripted yet: Settings → Backups and data → Optical transfer → send',
  },
  'components/modals/OpticalTransferModal.tsx': {
    unaudited: 'not scripted yet: Settings → Backups and data → Optical transfer',
  },
  'components/modals/PastWorkoutBottomMenu.tsx': { fixture: 'Open Past Workout Bottom Menu' },
  'components/modals/PastWorkoutDetailModal.tsx': { fixture: 'Open Past Workout Detail Modal' },
  'components/modals/PastWorkoutsHistoryFilterMenu.tsx': {
    fixture: 'Open Past Workouts Filter Menu',
  },
  'components/modals/PastWorkoutsHistoryModal.tsx': { fixture: 'Open Past Workouts History Modal' },
  'components/modals/PeriodLogModal.tsx': { flow: 'cycle (log past period)' },
  'components/modals/PortionSizesPickerModal.tsx': { fixture: 'Open Portion Sizes Picker Modal' },
  'components/modals/RecentNutritionHistoryModal.tsx': {
    fixture: 'Open Recent Nutrition History Modal',
  },
  'components/modals/ReplaceExerciseModal.tsx': { fixture: 'Open Replace Exercise Modal' },
  'components/modals/RetrospectiveNutritionModal.tsx': {
    fixture: 'Open Retrospective Nutrition Modal',
  },
  'components/modals/SaveForLaterPortionModal.tsx': {
    unaudited: 'not scripted yet: diary → a log’s menu → save for later',
  },
  'components/modals/SavedForLaterModal.tsx': { fixture: 'Open Saved For Later Modal' },
  'components/modals/ScaleMealPortionModal.tsx': {
    unaudited: 'not scripted yet: diary → a grouped meal’s menu → change portion',
  },
  'components/modals/ScannedFoodDetailsModal.tsx': { fixture: 'Open Scanned Food Details Modal' },
  'components/modals/SelectModal.tsx': { fixture: 'Open Select Modal (list rows)' },
  'components/modals/SessionFeedbackModal.tsx': { flow: 'workout-summary (session feedback)' },
  'components/modals/ShareOpticalSendModal.tsx': {
    unaudited: 'not scripted yet: My meals → a meal’s menu → send to phone',
  },
  'components/modals/SmartCameraModal.tsx': { fixture: 'Open Smart Camera Modal' },
  'components/modals/TimePickerModal.tsx': { fixture: 'Open Time Picker Modal' },
  'components/modals/TimePickerModal.web.tsx': { fixture: 'Open Time Picker Modal' },
  'components/modals/TrackSavedForLaterFoodMealModal.tsx': {
    unaudited: 'not scripted yet: Saved for later → a saved group (none seeded)',
  },
  'components/modals/UserMenuModal.tsx': { fixture: 'Open User Menu Modal' },
  'components/modals/ViewExerciseModal.tsx': { fixture: 'Open View Exercise Modal' },
  'components/modals/VisualSettingsModal.tsx': { fixture: 'Open Visual Settings Modal' },
  'components/modals/WorkoutImportModal.tsx': {
    unaudited: 'not scripted yet: Settings → Backups and data → import a workout file',
  },
  'components/modals/WorkoutMusclesModal.tsx': {
    unaudited: 'not scripted yet: a past workout → muscles worked',
  },
  'components/modals/WorkoutOptionsModal.tsx': { flow: 'workout-session (workout options)' },
  'components/modals/WorkoutPlanPickerModal.tsx': {
    unaudited: 'not scripted yet: Workouts → a workout’s menu → add to plan',
  },
  'components/modals/WorkoutSessionHistoryModal.tsx': { fixture: 'Open Workout History Modal' },
  'components/modals/WorkoutSessionOverviewModal.tsx': { fixture: 'Open Session Overview' },
  'components/modals/WorkoutSettingsModal.tsx': { flow: 'whats-new (workout settings)' },
  'components/modals/useBarcodeCameraModal.tsx': {
    unaudited: 'a hook that renders BarcodeCameraModal, which the fixture opens',
  },
  'components/theme/Modal.tsx': {
    unaudited: 'the primitive every modal renders through; audited through each of them',
  },
  'components/theme/Modal.web.tsx': {
    unaudited: 'the primitive every modal renders through on web; audited through each of them',
  },
  'components/weeklyReview/TargetsEditorSheet.tsx': { flow: 'weekly-review (edit recommendation)' },
  'components/whatsNew/WhatsNewModal.tsx': { flow: 'whats-new (tour intro)' },
  'components/workout/ExerciseNotesSheet.tsx': { flow: 'workout-session (notes)' },
  'components/workout/PlateCalculatorSheet.tsx': {
    unaudited: 'not scripted yet: a barbell lift’s “Why?” → plates, which needs an active gym',
  },
  'components/workout/WorkoutReminderExplainerSheet.tsx': {
    unaudited: 'opened only by tapping a workout reminder notification, which web never delivers',
  },
  'components/workout/session/ProgressionWhySheet.tsx': { flow: 'workout-session (why)' },
  'components/workout/session/SetDetailsSheet.tsx': { flow: 'workout-session (set details)' },
  'components/yearInReview/YearShareSheet.tsx': {
    unaudited: 'not scripted yet: Your year in Musclog → share (captured by screenshots:wrapped)',
  },
};
