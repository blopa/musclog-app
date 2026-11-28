import {
  readToolCalls,
  toEngineMessages,
  toEngineTools,
  toolTemplateOverride,
} from '../localToolMessages';

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

describe('toolTemplateOverride', () => {
  // The line LFM2.5-VL-450M's template builds its tool list with: no `List of tools: [` literal.
  const split = String.raw`{%- set x = "\n\nList of tools: " + (tools | tojson) -%}`;

  it('adds the literal llama.cpp looks for to a template that builds the list another way', () => {
    const override = toolTemplateOverride(split);

    expect(override).toBe(`${split}{#- List of tools: [ -#}`);
    expect(override).toContain('List of tools: [');
  });

  it('leaves a template llama.cpp already recognises alone', () => {
    expect(toolTemplateOverride('{{- "List of tools: [" -}}')).toBeUndefined();
    expect(
      toolTemplateOverride('<|tool_list_start|>List of tools: <|tool_list_end|>')
    ).toBeUndefined();
  });

  it('leaves other tool formats and a missing template alone', () => {
    expect(toolTemplateOverride('<tools>{{ tool | tojson }}</tools>')).toBeUndefined();
    expect(toolTemplateOverride(undefined)).toBeUndefined();
    expect(toolTemplateOverride(42)).toBeUndefined();
  });
});

describe('toEngineMessages with a template that drops tool_calls', () => {
  // LFM2.5-1.2B's template renders only `content`: its tool list line is present, tool_calls is not read.
  const dropsCalls = String.raw`{%- set x = "List of tools: " -%}{{ message["content"] }}`;
  const callsMessage = {
    role: 'assistant' as const,
    content: 'Done.',
    toolCalls: [
      { name: 'copy_meal', arguments: '{"source":"yesterday","meal":"lunch"}' },
      { name: 'add_note', arguments: '{}' },
    ],
  };

  it('writes the calls into content as text, with no tool_calls field', () => {
    expect(toEngineMessages([callsMessage], dropsCalls)).toEqual([
      {
        role: 'assistant',
        content:
          '<|tool_call_start|>[copy_meal(source="yesterday", meal="lunch"), add_note()]<|tool_call_end|>Done.',
      },
    ]);
  });

  it('writes one call with arguments and leaves other messages unchanged', () => {
    expect(
      toEngineMessages(
        [
          { role: 'user', content: 'hi' },
          { role: 'assistant', content: '', toolCalls: [{ name: 'a', arguments: '{"x":1}' }] },
          { role: 'tool', content: 'ok', toolCallId: 'call_0' },
        ],
        dropsCalls
      )
    ).toEqual([
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: '<|tool_call_start|>[a(x=1)]<|tool_call_end|>' },
      { role: 'tool', content: 'ok', tool_call_id: 'call_0' },
    ]);
  });

  it('keeps today output for a template that reads tool_calls, has no list, or is missing', () => {
    const structured = toEngineMessages([callsMessage]);

    expect(
      toEngineMessages([callsMessage], '{% if tool_calls %}{% endif %}List of tools: ')
    ).toEqual(structured);
    expect(toEngineMessages([callsMessage], '{{ message["content"] }}')).toEqual(structured);
    expect(toEngineMessages([callsMessage], undefined)).toEqual(structured);
    expect(structured[0]).toHaveProperty('tool_calls');
  });
});
