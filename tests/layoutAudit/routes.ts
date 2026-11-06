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
  { name: 'weekly-review', path: '/weekly-review', file: 'weekly-review', area: 'main' },
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
 * Route files that are not audited as their own page. The live-workout screens are reached by
 * starting a workout (see `auditWorkoutSession` in the spec); the rest need state a URL cannot
 * carry.
 */
export const UNAUDITED_ROUTES: UnauditedRoute[] = [
  { file: '_layout', reason: 'layout, renders no screen of its own' },
  {
    file: 'nutrition/checkin-list',
    reason: 'deprecated redirect to the Weekly Review, kept for saved links',
  },
  {
    file: 'workout/workout-session',
    reason: 'audited through the Start workout flow, which needs a template and an active log',
  },
  {
    file: 'workout/workout-summary',
    reason: 'needs a just-finished workout log; finishing a session is not scripted',
  },
  { file: 'workout/rest-timer', reason: 'needs a running rest timer from a live session' },
  { file: 'workout/rest-over', reason: 'needs a rest timer that has just ended' },
  { file: 'workout/exercise-transition', reason: 'needs the next exercise of a live session' },
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
