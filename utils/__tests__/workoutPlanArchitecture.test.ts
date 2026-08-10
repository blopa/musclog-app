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

  it('routes aggregate edits and generated plans through atomic service methods', () => {
    const editorSource = source('components/modals/CreateEditPlanModal.tsx');
    const jsonImporterSource = source('database/services/WorkoutTemplateService.ts');
    const aiImporterSource = source('utils/workoutAI.ts');

    expect(editorSource).toContain('WorkoutPlanService.savePlan(');
    expect(jsonImporterSource).toContain('return this.createPlanWithTemplates(');
    expect(aiImporterSource).toContain('WorkoutTemplateService.createPlanWithTemplates(');
  });
});
