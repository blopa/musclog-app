/**
 * The downloadable on-device model: pure data, read by the download service, the device gate and
 * the screens that show its size and license. Nothing here talks to the network.
 *
 * The files are fetched from a PINNED Hugging Face revision (a commit, never `main`) and checked
 * against the SHA-256 below before the model is ever opened, so an upstream change or a corrupt
 * download fails closed. `scripts/local-model-manifest.js verify` re-reads the revision and fails
 * when `bytes` or `sha256` drift; `utils/localModels/__tests__/manifest.test.ts` pins the shape.
 *
 * LFM2.5-VL-450M by Liquid AI is under the LFM Open License v1.0: free for commercial use below
 * US$10M annual revenue, notices travel with any redistribution (docs/ON_DEVICE_AI_PLAN.md §10).
 * Musclog does not redistribute it; the phone downloads it from Hugging Face.
 */

export type LocalModelFileRole = 'model' | 'projector';

export type LocalModelFile = {
  role: LocalModelFileRole;
  /** Path inside the repository; also the file name on disk. */
  path: string;
  bytes: number;
  /** Lowercase hex SHA-256 of the whole file (Hugging Face's LFS object id). */
  sha256: string;
  /** The model works without it (text only); photos need it. */
  optional: boolean;
};

/**
 * How a plain-text reply (chat, insights) is sampled, in llama.cpp's terms: `temperature`, `min_p`
 * and the repeat penalty, where 1 means off.
 */
export type LocalTextSampling = { temperature: number; minP: number; repeatPenalty: number };

export type LocalModelManifest = {
  id: string;
  displayName: string;
  vendor: string;
  repo: string;
  /** A commit SHA, never a branch name. */
  revision: string;
  licenseName: string;
  licenseUrl: string;
  modelCardUrl: string;
  /** Lowest `Device.totalMemory` (bytes, as the kernel reports it) the model is offered on. */
  minRamBytes: number;
  /** Tokens of context the runtime opens; the model supports more, but the KV cache costs RAM. */
  contextTokens: number;
  /** Upper bound on the tokens one image costs (the model tiles larger photos). */
  imageMaxTokens: number;
  /** Base language codes the model was trained for. */
  languages: readonly string[];
  /**
   * The vendor's sampling for a plain-text reply. The model card recommends
   * "temperature=0.1, min_p=0.15, repetition_penalty=1.05"; a benchmark of 125 replies each found
   * those values gave fewer bad replies than adding our own frequency and presence penalties.
   */
  textSampling: LocalTextSampling;
  files: readonly LocalModelFile[];
};

/** About 6 GB phones report 5.4e9 or more; 5.0e9 keeps them in and 4 GB phones (3.7e9) out. */
export const LOCAL_MODEL_MIN_RAM_BYTES = 5.0e9;

/** Space left after the download, so installing never fills the phone. */
export const LOCAL_MODEL_FREE_SPACE_MARGIN_BYTES = 300 * 1024 * 1024;

export const LFM_VL_450M: LocalModelManifest = {
  id: 'lfm2.5-vl-450m',
  displayName: 'LFM2.5-VL 450M',
  vendor: 'Liquid AI',
  repo: 'LiquidAI/LFM2.5-VL-450M-GGUF',
  revision: '1abed04b6fe71314d8c446a1371c03d7c332266d',
  licenseName: 'LFM Open License v1.0',
  licenseUrl: 'https://www.liquid.ai/lfm-license',
  modelCardUrl: 'https://huggingface.co/LiquidAI/LFM2.5-VL-450M',
  minRamBytes: LOCAL_MODEL_MIN_RAM_BYTES,
  contextTokens: 4096,
  imageMaxTokens: 256,
  languages: ['en', 'ar', 'zh', 'fr', 'de', 'ja', 'ko', 'pt', 'es'],
  // From the model card (modelCardUrl), the recommended text settings.
  textSampling: { temperature: 0.1, minP: 0.15, repeatPenalty: 1.05 },
  files: [
    {
      role: 'model',
      path: 'LFM2.5-VL-450M-Q4_0.gguf',
      bytes: 219311264,
      sha256: '6d2757dd0f0b98aea7dc90477bb5b3a0df1089be85ef92943f8cecb05121ccbf',
      optional: false,
    },
    {
      role: 'projector',
      path: 'mmproj-LFM2.5-VL-450m-Q8_0.gguf',
      bytes: 102815168,
      sha256: 'ebfc428baa37efad8bae93864f914b2634a09009f91ad59f974fe1a1565d8561',
      optional: true,
    },
  ],
};

/** The one model the app offers. A list so a second model is data, not a refactor. */
export const LOCAL_MODELS: readonly LocalModelManifest[] = [LFM_VL_450M];

export const DEFAULT_LOCAL_MODEL = LFM_VL_450M;

/** Folder (under the app's document directory) every local-AI file lives in. */
export const LOCAL_AI_DIRECTORY = 'local-ai';
