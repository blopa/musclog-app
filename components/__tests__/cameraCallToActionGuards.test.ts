import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * These components render through React Native primitives that this repo cannot mount under Jest,
 * so the rules are checked at source level. Only the invariants are pinned, not how each gate is
 * spelled, so a refactor that keeps the behaviour passes:
 *
 * 1. Leaves never read the camera hook.
 * 2. Each leaf's camera prop is optional and its button is conditional on that prop.
 * 3. The camera fact has one source: SmartCameraContext exposes no `hasCamera` and keeps the backstop.
 * 4. The form scanner gates itself; its callers pass `openScanner` through without the hook.
 * 5. Screen owners that supply camera handlers read `hasCamera`.
 * 6. Other owners read `useHasCamera()` from CameraView.
 *
 * Whitespace is collapsed before matching, so formatting (indentation, line breaks) is never pinned.
 */
const ROOT = join(__dirname, '..', '..');

function source(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), 'utf8').replace(/\s+/g, ' ');
}

const LEAF_PROPS: Array<[string, string]> = [
  ['components/BarcodeInput.tsx', 'onScanPress'],
  ['components/nutrition/FoodQuickActions.tsx', 'onScanBarcode'],
  ['components/modals/AddFoodModal.tsx', 'onScanBarcodePress'],
  ['components/modals/AddFoodModal.tsx', 'onAiCameraPress'],
  ['components/modals/FoodSearchModal.tsx', 'onBarcodeScanPress'],
];

const LEAVES = [
  'components/BarcodeInput.tsx',
  'components/nutrition/FoodQuickActions.tsx',
  'components/modals/AddFoodModal.tsx',
  'components/modals/FoodSearchModal.tsx',
];

const CALLERS = [
  'components/modals/CreateCustomFoodModal.tsx',
  'components/modals/FoodMealTrackingDetailsModal.tsx',
  'components/modals/ScannedFoodDetailsModal.tsx',
  'components/modals/AddFoodItemToMealModal.tsx',
];

const SCREEN_OWNERS = [
  'app/app/(tabs)/index.tsx',
  'app/app/(tabs)/nutrition/food.tsx',
  'app/app/test/modals.tsx',
];

const OTHER_OWNERS = [
  'context/VoiceCommandContext.tsx',
  'components/settings/VoiceToolsSheet.tsx',
  'components/NavigationMenu.tsx',
  'components/modals/MyMealsModal.tsx',
  'components/modals/OpticalTransferModal.tsx',
  'app/app/onboarding/landing.tsx',
  'components/comeback/ComebackTips.tsx',
  'hooks/useAvailableHomeActions.ts',
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

describe('camera call to action guards: leaves', () => {
  it.each(LEAVES)('%s does not read the camera hook', (file) => {
    expect(source(file)).not.toContain('useHasCamera');
  });

  it.each(LEAF_PROPS)('%s makes %s optional and conditionally renders its button', (file, prop) => {
    const text = source(file);
    const p = escapeRegExp(prop);

    expect(text).toContain(`${prop}?: () => void`);
    expect(text).toMatch(new RegExp(`(\\{${p} \\?|&& ${p} \\?)`));
  });
});

describe('camera call to action guards: single source', () => {
  it('SmartCameraContextType does not carry hasCamera', () => {
    const text = source('context/SmartCameraContext.tsx');
    const typeBody = text.slice(
      text.indexOf('type SmartCameraContextType = {'),
      text.indexOf('};', text.indexOf('type SmartCameraContextType = {'))
    );

    expect(typeBody).not.toContain('hasCamera');
  });

  it('the SmartCameraContext provider keeps the backstop', () => {
    expect(source('context/SmartCameraContext.tsx')).toContain('if (!hasCamera) { return; }');
  });
});

describe('camera call to action guards: form scanner', () => {
  it('useBarcodeCameraModal gates its scanner on useHasCamera', () => {
    const text = source('components/modals/useBarcodeCameraModal.tsx');

    expect(text).toContain('useHasCamera()');
    expect(text).toContain('hasCamera ? ');
  });

  it.each(CALLERS)('%s does not read the camera hook itself', (file) => {
    expect(source(file)).not.toContain('useHasCamera');
  });
});

describe('camera call to action guards: owners', () => {
  it.each(SCREEN_OWNERS)('%s reads hasCamera and gates its handlers on it', (file) => {
    const text = source(file);

    expect(text).toContain('useHasCamera()');
    expect(text).toContain('hasCamera ?');
  });

  it.each(OTHER_OWNERS)('%s calls useHasCamera imported from CameraView', (file) => {
    const text = source(file);

    expect(text).toMatch(/import \{[^}]*\buseHasCamera\b[^}]*\} from '@\/components\/CameraView';/);
    expect(text).toContain('useHasCamera()');
  });
});
