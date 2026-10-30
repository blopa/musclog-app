import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '../..');
const read = (file: string) => readFileSync(join(root, file), 'utf8');
/** Source without comments, so a comment explaining a rule is not mistaken for breaking it. */
const code = (file: string) => read(file).replace(/\/\*[\s\S]*?\*\/|(^|[^:])\/\/.*$/gm, '$1');
const listTs = (dir: string) =>
  readdirSync(join(root, dir))
    .filter((name) => /\.(ts|tsx)$/.test(name))
    .map((name) => `${dir}/${name}`);

const AI_SCREENS = ['setup', 'provider', 'chat', 'external', 'review'].map(
  (name) => `app/app/onboarding/ai-${name}.tsx`
);
const AI_ONBOARDING_FILES = [
  ...AI_SCREENS,
  ...listTs('utils/aiOnboarding'),
  ...listTs('components/aiOnboarding'),
  'hooks/useAiOnboardingChat.ts',
  'hooks/useAiOnboardingDraft.ts',
  'hooks/useAiGuidedExit.ts',
  'hooks/useAiSetupSession.ts',
  'services/aiOnboardingTurn.ts',
  'services/onboardingAnswersApply.ts',
  'services/aiProviderSetup.ts',
];

describe('AI onboarding is isolated from the coach', () => {
  it.each(AI_ONBOARDING_FILES)('%s touches no coach history, prompt or chat table', (file) => {
    const source = code(file);

    expect(source).not.toMatch(/useChatMessages|ChatService|chat_messages|CoachContext|useCoach/);
    // The coach's prompts append the person's custom prompts and memories; the setup prompt must not.
    expect(source).not.toMatch(/AiCustomPromptService|from '@\/utils\/prompts'/);
  });

  it('keeps its transcript in its own storage key, never the chat table', () => {
    expect(read('constants/misc.ts')).toContain("AI_ONBOARDING_DRAFT = 'aiOnboardingDraft'");
    expect(read('utils/aiOnboarding/draftStorage.ts')).toContain('AI_ONBOARDING_DRAFT');
  });
});

describe('credentials stay out of everything the AI setup shares', () => {
  const NEVER_MENTION_A_KEY = [
    'utils/aiOnboarding/contract.ts',
    'utils/aiOnboarding/instructions.ts',
    'utils/aiOnboarding/prompts.ts',
    'utils/aiOnboarding/draftStorage.ts',
    'utils/aiOnboarding/chatState.ts',
    'utils/aiOnboarding/turnSchema.ts',
    'hooks/useAiOnboardingChat.ts',
    'hooks/useAiOnboardingDraft.ts',
  ];

  it.each(NEVER_MENTION_A_KEY)('%s has no API key in it', (file) => {
    expect(code(file)).not.toMatch(/apiKey|api_key|getGoogleGeminiApiKey|getOpenAiApiKey/);
  });

  it('only the provider setup service saves a key, and only after the test passes', () => {
    const setup = read('services/aiProviderSetup.ts');

    expect(setup.indexOf("result !== 'ok'")).toBeGreaterThan(-1);
    expect(setup.indexOf("result !== 'ok'")).toBeLessThan(setup.indexOf('setGoogleGeminiApiKey'));
    for (const file of AI_ONBOARDING_FILES.filter((f) => f !== 'services/aiProviderSetup.ts')) {
      expect(read(file)).not.toMatch(/setGoogleGeminiApiKey|setOpenAiApiKey/);
    }
  });

  it('opens external chats with the instructions only, never user data', () => {
    const external = read('app/app/onboarding/ai-external.tsx');

    expect(external).toContain('buildExternalChatUrl');
    expect(external).not.toMatch(
      /SettingsService|UserService|UserMetricService|loadProfileSnapshot/
    );
    expect(read('utils/aiOnboarding/instructions.ts')).not.toMatch(
      /SettingsService|UserService|database\//
    );
  });
});

describe('screens', () => {
  it('the chat pins its composer with keyboard-controller, not React Native’s avoiding view', () => {
    const composer = read('components/aiOnboarding/ChatComposer.tsx');

    expect(composer).toContain('KeyboardStickyView');
    for (const file of AI_ONBOARDING_FILES.filter((f) => f.endsWith('.tsx'))) {
      expect(code(file)).not.toMatch(/KeyboardAvoidingView/);
    }
  });

  it('shows the review before anything is applied, and applies through the one pipeline', () => {
    const review = read('app/app/onboarding/ai-review.tsx');

    expect(review).toContain('applyOnboardingAnswers');
    expect(review).toContain('applyProfileUpdate');
    // Only the review applies; the other screens just collect.
    for (const file of AI_SCREENS.filter((f) => !f.endsWith('ai-review.tsx'))) {
      expect(read(file)).not.toMatch(/applyOnboardingAnswers|applyProfileUpdate/);
    }
  });

  it('every AI screen offers a way out to the forms', () => {
    for (const name of ['setup', 'external', 'review', 'chat']) {
      expect(read(`app/app/onboarding/ai-${name}.tsx`)).toMatch(/useAiGuidedExit|goGuided/);
    }
  });
});

describe('entry points and the guided flow', () => {
  it('the landing and the profile offer the AI setup without requiring a configured AI', () => {
    const landing = read('app/app/onboarding/landing.tsx');
    const profile = read('app/app/profile.tsx');

    expect(landing).toContain("aiSetupRoute('setup', 'onboarding')");
    expect(profile).toContain("aiSetupRoute('setup', 'profile')");
    expect(landing).not.toContain('isAiConfigured');
    expect(profile).not.toContain('isAiConfigured');
  });

  it('the personalized cycle step skips the Musclog AI step through the shared route helper', () => {
    const cycle = read('app/app/onboarding/personalized-cycle.tsx');

    expect(cycle).toContain('personalizedCycleRoutes');
    expect(cycle).toContain('skipMusclogApi');
  });

  it('the guided screens open prefilled from the saved drafts', () => {
    for (const file of [
      'personalized-preferences',
      'personalized-experience',
      'personalized-goals',
    ]) {
      expect(read(`app/app/onboarding/${file}.tsx`)).toContain('readPersonalizedSetup');
    }

    expect(read('app/app/onboarding/training-setup.tsx')).toContain('parseTrainingSetup');
    expect(read('app/app/onboarding/personalized-body-stats.tsx')).toContain('readBodyStatsDraft');
  });

  it('the guided body-stats screen saves through the shared writer, so readings do not stack', () => {
    const bodyStats = read('app/app/onboarding/personalized-body-stats.tsx');

    expect(bodyStats).toContain('commitOnboardingProfile');
    expect(bodyStats).not.toMatch(/createMetric|initializeUser|updateUserProfile/);
  });

  it('offers weight loss on both guided goal screens from the one options table', () => {
    for (const file of ['quick-goals', 'personalized-goals']) {
      expect(read(`app/app/onboarding/${file}.tsx`)).toContain('onboardingOptions');
    }

    expect(read('components/onboarding/onboardingOptions.ts')).toContain("'weight_loss'");
  });

  it('keeps the AI drafts out of backups', () => {
    const exclusions = read('constants/exportImport.ts');

    expect(exclusions).toContain('AI_ONBOARDING_DRAFT');
    expect(exclusions).toContain('PERSONALIZED_BODY_DRAFT');
  });
});
