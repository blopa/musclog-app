import { readFileSync } from 'fs';
import { join } from 'path';

const repositoryRoot = join(__dirname, '..', '..');

function source(path: string): string {
  return readFileSync(join(repositoryRoot, path), 'utf8');
}

describe('workout plan architecture', () => {
  it('keeps workout-library rendering outside the route-level orchestrator', () => {
    const screenSource = source('app/app/workout/workouts.tsx');

    expect(screenSource).toContain(
      "import { WorkoutLibraryContent } from '@/components/workout/WorkoutLibraryContent';"
    );
    expect(screenSource).toContain('<WorkoutLibraryContent');
    expect(screenSource.split('\n').length).toBeLessThan(1000);
  });

  it('keeps picker dismissal separate from persistence', () => {
    const pickerSource = source('components/modals/WorkoutPlanPickerModal.tsx');
    const screenSource = source('app/app/workout/workouts.tsx');

    expect(pickerSource).toContain('onSave: () => void | Promise<void>');
    expect(pickerSource).toContain("label={t('common.save')}");
    expect(pickerSource).toContain('onPress={onSave}');
    expect(screenSource).toMatch(/onClose=\{\(\) => setIsPlanPickerVisible\(false\)\}/);
    expect(screenSource).toMatch(
      /onSave=\{async \(\) => \{[\s\S]*WorkoutPlanService\.setTemplatePlans/
    );
  });

  it('closes a bottom sheet menu before running the pressed item handler', () => {
    // This ordering is why a follow-up modal must not be a child of the menu that opens it.
    expect(source('components/BottomPopUpMenu.tsx')).toMatch(
      /if \(!item\.keepOpenOnPress\) \{\s*onClose\?\.\(\);\s*\}\s*item\.onPress\(\);/
    );
  });

  it('renders plan modals opened from a menu as siblings, not menu children', () => {
    const screenSource = source('app/app/workout/workouts.tsx');

    // A hidden RN Modal renders no children, so anything parked inside a menu that dismisses
    // itself on select is unmounted exactly when it should appear — the plan editor only showed
    // up on the second tap, alongside the reopened menu. Every menu here must stay childless.
    for (const menu of ['WorkoutDetailsMenu', 'BottomPopUpMenu']) {
      expect(screenSource).toContain(`<${menu}`);
      expect(screenSource).not.toContain(`</${menu}>`);
    }

    for (const followUp of ['WorkoutPlanPickerModal', 'CreateEditPlanModal', 'ConfirmationModal']) {
      expect(screenSource).toContain(`<${followUp}`);
    }

    // The prop that made the nesting expressible is gone from the screen and its menus/picker.
    for (const path of [
      'app/app/workout/workouts.tsx',
      'components/BottomPopUpMenu.tsx',
      'components/WorkoutDetailsMenu.tsx',
      'components/modals/WorkoutPlanPickerModal.tsx',
    ]) {
      expect(source(path)).not.toContain('nestedModals');
    }
  });

  it('files a newly created plan only when the editor came from the workout picker', () => {
    // `selectedWorkoutId` outlives the workout menu, so a plan created from a plan-list menu must
    // not silently adopt whichever workout the user last opened a menu for.
    expect(source('app/app/workout/workouts.tsx')).toMatch(
      /planEditorOrigin !== 'workout-picker' \|\| !selectedWorkoutId/
    );
  });

  it('routes aggregate edits and generated plans through atomic service methods', () => {
    const editorSource = source('components/modals/CreateEditPlanModal.tsx');
    const jsonImporterSource = source('database/services/WorkoutTemplateService.ts');
    const aiImporterSource = source('utils/workoutAI.ts');

    expect(editorSource).toContain('WorkoutPlanService.savePlan(');
    expect(jsonImporterSource).toContain('return this.createPlanWithTemplates(');
    expect(aiImporterSource).toContain('WorkoutTemplateService.createPlanWithTemplates(');
  });
});
