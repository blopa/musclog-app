import { getChatReviewInstruction } from '../prompts';

jest.mock('@/database/services/AiCustomPromptService', () => ({
  AiCustomPromptService: { getActivePrompts: jest.fn(), getMemoriesForPrompt: jest.fn() },
}));
jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: { get: jest.fn() },
}));

/**
 * The Tokenmaxxing chat review is the one second pass no code judges (a meal review is kept only
 * when it has fewer implausible numbers, an insight only when it has fewer ungrounded figures). So
 * the instruction is a checklist, and a draft that passes it must come back unchanged.
 */
describe('getChatReviewInstruction', () => {
  const instruction = getChatReviewInstruction('pt-BR');
  const lines = instruction.split('\n');

  it('lists the four checks, in order', () => {
    const checks = lines.filter((line) => /^[1-4]\. /.test(line));

    expect(checks).toHaveLength(4);
    expect(checks[0]).toMatch(/^1\. Facts:.*contradicts the app data or the conversation.*Fix it/);
    expect(checks[1]).toMatch(/^2\. Unsupported claims:.*nothing in the conversation.*Remove it/);
    expect(checks[2]).toMatch(/^3\. Safety:/);
    expect(checks[3]).toMatch(/^4\. Fit:/);
  });

  it('names every safety signal and asks to narrow, not optimise, and to suggest a professional', () => {
    const safety = lines.find((line) => line.startsWith('3. Safety')) ?? '';

    for (const signal of [
      'pain or injury',
      'eating disorder',
      'extreme calorie deficit',
      'pregnancy',
      'medication',
    ]) {
      expect(safety).toContain(signal);
    }

    expect(safety).toContain('narrow the advice');
    expect(safety).toContain('no optimisation advice that could cause harm');
    expect(safety).toContain('qualified professional');
  });

  it('asks for the persona voice, the length rules and the person’s language in the fit check', () => {
    const fit = lines.find((line) => line.startsWith('4. Fit')) ?? '';

    expect(fit).toContain('persona voice');
    expect(fit).toContain('length rules');
    expect(fit).toContain('the language the person writes in');
    expect(fit).toContain('the app language is pt-BR');
  });

  it('returns a draft that passes every check unchanged', () => {
    expect(instruction).toContain('passes all four checks, reply with the draft UNCHANGED');
    expect(instruction).toContain('word for word');
    expect(instruction).toContain('Do not polish it');
  });

  it('is not an open review: nothing asks to improve the draft or fill in what it missed', () => {
    expect(instruction).not.toMatch(/fill in/i);
    expect(instruction).not.toMatch(/improve/i);
    expect(instruction).not.toMatch(/keep what is right/i);
  });

  it('keeps the reply format and the rule never to mention a draft or a review', () => {
    expect(instruction).toContain('Use the same reply format');
    expect(instruction).toContain('Never mention that a draft, a review or a second pass exists.');
  });

  it("quotes nothing: the draft is the model's own previous reply, so there are no markers", () => {
    expect(instruction).not.toMatch(/<<<|>>>/);
    expect(instruction).not.toMatch(/MESSAGE|DRAFT/);
    expect(instruction).toContain('Your previous reply above is a draft');
    expect(instruction).toContain('Write only the reply the person will read');
  });
});
