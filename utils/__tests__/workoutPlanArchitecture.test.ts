import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const repositoryRoot = join(__dirname, '..', '..');

function source(path: string): string {
  return readFileSync(join(repositoryRoot, path), 'utf8');
}

function componentFiles(): string[] {
  const found: string[] = [];
  const walk = (relative: string) => {
    for (const entry of readdirSync(join(repositoryRoot, relative), { withFileTypes: true })) {
      const child = join(relative, entry.name);
      if (entry.isDirectory()) {
        walk(child);
      } else if (entry.name.endsWith('.tsx')) {
        found.push(child);
      }
    }
  };
  walk('app');
  walk('components');
  return found;
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

  it('never styles a KeyboardAwareScrollView through contentContainerClassName', () => {
    // NativeWind maps that prop only for the components css-interop registers (RN's ScrollView,
    // FlatList, VirtualizedList, KeyboardAvoidingView). `react-native-keyboard-controller`'s
    // KeyboardAwareScrollView is not one of them, so the classes are dropped without any warning —
    // the plan editor lost its horizontal padding and bottom inset that way. Pad an inner View.
    const offenders = componentFiles().filter((file) =>
      /<KeyboardAwareScrollView[^>]*\scontentContainerClassName/.test(source(file))
    );

    expect(offenders).toEqual([]);
  });

  it('separates the workout picker from the list of the plan members', () => {
    const editorSource = source('components/modals/CreateEditPlanModal.tsx');

    // The selector lists every workout in the library, so labelling it "Workouts in this plan"
    // made an unticked workout look like it was still a member. That heading now belongs to the
    // members list, which renders only actual members and offers an explicit remove.
    expect(editorSource).toMatch(
      /<OptionsMultiSelector\s+title=\{t\('workouts\.plans\.selectorLabel'\)\}/
    );
    expect(editorSource).toContain("t('workouts.plans.membersLabel')");
    expect(editorSource).toContain("t('workouts.plans.membersEmpty')");
    expect(editorSource).toContain("accessibilityLabel={t('workouts.plans.removeMember')}");
    expect(editorSource).toMatch(/onPress=\{\(\) => removeMember\(template\.id\)\}/);
  });

  it('pages the workout picker while keeping the member list whole', () => {
    const editorSource = source('components/modals/CreateEditPlanModal.tsx');

    // The picker renders a page at a time so an unbounded library cannot bury the rest of the form.
    expect(editorSource).toContain('const WORKOUT_PICKER_PAGE_SIZE = 10;');
    expect(editorSource).toMatch(
      /visibleTemplateOptions = useMemo\(\s*\(\) => templateOptions\.slice\(0, visibleWorkoutCount\)/
    );
    expect(editorSource).toContain('options={visibleTemplateOptions}');
    expect(editorSource).toMatch(
      /templateOptions\.length > visibleWorkoutCount \?[\s\S]*t\('common\.loadMore'\)/
    );

    // `members` must keep resolving against the full template list: a member past the current page
    // would otherwise vanish from the plan, taking its remove and reorder controls with it.
    const membersMemo = /const members = useMemo\(\n([\s\S]*?)\n {2}\);/.exec(editorSource)?.[1];
    expect(membersMemo).toContain('templates.find');
    expect(membersMemo).not.toContain('visible');
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
