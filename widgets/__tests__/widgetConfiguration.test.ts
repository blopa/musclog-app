import { readFileSync } from 'fs';
import { join } from 'path';

const root = join(__dirname, '../..');
const app = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8')).expo;

it('configures both platforms, previews, identities, and existing compact Android dimensions', () => {
  const [name, config] = app.plugins.find(
    (plugin: unknown) => Array.isArray(plugin) && plugin[0] === 'expo-widgets'
  );
  expect(name).toBe('expo-widgets');
  expect(config.enableAndroid).toBe(true);
  expect(config.bundleIdentifier).toBe(`${app.ios.bundleIdentifier}.ExpoWidgetsTarget`);
  expect(config.groupIdentifier).toBe(`group.${app.ios.bundleIdentifier}`);
  expect(config.widgets.map((widget: { name: string }) => widget.name)).toEqual([
    'Nutrition',
    'SmartCamera',
    'ActivityHeatmap',
    'Cycle',
  ]);
  // The nutrition ring needs two rows; this matches the iOS medium family.
  expect(config.widgets[0].android).toMatchObject({
    minWidth: 250,
    minHeight: 110,
    targetCellWidth: 4,
    targetCellHeight: 2,
  });
  expect(config.widgets[1].android).toMatchObject({ targetCellWidth: 1, targetCellHeight: 1 });
  // Thirty 5dp squares with 2dp gaps need the 4-cell width, and two rows plus a title need two cells of height.
  expect(config.widgets[2].android).toMatchObject({
    minWidth: 250,
    minHeight: 110,
    targetCellWidth: 4,
    targetCellHeight: 2,
  });
  expect(config.widgets[3].android).toMatchObject({ targetCellWidth: 2, targetCellHeight: 1 });
  expect(config.widgets[0].ios.supportedFamilies).toEqual(['systemSmall', 'systemMedium']);
  expect(config.widgets[1].ios.supportedFamilies).toEqual(['systemSmall']);
  expect(config.widgets[2].ios.supportedFamilies).toEqual(['systemMedium']);
  expect(config.widgets[3].ios.supportedFamilies).toEqual(['systemSmall']);
  for (const widget of config.widgets) {
    expect(readFileSync(join(root, widget.ios.initialLayout), 'utf8')).toContain("'widget'");
    expect(readFileSync(join(root, widget.android.initialLayout), 'utf8')).toContain("'widget'");
  }

  const source = readFileSync(join(root, 'ios/ExpoWidgetsTarget/Info.plist'), 'utf8');
  expect(source).toContain(`<string>${app.version}</string>`);
  expect(source).toContain(`<string>${app.ios.buildNumber}</string>`);
  for (const path of [
    'ios/ExpoWidgetsTarget/ExpoWidgetsTarget.entitlements',
    'ios/MusclogLiftLogRepeat/MusclogLiftLogRepeat.entitlements',
  ]) {
    expect(readFileSync(join(root, path), 'utf8')).toContain(config.groupIdentifier);
  }
});

// WidgetKit refuses to archive an image larger than the widget itself
// (`ArchivingError.imageTooLarge`) and silently keeps the last good render, so the camera tile's
// artwork must stay well under a small widget's pixel size (about 1073x976 px on a 3x phone).
it('keeps the camera widget artwork small enough for WidgetKit to archive', () => {
  const png = readFileSync(join(root, 'assets/camera-widget.png'));
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);

  expect(Math.max(width, height)).toBeLessThanOrEqual(512);
});
