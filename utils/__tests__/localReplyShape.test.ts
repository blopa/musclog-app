import {
  jsonSpan,
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
