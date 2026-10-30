import { buildClaudeMessages, claudeEffort, claudeStreamDelta, extractClaudeText } from '../claude';

describe('buildClaudeMessages', () => {
  it('ends with the new user message', () => {
    expect(
      buildClaudeMessages(
        [
          { role: 'user', content: 'hi' },
          { role: 'coach', content: 'hello' },
        ],
        'how many calories?'
      )
    ).toEqual([
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' },
      { role: 'user', content: 'how many calories?' },
    ]);
  });

  it('drops a leading coach message, since Claude needs the first turn to be the user', () => {
    const messages = buildClaudeMessages([{ role: 'coach', content: 'Welcome!' }], 'hi');
    expect(messages).toEqual([{ role: 'user', content: 'hi' }]);
  });

  it('merges consecutive turns of one role and skips empty ones', () => {
    const messages = buildClaudeMessages(
      [
        { role: 'user', content: 'a' },
        { role: 'user', content: 'b' },
        { role: 'coach', content: '   ' },
        { role: 'coach', content: 'c' },
        { role: 'coach', content: 'd' },
      ],
      'e'
    );
    expect(messages).toEqual([
      { role: 'user', content: 'a\nb' },
      { role: 'assistant', content: 'c\nd' },
      { role: 'user', content: 'e' },
    ]);
  });

  it('joins a user turn that directly precedes the new message', () => {
    expect(buildClaudeMessages([{ role: 'user', content: 'a' }], 'b')).toEqual([
      { role: 'user', content: 'a\nb' },
    ]);
  });

  it('keeps image blocks as their own user turn', () => {
    const content = [
      {
        type: 'image' as const,
        source: { type: 'base64' as const, media_type: 'image/png' as const, data: 'x' },
      },
      { type: 'text' as const, text: 'what is this' },
    ];
    expect(buildClaudeMessages([{ role: 'user', content: 'a' }], content)).toEqual([
      { role: 'user', content: 'a' },
      { role: 'user', content },
    ]);
  });
});

describe('extractClaudeText', () => {
  const message = (content: unknown[], stop_reason = 'end_turn') =>
    ({ content, stop_reason }) as Parameters<typeof extractClaudeText>[0];

  it('joins the text blocks and ignores thinking', () => {
    expect(
      extractClaudeText(
        message([
          { type: 'thinking', thinking: 'hmm', signature: 's' },
          { type: 'text', text: 'Hello ' },
          { type: 'text', text: 'there' },
        ])
      ).text
    ).toBe('Hello there');
  });

  it('returns an empty answer for a refusal and says why in the log', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(extractClaudeText(message([], 'refusal'))).toEqual({ text: '', stopReason: 'refusal' });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('refusal'));
    warn.mockRestore();
  });
});

describe('claudeStreamDelta', () => {
  it('reads text deltas only', () => {
    expect(
      claudeStreamDelta({
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'text_delta', text: 'hi' },
      } as never)
    ).toBe('hi');
    expect(
      claudeStreamDelta({
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'thinking_delta', thinking: 'hmm' },
      } as never)
    ).toBeNull();
    expect(claudeStreamDelta({ type: 'message_stop' } as never)).toBeNull();
  });
});

describe('claudeEffort', () => {
  it('asks for little thinking unless the user opted into thinking mode', () => {
    expect(claudeEffort(false)).toBe('low');
    expect(claudeEffort(true)).toBe('high');
  });
});
