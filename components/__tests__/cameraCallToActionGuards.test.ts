import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * These components render through React Native primitives that this repo cannot mount under Jest,
 * so the guard is checked at source level: each camera call to action sits behind `useHasCamera()`.
 */
const ROOT = join(__dirname, '..', '..');

function source(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), 'utf8');
}

describe('camera call to action guards', () => {
  it.each([
    'components/BarcodeInput.tsx',
    'components/nutrition/FoodQuickActions.tsx',
    'components/modals/AddFoodModal.tsx',
    'components/modals/FoodSearchModal.tsx',
    'components/modals/AddFoodItemToMealModal.tsx',
  ])('%s reads useHasCamera from the hook module', (file) => {
    const text = source(file);

    expect(text).toContain("import { useHasCamera } from '@/hooks/useHasCamera';");
    expect(text).toMatch(/const hasCamera = useHasCamera\(\);/);
  });

  it('BarcodeInput renders the scan button only with a camera', () => {
    expect(source('components/BarcodeInput.tsx')).toMatch(/\{hasCamera \? \(\s*<Pressable/);
  });

  it('FoodQuickActions omits the scan slot without a camera and keeps the others', () => {
    const text = source('components/nutrition/FoodQuickActions.tsx');

    expect(text).toMatch(/\{hasCamera\s*\? slot\(\s*'scan'/);
    expect(text).toContain("slot(\n          'search'");
    expect(text).toContain("slot(\n          'meals'");
    expect(text).toContain("slot(\n          'more'");
  });

  it('AddFoodModal hides the barcode and AI camera methods without a camera', () => {
    const text = source('components/modals/AddFoodModal.tsx');

    expect(text).toMatch(/\{hasCamera \? \(\s*<TrackingMethodButton\s+icon=\{ScanLine\}/);
    expect(text).toMatch(/\{isAiEnabled && hasCamera \? \(/);
  });

  it('FoodSearchModal shows the barcode icon only with a camera and a handler', () => {
    const text = source('components/modals/FoodSearchModal.tsx');

    expect(text).toMatch(/const showBarcodeScan = hasCamera && onBarcodeScanPress !== undefined;/);
    expect(text).toMatch(/\{showBarcodeScan \? \(\s*<Pressable/);
    expect(text).toMatch(/showBarcodeScan \? 'pr-10' : ''/);
  });

  it('AddFoodItemToMealModal passes no search icon without a camera', () => {
    expect(source('components/modals/AddFoodItemToMealModal.tsx')).toMatch(
      /icon=\{\s*hasCamera \? \(\s*<Pressable/
    );
  });
});
