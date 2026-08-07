import { readFileSync, readdirSync } from 'fs';
import { join, relative } from 'path';

const repositoryRoot = join(__dirname, '..', '..');
const ignoredDirectories = new Set([
  '.expo',
  '.git',
  'android',
  'coverage',
  'dist',
  'ios',
  'node_modules',
]);

function productionTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      if (
        entry.name === '__tests__' ||
        entry.name.startsWith('.') ||
        ignoredDirectories.has(entry.name)
      ) {
        return [];
      }
      return productionTypeScriptFiles(path);
    }

    return /\.(?:ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

function source(path: string): string {
  return readFileSync(join(repositoryRoot, path), 'utf8');
}

describe('gallery picker architecture', () => {
  const productionFiles = productionTypeScriptFiles(repositoryRoot);

  it('keeps expo-image-picker access behind the shared gallery picker', () => {
    const filesUsingExpoImagePicker = productionFiles
      .filter((path) =>
        /(?:from\s+|require\()['"]expo-image-picker['"]/.test(
          source(relative(repositoryRoot, path))
        )
      )
      .map((path) => relative(repositoryRoot, path));

    expect(filesUsingExpoImagePicker).toEqual(['utils/galleryImagePicker.ts']);
  });

  it('does not restore permission prompts or the legacy document picker', () => {
    const pickerSource = source('utils/galleryImagePicker.ts');

    expect(pickerSource).not.toContain('requestMediaLibraryPermissionsAsync');
    expect(pickerSource).not.toMatch(/legacy\s*:\s*true/);
  });

  it.each([
    'components/modals/CoachModal.tsx',
    'components/modals/CreateCustomFoodModal.tsx',
    'components/modals/CreateExerciseModal.tsx',
    'components/modals/CreateMealModal.tsx',
  ])('%s picks and crops through the shared high-level helper', (path) => {
    const componentSource = source(path);

    expect(componentSource).toContain(
      "import { pickAndCropImageFromGallery } from '@/utils/galleryImagePicker';",
    );
    expect(componentSource).toMatch(/await pickAndCropImageFromGallery\(\)/);
  });

  it('keeps the camera flow on the instrumented low-level picker and crop steps', () => {
    const hookSource = source('hooks/useCameraCaptureFlow.ts');

    expect(hookSource).toContain(
      "import { pickImageFromGallery } from '@/utils/galleryImagePicker';",
    );
    expect(hookSource).toMatch(/await pickImageFromGallery\(\)/);
    expect(hookSource).toMatch(/await openCropperAsync\(/);
  });
});
