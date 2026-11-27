/**
 * The downloadable on-device models: pure data, read by the download services, the device gate and
 * the screens that show their size and license. Nothing here talks to the network.
 *
 * There are two. `DEFAULT_LOCAL_MODEL` (LFM2.5-VL 450M) is the one on-device AI needs: it reads
 * photos and answers everything else. `LOCAL_TEXT_MODEL` (LFM2.5 1.2B) is an optional second
 * download, offered only in AI settings: once it is installed, every request WITHOUT a photo goes to
 * it and photos stay on the 450M (`services/localModels/llamaRuntime.ts` decides, per request).
 *
 * The files are fetched from a PINNED Hugging Face revision (a commit, never `main`) and checked
 * against the SHA-256 below before a model is ever opened, so an upstream change or a corrupt
 * download fails closed. `bytes` and `sha256` are the LFS size and object id the Hugging Face API
 * gives for that revision; `utils/localModels/__tests__/manifest.test.ts` pins the shape.
 *
 * Both are by Liquid AI under the LFM Open License v1.0: free for commercial use below US$10M
 * annual revenue, notices travel with any redistribution (docs/ON_DEVICE_AI_PLAN.md §10). Musclog
 * does not redistribute them; the phone downloads them from Hugging Face.
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

/**
 * The text model is offered to about 8 GB phones and up (they report 7.4e9 or more). It peaked at
 * 1.4 GB on a desktop (726 MB of it not file-backed), more than twice the 450M with a photo, and it
 * has not been measured on a phone yet; 6 GB phones (5.4e9 to 5.8e9) wait until it has.
 */
export const LOCAL_TEXT_MODEL_MIN_RAM_BYTES = 7.0e9;

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

/**
 * The optional text model: chat, voice commands, insights and the text steps of a meal estimate.
 * In the 2026-11-27 benchmark (musclog-benchmarks, `2026-11-27-model-tiers/`) it gave 36 good chat
 * replies of 61 against the 450M's 20, about the same voice score (26 of 37 against 27) and slightly
 * better meal numbers when it did the text steps. It reads no photos.
 */
export const LFM_12B: LocalModelManifest = {
  id: 'lfm2.5-1.2b-instruct',
  displayName: 'LFM2.5 1.2B',
  vendor: 'Liquid AI',
  repo: 'LiquidAI/LFM2.5-1.2B-Instruct-GGUF',
  revision: '8ed288026e23958ad9dfa92d53ed773a8eee7125',
  licenseName: 'LFM Open License v1.0',
  licenseUrl: 'https://www.liquid.ai/lfm-license',
  modelCardUrl: 'https://huggingface.co/LiquidAI/LFM2.5-1.2B-Instruct',
  minRamBytes: LOCAL_TEXT_MODEL_MIN_RAM_BYTES,
  contextTokens: 4096,
  // Text only: no projector, so no photo is ever sent to it.
  imageMaxTokens: 0,
  // The model card's list; unlike the 450M it does not name Portuguese.
  languages: ['en', 'ar', 'zh', 'fr', 'de', 'ja', 'ko', 'es'],
  // What it was benchmarked with (the 450M's settings). Its own card gives temperature 0.1, top_k 50
  // and repetition_penalty 1.05: the same temperature and penalty, a different cut of the tail.
  textSampling: { temperature: 0.1, minP: 0.15, repeatPenalty: 1.05 },
  files: [
    {
      role: 'model',
      path: 'LFM2.5-1.2B-Instruct-Q4_0.gguf',
      bytes: 695751488,
      sha256: '2ea801949d760cdf1a2cc04a54262c22c3c0c54f0769d57760c9adeb0e59233f',
      optional: false,
    },
  ],
};

/** Every model the app can download: the main one first. */
export const LOCAL_MODELS: readonly LocalModelManifest[] = [LFM_VL_450M, LFM_12B];

export const DEFAULT_LOCAL_MODEL = LFM_VL_450M;

/** The optional second download: answers every request that carries no photo once installed. */
export const LOCAL_TEXT_MODEL = LFM_12B;

/** Folder (under the app's document directory) every local-AI file lives in. */
export const LOCAL_AI_DIRECTORY = 'local-ai';
