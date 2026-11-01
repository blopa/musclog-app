import { parseHealthTakeovers } from '../healthTakeover';

describe('legacy health takeover parser', () => {
  it('reads garbage as empty', () => {
    const empty = { ignoredRecordIds: [], ownedLogIds: [] };
    expect(parseHealthTakeovers('')).toEqual(empty);
    expect(parseHealthTakeovers('[1,2]')).toEqual(empty);
    expect(parseHealthTakeovers('null')).toEqual(empty);
    expect(parseHealthTakeovers('{"ignoredRecordIds":"x","ownedLogIds":[1,"a",""]}')).toEqual({
      ignoredRecordIds: [],
      ownedLogIds: ['a'],
    });
  });

  it('deduplicates valid ids without discarding history above 1000 entries', () => {
    const ids = Array.from({ length: 1005 }, (_, index) => `id-${index}`);
    const restored = parseHealthTakeovers(
      JSON.stringify({ ownedLogIds: [...ids, ids[0]], ignoredRecordIds: ids })
    );
    expect(restored.ownedLogIds).toEqual(ids);
    expect(restored.ignoredRecordIds).toEqual(ids);
  });
});
