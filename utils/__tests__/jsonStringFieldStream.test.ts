import { createJsonStringFieldReader, readJsonStringField } from '../jsonStringFieldStream';

const REPLY = {
  msg4User: 'Hello "Pablo"\nLine two \\ path 🏋️ — café é 😀 done',
  sumMsg: 'short',
  sumUserMsg: 'user',
  remember_me: 'likes squats',
};

describe('readJsonStringField', () => {
  it('returns the whole field once the object is complete', () => {
    expect(readJsonStringField(JSON.stringify(REPLY), 'msg4User')).toBe(REPLY.msg4User);
  });

  it('is always a prefix of the final value, whatever the chunk boundary', () => {
    const json = JSON.stringify(REPLY);
    for (let cut = 0; cut <= json.length; cut += 1) {
      const partial = readJsonStringField(json.slice(0, cut), 'msg4User');
      expect(REPLY.msg4User.startsWith(partial)).toBe(true);
    }
  });

  it('reads the same escaped text when the JSON uses \\u escapes for everything', () => {
    // split('') walks UTF-16 code units, so astral characters become their surrogate pair
    const escaped = `{"msg4User":"${REPLY.msg4User
      .split('')
      .map((unit) => `\\u${unit.charCodeAt(0).toString(16).padStart(4, '0')}`)
      .join('')}","sumMsg":"x"}`;
    for (let cut = 0; cut <= escaped.length; cut += 1) {
      const partial = readJsonStringField(escaped.slice(0, cut), 'msg4User');
      expect(REPLY.msg4User.startsWith(partial)).toBe(true);
    }

    expect(readJsonStringField(escaped, 'msg4User')).toBe(REPLY.msg4User);
  });

  it('never shows half of a surrogate pair', () => {
    const json = '{"msg4User":"a\\ud83d\\ude00b"}';
    const beforeLowSurrogate = json.indexOf('\\ude00');
    expect(readJsonStringField(json.slice(0, beforeLowSurrogate), 'msg4User')).toBe('a');
  });

  it('shows nothing until the field starts', () => {
    expect(readJsonStringField('', 'msg4User')).toBe('');
    expect(readJsonStringField('  {', 'msg4User')).toBe('');
    expect(readJsonStringField('{"msg4U', 'msg4User')).toBe('');
    expect(readJsonStringField('{"msg4User"', 'msg4User')).toBe('');
    expect(readJsonStringField('{"msg4User":', 'msg4User')).toBe('');
  });

  it('skips fields that come before the one asked for', () => {
    const json = '{"other":{"msg4User":"nested","list":["a","b"]},"n":12,"msg4User":"real"}';
    expect(readJsonStringField(json, 'msg4User')).toBe('real');
    expect(readJsonStringField(json.slice(0, json.indexOf('"real"') - 2), 'msg4User')).toBe('');
  });

  it('does not mistake the field name inside another value for the field', () => {
    expect(
      readJsonStringField('{"sumMsg":"my \\"msg4User\\":\\"x\\"","msg4User":"y"}', 'msg4User')
    ).toBe('y');
  });

  it('strips a markdown fence, including while the fence is still arriving', () => {
    expect(readJsonStringField('```', 'msg4User')).toBe('');
    expect(readJsonStringField('```js', 'msg4User')).toBe('');
    expect(readJsonStringField('```json\n{"msg4User":"hi', 'msg4User')).toBe('hi');
  });

  it('passes output that is not a JSON object straight through', () => {
    expect(readJsonStringField('Sure! Here is the plan', 'msg4User')).toBe(
      'Sure! Here is the plan'
    );
  });

  it('shows nothing for an object that has no such field', () => {
    expect(readJsonStringField('{"answer":"hi"}', 'msg4User')).toBe('');
  });
});

describe('createJsonStringFieldReader', () => {
  it('accumulates chunks and keeps the raw text for the final parse', () => {
    const reader = createJsonStringFieldReader('msg4User');
    const json = JSON.stringify(REPLY);
    let last = '';
    for (let i = 0; i < json.length; i += 7) {
      last = reader.push(json.slice(i, i + 7));
    }

    expect(last).toBe(REPLY.msg4User);
    expect(JSON.parse(reader.raw())).toEqual(REPLY);
  });
});
