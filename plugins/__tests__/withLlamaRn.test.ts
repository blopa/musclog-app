import fs from 'node:fs';
import path from 'node:path';

const { addLlamaRnSlimming, DROPPED_LIBRARIES } = require('../withLlamaRn');

const ROOT = path.resolve(__dirname, '../..');
const APP_BUILD_GRADLE = path.join(ROOT, 'android/app/build.gradle');
const LLAMA_RN = path.join(ROOT, 'node_modules/llama.rn/android');
const PREBUILT_ARM64 = path.join(LLAMA_RN, 'src/main/jniLibs/arm64-v8a');
const LOADER = path.join(LLAMA_RN, 'src/main/java/com/rnllama/RNLlama.java');
const CMAKE = path.join(LLAMA_RN, 'src/main/CMakeLists.txt');
const LLAMA_GRADLE = path.join(LLAMA_RN, 'build.gradle');
const RUNTIME = path.join(ROOT, 'services/localModels/llamaRuntime.ts');

const TEMPLATE = `android {
}

dependencies {
}
`;

// The variants every phone still needs: the always-loaded core, its generic JNI fallback,
// plain ARMv8 for every 64-bit ARM phone, and the two fast builds most phones pick.
const KEPT_LIBRARIES = [
  'librnllama.so',
  'librnllama_jni.so',
  'librnllama_v8.so',
  'librnllama_jni_v8.so',
  'librnllama_v8_2_dotprod.so',
  'librnllama_jni_v8_2_dotprod.so',
  'librnllama_v8_2_dotprod_i8mm.so',
  'librnllama_jni_v8_2_dotprod_i8mm.so',
  'librnllama_x86_64.so',
  'librnllama_jni_x86_64.so',
];

describe('withLlamaRn', () => {
  const result: string = addLlamaRnSlimming(TEMPLATE);

  it('leaves out the unused llama.rn variants and their JNI wrappers', () => {
    expect(DROPPED_LIBRARIES).toEqual([
      'librnllama_v8_2.so',
      'librnllama_jni_v8_2.so',
      'librnllama_v8_2_i8mm.so',
      'librnllama_jni_v8_2_i8mm.so',
      'librnllama_v8_2_dotprod_i8mm_hexagon_opencl.so',
      'librnllama_jni_v8_2_dotprod_i8mm_hexagon_opencl.so',
    ]);

    for (const name of DROPPED_LIBRARIES) {
      expect(result).toContain(`"**/${name}",`);
    }
  });

  it('never leaves out a variant a phone needs', () => {
    for (const name of KEPT_LIBRARIES) {
      expect(result).not.toContain(`"**/${name}"`);
    }
  });

  it('stops llama.rn copying its Hexagon libraries into the app assets', () => {
    expect(result).toContain('tasks.matching { it.name == "syncRNLlamaHtpAssets" }');
    expect(result).toContain('enabled = false');
    expect(result).toContain('delete(file("src/main/assets/ggml-hexagon"))');
  });

  it('is idempotent', () => {
    expect(addLlamaRnSlimming(result)).toBe(result);
  });

  it('is mirrored in the committed android/app/build.gradle', () => {
    const committed = fs.readFileSync(APP_BUILD_GRADLE, 'utf8');

    expect(addLlamaRnSlimming(committed)).toBe(committed);
    expect(committed).toContain('// @musclog llama-rn-slim');
  });

  // If llama.rn renames a file or task, an exclude would silently stop matching and the size
  // would come back without any build error.
  describe('still matches the installed llama.rn', () => {
    it('ships every dropped core under the name we exclude', () => {
      const prebuilt = fs.readdirSync(PREBUILT_ARM64);

      for (const name of DROPPED_LIBRARIES.filter((lib: string) => !lib.includes('_jni_'))) {
        expect(prebuilt).toContain(name);
      }
    });

    it('builds every dropped JNI wrapper under the name we exclude', () => {
      const cmake = fs.readFileSync(CMAKE, 'utf8');

      for (const name of DROPPED_LIBRARIES.filter((lib: string) => lib.includes('_jni_'))) {
        const target = name.replace(/^lib/, '').replace(/\.so$/, '');

        expect(cmake).toContain(`build_rnllama_jni("${target}"`);
      }
    });

    it('registers the Hexagon asset task we disable', () => {
      expect(fs.readFileSync(LLAMA_GRADLE, 'utf8')).toContain('"syncRNLlamaHtpAssets"');
    });

    // Dropping a variant is only safe while a missing one falls through to the next.
    it('falls back when a variant is missing, down to plain v8', () => {
      const loader = fs.readFileSync(LOADER, 'utf8');

      expect(loader).toMatch(/catch \(UnsatisfiedLinkError ignored\)\s*\{\s*return false;/);
      expect(loader).toContain('tryLoadLibrary("rnllama_jni_v8_2_dotprod_i8mm")');
      expect(loader).toContain('tryLoadLibrary("rnllama_jni_v8_2_dotprod")');
      expect(loader).toContain('tryLoadLibrary("rnllama_jni_v8")');
    });
  });

  // The Hexagon/OpenCL build only helps when layers are offloaded. Turning offload on for
  // Android means bringing that variant (and the Hexagon assets) back.
  it('is only safe while Android offloads nothing to the GPU or NPU', () => {
    expect(fs.readFileSync(RUNTIME, 'utf8')).toContain(
      "n_gpu_layers: Platform.OS === 'ios' ? 99 : 0"
    );
  });
});
