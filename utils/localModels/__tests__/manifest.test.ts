import { LOCAL_MODELS } from '@/constants/localModels';

describe('local model manifest', () => {
  it.each(LOCAL_MODELS.map((model) => [model.id, model] as const))(
    '%s is pinned and complete',
    (_id, model) => {
      expect(model.revision).toMatch(/^[0-9a-f]{40}$/);
      expect(model.files.filter((file) => file.role === 'model' && !file.optional)).toHaveLength(1);
      for (const file of model.files) {
        expect(file.sha256).toMatch(/^[0-9a-f]{64}$/);
        expect(file.bytes).toBeGreaterThan(1_000_000);
        expect(file.path).toMatch(/\.gguf$/);
      }

      expect(model.languages).toContain('en');
      expect(model.licenseName).not.toBe('');
    }
  );
});
