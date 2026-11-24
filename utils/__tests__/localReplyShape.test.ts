import { LOCAL_FOOD_IDENTIFY_SCHEMA } from '../localFoodPhoto';
import {
  diagnoseLocalReply,
  jsonSpan,
  repairReplyJson,
  stripTemplateTokens,
} from '../localReplyShape';

describe('diagnoseLocalReply', () => {
  it('names a bare array as a schema failure and keeps no values', () => {
    const result = diagnoseLocalReply(
      '[{"name":"chicken","grams":150}]',
      LOCAL_FOOD_IDENTIFY_SCHEMA
    );

    expect(result.reason).toMatch(/^schema \$: expected object/);
    expect(result.skeleton).toBe('[{name:str,grams:number}]x1');
    expect(result.skeleton).not.toContain('chicken');
  });

  it('names a missing required field', () => {
    const result = diagnoseLocalReply('{"foods":[]}', LOCAL_FOOD_IDENTIFY_SCHEMA);

    expect(result.reason).toBe('schema items: missing');
    expect(result.skeleton).toBe('{foods:[]x0}');
  });

  it('flattens text that is not JSON', () => {
    const result = diagnoseLocalReply(
      'Sure! I see rice 200 g and eggs',
      LOCAL_FOOD_IDENTIFY_SCHEMA
    );

    expect(result.reason).toBe('not-json');
    expect(result.skeleton).toBe('a! a a a 9 a a a');
    expect(result.skeleton).not.toMatch(/rice|eggs/);
  });

  it('strips a code fence before judging', () => {
    expect(
      diagnoseLocalReply('```json\n{"items":[]}\n```', LOCAL_FOOD_IDENTIFY_SCHEMA).reason
    ).toBe('schema-ok');
  });

  it('reports an empty reply', () => {
    expect(diagnoseLocalReply('  ', LOCAL_FOOD_IDENTIFY_SCHEMA).reason).toBe('empty');
  });
});

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
