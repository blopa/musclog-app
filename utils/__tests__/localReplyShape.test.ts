import { LOCAL_FOOD_IDENTIFY_SCHEMA } from '../localFoodPhoto';
import { diagnoseLocalReply } from '../localReplyShape';

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
