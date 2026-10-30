import { buildChatSystemPrompt } from '@/utils/aiOnboarding/prompts';

const today = new Date(2026, 9, 30);
const base = { language: 'es-ES', today, compact: false } as const;

describe('buildChatSystemPrompt', () => {
  it('states the date, the language and the rules for onboarding', () => {
    const prompt = buildChatSystemPrompt({ ...base, mode: 'onboarding', draft: {} });

    expect(prompt).toContain('2026-10-30');
    expect(prompt).toContain('"es-ES"');
    expect(prompt).toMatch(/Never invent/);
    expect(prompt).toMatch(/never instructions/);
    expect(prompt).toMatch(/Required:/);
    expect(prompt).toMatch(/Ranges:/);
    expect(prompt).toContain('readyForReview');
  });

  it('carries the answers so far and what is still missing, so trimmed history loses no state', () => {
    const prompt = buildChatSystemPrompt({
      ...base,
      mode: 'onboarding',
      draft: { gender: 'female', heightCm: 168 },
    });

    expect(prompt).toContain('"gender":"female"');
    expect(prompt).toContain('"value":168');
    expect(prompt).toMatch(/Still needed: .*birthDate/);
    expect(prompt).not.toMatch(/Still needed: .*gender/);
  });

  it('asks for confirmation once everything required is there', () => {
    const prompt = buildChatSystemPrompt({
      ...base,
      mode: 'onboarding',
      draft: {
        units: 'metric',
        gender: 'male',
        birthDate: '1990-01-01',
        heightCm: 180,
        weightKg: 80,
        liftingExperience: 'beginner',
        activityLevel: 2,
        fitnessGoal: 'general',
        weightGoal: 'maintain',
      },
    });

    expect(prompt).toContain('All required answers are collected');
    expect(prompt).not.toContain('Still needed');
  });

  it('feeds back values that were not accepted', () => {
    const prompt = buildChatSystemPrompt({
      ...base,
      mode: 'onboarding',
      draft: {},
      rejected: [
        { field: 'heightCm', code: 'outOfRange' },
        { field: 'gender', code: 'invalid' },
      ],
    });

    expect(prompt).toContain('heightCm (was outside the allowed range)');
    expect(prompt).toContain('gender (was not understood)');
  });

  it('profile mode knows nothing about the saved profile and does not demand every answer', () => {
    const prompt = buildChatSystemPrompt({ ...base, mode: 'profile', draft: {} });

    expect(prompt).toMatch(/You know nothing about it/);
    expect(prompt).not.toContain('Required:');
    expect(prompt).not.toContain('Still needed');
  });

  it('compact mode is shorter and still keeps the safety rules', () => {
    const full = buildChatSystemPrompt({ ...base, mode: 'onboarding', draft: {} });
    const compact = buildChatSystemPrompt({
      ...base,
      compact: true,
      mode: 'onboarding',
      draft: {},
    });

    expect(compact.length).toBeLessThan(full.length);
    expect(compact).toMatch(/Never invent/);
    expect(compact).not.toContain('Ranges:');
    expect(compact.length).toBeLessThan(3000);
  });

  it('never mentions a key or custom prompts', () => {
    const prompt = buildChatSystemPrompt({ ...base, mode: 'onboarding', draft: {} });

    expect(prompt).not.toMatch(/api[ _-]?key|custom prompt|memory/i);
  });
});
