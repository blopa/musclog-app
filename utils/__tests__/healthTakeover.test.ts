import {
  EMPTY_HEALTH_TAKEOVERS,
  MAX_HEALTH_TAKEOVERS,
  parseHealthTakeovers,
  serializeHealthTakeovers,
  withHealthTakeover,
} from '../healthTakeover';

describe('healthTakeover', () => {
  it('reads garbage as empty', () => {
    expect(parseHealthTakeovers('')).toEqual(EMPTY_HEALTH_TAKEOVERS);
    expect(parseHealthTakeovers('[1,2]')).toEqual(EMPTY_HEALTH_TAKEOVERS);
    expect(parseHealthTakeovers('{"ignoredRecordIds":"x","ownedLogIds":[1,"a",""]}')).toEqual({
      ignoredRecordIds: [],
      ownedLogIds: ['a'],
    });
  });

  it('round-trips and adds a takeover once', () => {
    const once = withHealthTakeover(EMPTY_HEALTH_TAKEOVERS, 'log', 'hc');
    const twice = withHealthTakeover(once, 'log', 'hc');
    expect(twice).toEqual({ ignoredRecordIds: ['hc'], ownedLogIds: ['log'] });
    expect(parseHealthTakeovers(serializeHealthTakeovers(twice))).toEqual(twice);
  });

  it('keeps only the newest entries when it grows past the cap', () => {
    let state = EMPTY_HEALTH_TAKEOVERS;
    for (let i = 0; i < MAX_HEALTH_TAKEOVERS + 5; i++) {
      state = withHealthTakeover(state, `log-${i}`, `hc-${i}`);
    }

    expect(state.ownedLogIds).toHaveLength(MAX_HEALTH_TAKEOVERS);
    expect(state.ownedLogIds[state.ownedLogIds.length - 1]).toBe(`log-${MAX_HEALTH_TAKEOVERS + 4}`);
    expect(state.ownedLogIds).not.toContain('log-0');
  });
});
