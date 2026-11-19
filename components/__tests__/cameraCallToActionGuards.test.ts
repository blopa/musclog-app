import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * These components render through React Native primitives that this repo cannot mount under Jest,
 * so the rules are checked at source level, on semantic tokens only: whitespace is collapsed
 * before matching, so formatting (indentation, line breaks) is never pinned.
 *
 * The convention (like `SmartCameraShell`'s shutter): a camera button renders iff its handler is
 * supplied. Leaves never read the camera hook; the owner that builds the handler supplies it only
 * while the device has a camera.
 */
const ROOT = join(__dirname, '..', '..');

function source(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), 'utf8').replace(/\s+/g, ' ');
}

const LEAVES = [
  'components/BarcodeInput.tsx',
  'components/nutrition/FoodQuickActions.tsx',
  'components/modals/AddFoodModal.tsx',
  'components/modals/FoodSearchModal.tsx',
];

describe('camera call to action guards: leaves', () => {
  it.each(LEAVES)('%s does not read the camera hook', (file) => {
    expect(source(file)).not.toContain('useHasCamera');
  });

  it('BarcodeInput renders the scan button only with onScanPress', () => {
    const text = source('components/BarcodeInput.tsx');

    expect(text).toContain('onScanPress?: () => void;');
    expect(text).toContain('{onScanPress ? ( <Pressable');
  });

  it('FoodQuickActions omits the scan slot without onScanBarcode and keeps the others', () => {
    const text = source('components/nutrition/FoodQuickActions.tsx');

    expect(text).toContain('onScanBarcode?: () => void;');
    expect(text).toMatch(/\{onScanBarcode \? slot\( 'scan',/);

    for (const key of ['search', 'meals', 'more']) {
      expect(text).toContain(`slot( '${key}',`);
    }
  });

  it('AddFoodModal renders the barcode and AI camera methods only with their handlers', () => {
    const text = source('components/modals/AddFoodModal.tsx');

    expect(text).toMatch(/\{onScanBarcodePress \? \( <TrackingMethodButton icon=\{ScanLine\}/);
    expect(text).toContain('{isAiEnabled && onAiCameraPress ? (');
  });

  it('FoodSearchModal shows the barcode icon only with onBarcodeScanPress', () => {
    const text = source('components/modals/FoodSearchModal.tsx');

    expect(text).toContain('const showBarcodeScan = onBarcodeScanPress !== undefined;');
    expect(text).toContain('{showBarcodeScan ? ( <Pressable');
    expect(text).toContain("showBarcodeScan ? 'pr-10' : ''");
  });
});

describe('camera call to action guards: owners', () => {
  it('SmartCameraContext exposes the single hasCamera subscription', () => {
    const text = source('context/SmartCameraContext.tsx');

    expect(text).toContain('hasCamera: boolean;');
    expect(text).toContain('const hasCamera = useHasCamera();');
    expect(text).toContain('if (!hasCamera) { return; }');
  });

  it.each([
    ['app/app/(tabs)/index.tsx', ['onAiCameraPress', 'onScanBarcodePress', 'onBarcodeScanPress']],
    ['app/app/test/modals.tsx', ['onAiCameraPress', 'onScanBarcodePress', 'onBarcodeScanPress']],
    [
      'app/app/(tabs)/nutrition/food.tsx',
      ['onScanBarcode', 'onAiCameraPress', 'onScanBarcodePress', 'onBarcodeScanPress'],
    ],
  ])('%s supplies camera handlers only with hasCamera', (file, props) => {
    const text = source(file);

    expect(text).toMatch(/const \{[^}]*\bhasCamera\b[^}]*\} = useSmartCamera\(\);/);

    for (const prop of props) {
      expect(text).toMatch(new RegExp(`${prop}=\\{ ?hasCamera \\?`));
    }
  });

  it.each([
    'components/modals/CreateCustomFoodModal.tsx',
    'components/modals/FoodMealTrackingDetailsModal.tsx',
    'components/modals/ScannedFoodDetailsModal.tsx',
  ])('%s passes the scanner to BarcodeInput only with a camera', (file) => {
    const text = source(file);

    expect(text).toContain("import { useHasCamera } from '@/components/CameraView';");
    expect(text).toContain('const hasCamera = useHasCamera();');
    expect(text).toContain('onScanPress={hasCamera ? openScanner : undefined}');
  });

  it('AddFoodItemToMealModal draws its own scan icon only with a camera', () => {
    const text = source('components/modals/AddFoodItemToMealModal.tsx');

    expect(text).toContain("import { useHasCamera } from '@/components/CameraView';");
    expect(text).toMatch(/icon=\{ hasCamera \? \( <Pressable/);
  });

  it('MyMealsModal passes the phone import only with a camera', () => {
    expect(source('components/modals/MyMealsModal.tsx')).toContain(
      'onImportFromPhone={hasCamera ? handleImportFromPhone : undefined}'
    );
  });

  it('the navigation bar renders the camera button only with a camera', () => {
    expect(source('components/NavigationMenu.tsx')).toContain('{hasCamera ? <CameraNavButton');
  });

  it.each([
    'app/app/onboarding/landing.tsx',
    'components/NavigationMenu.tsx',
    'components/modals/MyMealsModal.tsx',
    'components/modals/OpticalTransferModal.tsx',
    'components/comeback/ComebackTips.tsx',
    'hooks/useAvailableHomeActions.ts',
    'context/SmartCameraContext.tsx',
  ])('%s reads useHasCamera from CameraView', (file) => {
    expect(source(file)).toMatch(
      /import \{[^}]*\buseHasCamera\b[^}]*\} from '@\/components\/CameraView';/
    );
  });
});
