import fs from 'node:fs';
import path from 'node:path';

const { addJobPools } = require('../withNativeBuildJobPools');

const ROOT_BUILD_GRADLE = path.resolve(__dirname, '../../android/build.gradle');
const TEMPLATE = `allprojects {}

apply plugin: "expo-root-project"
apply plugin: "com.facebook.react.rootproject"
`;

describe('withNativeBuildJobPools', () => {
  it('caps ninja compile and link jobs for every Android CMake module', () => {
    const result = addJobPools(TEMPLATE);

    expect(result).toContain('"-DCMAKE_JOB_POOLS=compile=${compileJobs};link=1"');
    expect(result).toContain('heavyNative ? 1 : 2');
    expect(result).toContain("'-DCMAKE_JOB_POOL_COMPILE=compile'");
    expect(result).toContain("'-DCMAKE_JOB_POOL_LINK=link'");
    expect(result).toContain("'com.android.application', 'com.android.library'");
  });

  it('limits Skia to one compile job', () => {
    expect(addJobPools(TEMPLATE)).toContain(
      "def heavyNative = ['shopify_react-native-skia'].contains(subproject.name)"
    );
  });

  // Release native code is built as RelWithDebInfo; the NDK adds `-g` earlier on
  // the command line, so `-g0` must be in the per-config flags to win.
  it('builds release C and C++ without debug info', () => {
    const result = addJobPools(TEMPLATE);

    expect(result).toContain("'-DCMAKE_C_FLAGS_RELWITHDEBINFO=-O2 -g0 -DNDEBUG'");
    expect(result).toContain("'-DCMAKE_CXX_FLAGS_RELWITHDEBINFO=-O2 -g0 -DNDEBUG'");
  });

  // The React Native root plugin evaluates :app on apply, so a block below it
  // would configure :app too late.
  it('inserts the block before the root project plugins', () => {
    const result: string = addJobPools(TEMPLATE);

    expect(result.indexOf('CMAKE_JOB_POOLS')).toBeLessThan(
      result.indexOf('apply plugin: "com.facebook.react.rootproject"')
    );
  });

  it('is idempotent', () => {
    const once = addJobPools(TEMPLATE);

    expect(addJobPools(once)).toBe(once);
  });

  it('fails loudly when the template changes shape', () => {
    expect(() => addJobPools('allprojects {}\n')).toThrow(/expo-root-project/);
  });

  it('is mirrored in the committed android/build.gradle', () => {
    const committed = fs.readFileSync(ROOT_BUILD_GRADLE, 'utf8');

    expect(addJobPools(committed)).toBe(committed);
    expect(committed).toContain('CMAKE_JOB_POOLS');
  });
});
