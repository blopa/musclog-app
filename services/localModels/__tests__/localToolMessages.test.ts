import { readToolCalls, toEngineMessages, toEngineTools } from '../localToolMessages';

describe('localToolMessages', () => {
  it('maps assistant tool calls (stable ids) and tool messages to snake_case', () => {
    expect(
      toEngineMessages([
        { role: 'user', content: 'hi' },
        { role: 'assistant', content: '', toolCalls: [{ name: 'a', arguments: '{}' }] },
        { role: 'tool', content: 'ok', toolCallId: 'call_0' },
      ])
    ).toEqual([
      { role: 'user', content: 'hi' },
      {
        role: 'assistant',
        content: '',
        tool_calls: [{ id: 'call_0', type: 'function', function: { name: 'a', arguments: '{}' } }],
      },
      { role: 'tool', content: 'ok', tool_call_id: 'call_0' },
    ]);
  });

  it('wraps tools as functions', () => {
    expect(
      toEngineTools([{ name: 'a', description: 'd', parameters: { type: 'object' } }])
    ).toEqual([
      {
        type: 'function',
        function: { name: 'a', description: 'd', parameters: { type: 'object' } },
      },
    ]);
  });

  it('reads calls: strings kept, objects stringified, nameless dropped, non-arrays empty', () => {
    expect(
      readToolCalls([
        { id: 'x', function: { name: 'a', arguments: '{"q":1}' } },
        { function: { name: 'b', arguments: { q: 2 } } },
        { function: { arguments: '{}' } },
      ])
    ).toEqual([
      { id: 'x', name: 'a', arguments: '{"q":1}' },
      { name: 'b', arguments: '{"q":2}' },
    ]);
    expect(readToolCalls(undefined)).toEqual([]);
  });
});
