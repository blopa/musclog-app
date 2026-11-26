import { getVoiceCommandSystemPrompt } from '@/utils/voiceCommand/prompt';
import { VOICE_TOOL_NAMES } from '@/utils/voiceCommand/types';

describe('getVoiceCommandSystemPrompt', () => {
  it('names every tool', () => {
    const prompt = getVoiceCommandSystemPrompt();

    for (const name of VOICE_TOOL_NAMES) {
      expect(prompt).toContain(name);
    }
  });

  it('stays within 2000 characters', () => {
    expect(getVoiceCommandSystemPrompt().length).toBeLessThanOrEqual(2000);
  });
});
