import {
  checkStructuredShape,
  jsonRepairMessage,
  jsonRepairPrompt,
  jsonSpan,
  MAX_JSON_REPAIR_INPUT_CHARS,
  parseStructuredJson,
  repairReplyJson,
  stripStreamingTemplateTokens,
  stripTemplateTokens,
} from '../localReplyShape';

describe('stripTemplateTokens and jsonSpan', () => {
  const leaked = '<|im_start|>assistant { "items": [ {"name": "rice", "grams": 150} ] }';

  it('removes the chat-template header the model leaked', () => {
    expect(stripTemplateTokens(leaked)).toBe('{ "items": [ {"name": "rice", "grams": 150} ] }');
    expect(stripTemplateTokens('{"a":1}<|im_end|>')).toBe('{"a":1}');
    expect(stripTemplateTokens('{"a":"<not a token>"}')).toBe('{"a":"<not a token>"}');
  });

  it('finds the JSON inside surrounding text', () => {
    expect(jsonSpan('Here you go: {"items":[]} hope that helps')).toBe('{"items":[]}');
    expect(jsonSpan('no json here')).toBeNull();
    expect(jsonSpan('} backwards {')).toBeNull();
  });
});

describe('repairReplyJson', () => {
  it('repairs trailing commas and single quotes', () => {
    expect(repairReplyJson("{'items': [{'name': 'rice', 'grams': 150,},],}")).toEqual({
      items: [{ name: 'rice', grams: 150 }],
    });
  });

  it('closes a reply cut off by the token limit, dropping the half-written item', () => {
    expect(repairReplyJson('{"items":[{"name":"rice","grams":150},{"name":"chick')).toEqual({
      items: [{ name: 'rice', grams: 150 }],
    });
  });

  it('repairs JSON that has a sentence before and after it', () => {
    expect(repairReplyJson('Sure! {"items": [],} Hope that helps')).toEqual({ items: [] });
  });

  it('gives up on text with no JSON in it', () => {
    expect(repairReplyJson('nothing here')).toBeUndefined();
    expect(repairReplyJson('')).toBeUndefined();
  });
});

describe('stripStreamingTemplateTokens', () => {
  /** What the bubble shows after each chunk of a stream. */
  const frames = (chunks: string[]) => {
    let raw = '';

    return chunks.map((chunk) => {
      raw += chunk;

      return stripStreamingTemplateTokens(raw);
    });
  };

  it('never shows a token or a role word, even split across chunks', () => {
    const shown = frames([
      '<',
      '|im_start|>',
      'assi',
      'stant ',
      'Any',
      'time! ',
      'Rest <',
      '|im_end|>',
    ]);

    expect(shown).toEqual(['', '', '', '', 'Any', 'Anytime! ', 'Anytime! Rest ', 'Anytime! Rest ']);
  });

  it('only ever grows the visible text of an ordinary reply', () => {
    const shown = frames(['Push ', 'pull ', 'legs, ', '5 < 6 ', 'is true.']);

    shown.slice(1).forEach((text, i) => expect(text.startsWith(shown[i])).toBe(true));
    expect(shown.at(-1)).toBe('Push pull legs, 5 < 6 is true.');
  });

  it('keeps a real word that only starts like a role', () => {
    expect(stripStreamingTemplateTokens('<|im_start|>Modeling your week')).toBe(
      'Modeling your week'
    );
    expect(stripTemplateTokens('<|im_start|>Modeling your week')).toBe('Modeling your week');
  });
});

describe('repair call prompt and message', () => {
  it('names the schema and asks for JSON only', () => {
    const schema = { type: 'object', properties: { items: { type: 'array' } } };
    const prompt = jsonRepairPrompt(schema);
    expect(prompt).toContain(JSON.stringify(schema));
    expect(prompt).toContain('"items"');
    expect(prompt).toContain('Return only the corrected JSON');
  });

  it('prefixes the broken reply and truncates it to the cap', () => {
    expect(jsonRepairMessage('{"items":[')).toBe('Malformed JSON:\n{"items":[');
    const long = 'x'.repeat(MAX_JSON_REPAIR_INPUT_CHARS + 500);
    expect(jsonRepairMessage(long)).toBe(
      `Malformed JSON:\n${'x'.repeat(MAX_JSON_REPAIR_INPUT_CHARS)}`
    );
  });
});

describe('parseStructuredJson', () => {
  it('reads plain, fenced and template-wrapped JSON', () => {
    expect(parseStructuredJson('{"a":1}')).toEqual({ kind: 'ok', value: { a: 1 } });
    expect(parseStructuredJson('```json\n{"a":1}\n```')).toEqual({ kind: 'ok', value: { a: 1 } });
    expect(parseStructuredJson('<|im_start|>assistant {"a":1}')).toEqual({
      kind: 'ok',
      value: { a: 1 },
    });
  });

  it('finds JSON inside prose and repairs almost-JSON', () => {
    expect(parseStructuredJson('Sure! Here it is: {"a":1} hope it helps')).toEqual({
      kind: 'ok',
      value: { a: 1 },
    });
    expect(parseStructuredJson('{"a":1,}')).toEqual({ kind: 'ok', value: { a: 1 } });
  });

  it('is malformed for empty or garbage input', () => {
    expect(parseStructuredJson('')).toEqual({ kind: 'malformed', raw: '' });
  });

  it('keeps the full raw text of an unparseable reply, so the repair sees all of it', () => {
    const garbage = 'x'.repeat(1500);
    expect(parseStructuredJson(garbage)).toEqual({ kind: 'malformed', raw: garbage });
  });
});

describe('checkStructuredShape', () => {
  const schema = {
    type: 'object',
    properties: { n: { type: 'number' } },
    required: ['n'],
  };

  it('passes a malformed result through and returns a matching one unchanged', () => {
    const bad = { kind: 'malformed', raw: 'x' } as const;
    expect(checkStructuredShape(bad, schema, 'op')).toBe(bad);
    const ok = { kind: 'ok', value: { n: 1 } } as const;
    expect(checkStructuredShape(ok, schema, 'op')).toBe(ok);
  });

  it('turns a mismatch into malformed with the full JSON of the value', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const value = { n: 'x'.repeat(700) };
    const result = checkStructuredShape({ kind: 'ok', value }, schema, 'op');
    expect(JSON.stringify(value).length).toBeGreaterThan(500);
    expect(result).toEqual({ kind: 'malformed', raw: JSON.stringify(value) });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
