import { readFileSync } from 'fs';
import { join } from 'path';

const read = (file: string) => readFileSync(join(__dirname, '..', '..', file), 'utf8');

/**
 * The Add food sheet rendered fine on web and broke on a phone (tiles as tall as the sheet, the
 * list below drawn over them): a tile with `flexGrow` inside a `flex: 1` wrapper of a wrapping row
 * of percentage-width cells. Yoga and a browser size that differently, so the tiles are direct
 * children of two plain rows and never grow on the cross axis.
 */
describe('Add food sheet layout', () => {
  const tile = read('components/MealTypeButton.tsx');
  const modal = read('components/modals/AddFoodModal.tsx');

  it('does not grow a meal-type tile with flexGrow', () => {
    expect(tile).not.toMatch(/flexGrow:/);
  });

  it('does not lay the tiles out as a wrapping row of percentage-width cells', () => {
    expect(modal).not.toMatch(/(min|max)Width:\s*'\d/);
    expect(modal).not.toMatch(/flex-wrap" style=\{\{ gap: theme\.spacing\.gap\.md/);
  });

  it('gives the wide Other tile twice the share of a normal tile', () => {
    expect(modal).toMatch(/span=\{2\}\s+flex=\{2\}/);
  });
});
