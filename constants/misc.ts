import projectLinks from './projectLinks.json';

// Onboarding Keys
export const ONBOARDING_COMPLETED = 'onboardingCompleted';
export const ONBOARDING_VERSION = 'onboardingVersion';
export const CURRENT_ONBOARDING_VERSION = '1.0.0';
// Persist the current onboarding step for restore
export const ONBOARDING_CURRENT_STEP = 'onboardingCurrentStep';

// Temporary storage key used to pass an AI-generated nutrition plan between screens
export const TEMP_NUTRITION_PLAN = 'tempNutritionPlan';

// First-frame copy of a few settings (theme, language, units, lock scopes); see `utils/settingsMirror.ts`
export const SETTINGS_MIRROR_STORAGE_KEY = 'musclog_settings_mirror';

// Temporary storage key for quick-setup data accumulated across steps
export const QUICK_SETUP_DATA = 'quickSetupData';

// Temporary storage key for personalized-setup data accumulated across steps
export const PERSONALIZED_SETUP_DATA = 'personalizedSetupData';

/**
 * AI-assisted onboarding: the unfinished setup conversation and its draft answers. Encrypted, local
 * only, and deliberately separate from `chat_messages` so it can never show up in coach history.
 */
export const AI_ONBOARDING_DRAFT = 'aiOnboardingDraft';

// Encrypted birthday/height/weight/body-fat answers the guided body-stats screen is prefilled from
export const PERSONALIZED_BODY_DRAFT = 'personalizedBodyDraft';

// Current user (sync_id) for multi-user / future sync support
export const CURRENT_USER_SYNC_ID = 'currentUserSyncId';

export const UNREAD_CHAT_MESSAGES_COUNT = 'unreadChatMessages';

/**
 * A coach reply that is being streamed: what has arrived so far, written while it arrives so an
 * app that is closed mid-reply can keep it (`recoverInterruptedCoachReply`). Encrypted, local only,
 * and gone as soon as the reply is saved or fails.
 */
export const COACH_REPLY_JOURNAL = 'coachReplyJournal';

/**
 * The text of a message whose reply failed while nobody was looking at the chat, kept so the
 * composer is filled with it the next time that conversation opens. Encrypted, local only.
 */
export const COACH_RESTORED_COMPOSER = 'coachRestoredComposer';

/**
 * AsyncStorage key for the cached macro-logging streak state.
 * Stores JSON `{ computedDayKey, currentStreak, bestStreak }` so the streak is recomputed
 * at most once per local calendar day. See `utils/macroStreak.ts`.
 */
export const MACRO_STREAK_STATE = 'macroStreakState';

/** Public donation page (F-Droid and web “Support the Project” link only). */
export const SUPPORT_PROJECT_DONATION_URL = 'https://musclog.app/donate';

/**
 * Project links live in `projectLinks.json` rather than here because `scripts/generate-web-seo-files.js`
 * runs outside the app bundle and must read the same values (it cannot import TypeScript); every
 * other copy of the repository URL or the support address reads these constants.
 */
export const GITHUB_REPO_URL: string = projectLinks.githubRepoUrl;
export const GITHUB_LICENSE_URL = `${GITHUB_REPO_URL}/blob/main/LICENSE`;
export const SUPPORT_EMAIL: string = projectLinks.supportEmail;
export const SUPPORT_MAILTO_URL = `mailto:${SUPPORT_EMAIL}`;
/** There is no community server yet. While this is null, nothing links to one. */
export const DISCORD_INVITE_URL: string | null = projectLinks.discordInviteUrl;
/**
 * A directory of free helplines by country (run by a non-profit), linked quietly from comeback mode's
 * wellbeing question. A directory rather than one number because a single hotline is wrong in most
 * countries.
 */
export const WELLBEING_SUPPORT_URL: string = projectLinks.wellbeingSupportUrl;

// Training answers collected during onboarding (see `utils/onboardingTraining.ts`). Cleared once
// the first-workout screen has been dealt with.
export const TRAINING_SETUP_DATA = 'trainingSetupData';

// Set when onboarding finishes for someone who chose training: the Health Connect / Health prompt
// is held back until their first finished workout instead of interrupting the setup.
export const HEALTH_CONNECT_PROMPT_PENDING = 'healthConnectPromptPending';

// The one-time "how a set works" tip in the live workout session; set once it is dismissed.
export const WORKOUT_FIRST_TIP_SEEN = 'workoutFirstTipSeen';
