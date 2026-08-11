import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type BuildPropertiesConfig = {
  android?: {
    enableMinifyInReleaseBuilds?: boolean;
    enableShrinkResourcesInReleaseBuilds?: boolean;
  };
};

describe('Android release optimization config', () => {
  it('keeps R8 minification and resource shrinking enabled together', () => {
    const repositoryRoot = join(__dirname, '..', '..');
    const appJson = JSON.parse(readFileSync(join(repositoryRoot, 'app.json'), 'utf8'));
    const plugin = appJson.expo.plugins.find(
      (entry: unknown): entry is [string, BuildPropertiesConfig] =>
        Array.isArray(entry) && entry[0] === 'expo-build-properties'
    );

    expect(plugin).toBeDefined();
    expect(plugin?.[1].android).toMatchObject({
      enableMinifyInReleaseBuilds: true,
      enableShrinkResourcesInReleaseBuilds: true,
    });

    const gradleProperties = readFileSync(
      join(repositoryRoot, 'android', 'gradle.properties'),
      'utf8'
    );
    expect(gradleProperties).toMatch(/^android\.enableMinifyInReleaseBuilds=true$/m);
    expect(gradleProperties).toMatch(/^android\.enableShrinkResourcesInReleaseBuilds=true$/m);
  });
});
