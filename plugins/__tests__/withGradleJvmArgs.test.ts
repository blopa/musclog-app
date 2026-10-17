jest.mock('expo/config-plugins', () => ({
  withGradleProperties: (config: any, action: (c: any) => any) => action(config),
}));

const withGradleJvmArgs = require('../withGradleJvmArgs');

describe('withGradleJvmArgs', () => {
  it('replaces stale values and caps parallel workers to avoid daemon OOM kills', () => {
    const result = withGradleJvmArgs({
      modResults: [
        { type: 'property', key: 'org.gradle.jvmargs', value: '-Xmx512m' },
        { type: 'property', key: 'org.gradle.workers.max', value: '16' },
        { type: 'property', key: 'other', value: 'kept' },
      ],
    });
    const props = Object.fromEntries(result.modResults.map((p: any) => [p.key, p.value]));

    expect(props['org.gradle.jvmargs']).toContain('-Xmx4g');
    expect(props['org.gradle.workers.max']).toBe('2');
    expect(props.other).toBe('kept');
    expect(result.modResults).toHaveLength(3);
  });
});
