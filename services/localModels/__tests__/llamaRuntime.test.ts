import { reportAiEvent } from '@/utils/aiTelemetry';
import { AiCancelledError, OnDeviceUnavailableError } from '@/utils/aiErrors';

const mockInstalled: {
  value: null | {
    manifest: { id: string; imageMaxTokens: number; contextTokens: number };
    modelPath: string;
    projectorPath: string | null;
  };
} = { value: null };

const mockCalls: string[] = [];
let mockInitShouldFail = false;
let mockCompletionImpl: (params: unknown, cb?: (d: { token: string }) => void) => Promise<unknown>;

const mockContext = {
  completion: jest.fn((params: unknown, cb?: (d: { token: string }) => void) =>
    mockCompletionImpl(params, cb)
  ),
  stopCompletion: jest.fn(async () => {
    mockCalls.push('stop');
  }),
  initMultimodal: jest.fn(async () => {
    mockCalls.push('attach');

    return true;
  }),
  releaseMultimodal: jest.fn(async () => {
    mockCalls.push('detach');
  }),
  release: jest.fn(async () => {
    mockCalls.push('release');
  }),
};

jest.mock('@/utils/aiTelemetry', () => ({ reportAiEvent: jest.fn() }));
jest.mock('llama.rn', () => ({
  initLlama: jest.fn(async () => {
    if (mockInitShouldFail) {
      throw new Error('out of memory');
    }

    mockCalls.push('init');

    return mockContext;
  }),
}));

jest.mock('../modelStore', () => ({
  getInstalledLocalModel: jest.fn(async () => mockInstalled.value),
  registerLocalModelUnloader: jest.fn(),
}));

jest.mock('@/utils/sentry', () => ({ captureException: jest.fn() }));

import {
  generateWithLocalModel,
  isLocalModelLoaded,
  LOCAL_MODEL_IDLE_MS,
  LOCAL_PROJECTOR_IDLE_MS,
  unloadLocalModel,
} from '../llamaRuntime';

const INSTALLED = {
  manifest: { id: 'm', imageMaxTokens: 256, contextTokens: 4096 },
  modelPath: 'file:///models/m.gguf',
  projectorPath: 'file:///models/p.gguf',
};

const messages = [{ role: 'user' as const, content: 'hi' }];

beforeEach(async () => {
  jest.useFakeTimers();
  mockCalls.length = 0;
  mockInitShouldFail = false;
  mockInstalled.value = INSTALLED;
  mockCompletionImpl = async (_params, cb) => {
    cb?.({ token: 'he' });
    cb?.({ token: 'llo' });

    return { text: 'hello', timings: { predicted_per_second: 30 } };
  };
  await unloadLocalModel();
  jest.clearAllMocks();
  mockCalls.length = 0;
});

afterEach(() => {
  jest.useRealTimers();
});

describe('generateWithLocalModel', () => {
  it('strips chat-template control tokens from the reply', async () => {
    mockCompletionImpl = async () => ({ text: '<|im_start|>assistant {"items":[]}<|im_end|>' });
    const result = await generateWithLocalModel({ messages });

    expect(result.text).toBe('{"items":[]}');
  });

  it('loads lazily, streams tokens and returns the text', async () => {
    expect(isLocalModelLoaded()).toBe(false);
    const deltas: string[] = [];
    const result = await generateWithLocalModel({ messages, onDelta: (d) => deltas.push(d) });

    expect(result.text).toBe('hello');
    expect(result.timings?.predictedPerSecond).toBe(30);
    expect(deltas).toEqual(['he', 'llo']);
    expect(mockCalls).toEqual(['init']);
    expect(isLocalModelLoaded()).toBe(true);
  });

  it('passes the schema as a grammar-constrained json_schema', async () => {
    const schema = { type: 'object', properties: { a: { type: 'string' } } };
    await generateWithLocalModel({ messages, schema });

    expect(mockContext.completion.mock.calls[0][0]).toMatchObject({
      jinja: true,
      response_format: { type: 'json_schema', json_schema: { strict: true, schema } },
    });
  });

  it('maps chat repetition penalties to llama.cpp, and sends none by default', async () => {
    await generateWithLocalModel({
      messages,
      penalties: { frequency_penalty: 0.4, presence_penalty: 0.4 },
    });
    await generateWithLocalModel({ messages });

    expect(mockContext.completion.mock.calls[0][0]).toMatchObject({
      penalty_freq: 0.4,
      penalty_present: 0.4,
    });
    expect(mockContext.completion.mock.calls[1][0]).not.toHaveProperty('penalty_freq');
    expect(mockContext.completion.mock.calls[1][0]).not.toHaveProperty('penalty_present');
  });

  it('attaches the projector only for a photo and releases it after a short idle', async () => {
    await generateWithLocalModel({ messages, image: 'file:///photo.jpg' });

    expect(mockCalls).toEqual(['init', 'attach']);
    const sent = mockContext.completion.mock.calls[0][0] as { messages: { content: unknown }[] };
    expect(sent.messages[0].content).toEqual([
      { type: 'text', text: 'hi' },
      { type: 'image_url', image_url: { url: 'file:///photo.jpg' } },
    ]);

    mockCalls.length = 0;
    await generateWithLocalModel({ messages });
    expect(mockCalls).toEqual([]);

    await jest.advanceTimersByTimeAsync(LOCAL_PROJECTOR_IDLE_MS + 10);
    expect(mockCalls).toEqual(['detach']);
    expect(isLocalModelLoaded()).toBe(true);
  });

  it('keeps the projector across consecutive photo requests', async () => {
    await generateWithLocalModel({ messages, image: 'file:///a.jpg' });
    await jest.advanceTimersByTimeAsync(LOCAL_PROJECTOR_IDLE_MS - 1000);
    await generateWithLocalModel({ messages, image: 'file:///b.jpg' });
    await jest.advanceTimersByTimeAsync(LOCAL_PROJECTOR_IDLE_MS - 1000);

    expect(mockCalls).toEqual(['init', 'attach']);
    expect(mockContext.initMultimodal).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(2000);
    expect(mockCalls).toEqual(['init', 'attach', 'detach']);
  });

  it('a pending projector release is cleared when the model unloads', async () => {
    await generateWithLocalModel({ messages, image: 'file:///a.jpg' });
    await unloadLocalModel();
    mockCalls.length = 0;
    await jest.advanceTimersByTimeAsync(LOCAL_PROJECTOR_IDLE_MS + 10);

    expect(mockCalls).toEqual([]);
  });

  it('refuses a photo when no projector was installed', async () => {
    mockInstalled.value = { ...INSTALLED, projectorPath: null };
    await expect(
      generateWithLocalModel({ messages, image: 'file:///photo.jpg' })
    ).rejects.toMatchObject({ reason: 'notReady' });
  });

  it('says notReady when nothing is installed and never loads', async () => {
    mockInstalled.value = null;
    await expect(generateWithLocalModel({ messages })).rejects.toBeInstanceOf(
      OnDeviceUnavailableError
    );
    expect(mockCalls).toEqual([]);
  });

  it('turns a load failure into loadFailed', async () => {
    mockInitShouldFail = true;
    await expect(generateWithLocalModel({ messages })).rejects.toMatchObject({
      reason: 'loadFailed',
    });
  });

  it('serves requests one at a time, in order', async () => {
    const order: string[] = [];
    let release!: () => void;
    mockCompletionImpl = async (params) => {
      const text = (params as { messages: { content: string }[] }).messages[0].content;
      order.push(`start ${text}`);
      if (text === 'first') {
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      }

      order.push(`end ${text}`);

      return { text };
    };

    const first = generateWithLocalModel({ messages: [{ role: 'user', content: 'first' }] });
    const second = generateWithLocalModel({ messages: [{ role: 'user', content: 'second' }] });
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(0);
    expect(order).toEqual(['start first']);
    release();
    await Promise.all([first, second]);
    expect(order).toEqual(['start first', 'end first', 'start second', 'end second']);
  });

  it('stops generation natively and reports a cancel', async () => {
    const controller = new AbortController();
    mockCompletionImpl = async () => {
      controller.abort();

      return { text: 'partial' };
    };

    await expect(
      generateWithLocalModel({ messages, signal: controller.signal })
    ).rejects.toBeInstanceOf(AiCancelledError);
    expect(mockContext.stopCompletion).toHaveBeenCalled();
  });

  it('does not start completion if cancelled while attaching the projector', async () => {
    const controller = new AbortController();
    mockContext.initMultimodal.mockImplementationOnce(async () => {
      controller.abort();
      return true;
    });
    await expect(
      generateWithLocalModel({ messages, image: 'file:///photo.jpg', signal: controller.signal })
    ).rejects.toBeInstanceOf(AiCancelledError);
    expect(mockContext.completion).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(LOCAL_PROJECTOR_IDLE_MS + 10);
    expect(mockContext.releaseMultimodal).toHaveBeenCalled();
  });

  it('reports a projector that cannot be attached, and fails the photo request', async () => {
    mockContext.initMultimodal.mockImplementationOnce(async () => false);

    await expect(
      generateWithLocalModel({ messages, image: 'file:///photo.jpg' })
    ).rejects.toMatchObject({ reason: 'loadFailed' });
    expect(mockContext.completion).not.toHaveBeenCalled();
    expect(reportAiEvent).toHaveBeenCalledWith('local-model-projector-failed', expect.any(Object));
  });

  it('does not start when already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      generateWithLocalModel({ messages, signal: controller.signal })
    ).rejects.toBeInstanceOf(AiCancelledError);
    expect(mockCalls).toEqual([]);
  });
});

describe('idle unload', () => {
  it('releases the model after the idle window', async () => {
    await generateWithLocalModel({ messages });
    expect(isLocalModelLoaded()).toBe(true);

    await jest.advanceTimersByTimeAsync(LOCAL_MODEL_IDLE_MS + 10);
    expect(isLocalModelLoaded()).toBe(false);
    expect(mockCalls).toContain('release');
  });

  it('a new request resets the window', async () => {
    await generateWithLocalModel({ messages });
    await jest.advanceTimersByTimeAsync(LOCAL_MODEL_IDLE_MS - 1000);
    await generateWithLocalModel({ messages });
    await jest.advanceTimersByTimeAsync(LOCAL_MODEL_IDLE_MS - 1000);
    expect(isLocalModelLoaded()).toBe(true);
  });
});

describe('unloadLocalModel serialization', () => {
  it('stops active completion and waits for the queue before releasing', async () => {
    let releaseCompletion!: () => void;
    let completionStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      completionStarted = resolve;
    });
    mockCompletionImpl = async () => {
      mockCalls.push('completionStart');
      completionStarted();
      await new Promise<void>((resolve) => {
        releaseCompletion = resolve;
      });
      mockCalls.push('completionEnd');

      return { text: 'partial' };
    };

    const gen = generateWithLocalModel({ messages });
    await started;

    const unload = unloadLocalModel();
    await Promise.resolve();
    try {
      expect(mockCalls).toEqual(['init', 'completionStart', 'stop']);
      expect(mockContext.release).not.toHaveBeenCalled();
    } finally {
      releaseCompletion();
      await Promise.all([gen.catch(() => undefined), unload]);
    }

    expect(mockCalls).toEqual([
      'init',
      'completionStart',
      'stop',
      'completionEnd',
      'detach',
      'release',
    ]);
    expect(isLocalModelLoaded()).toBe(false);
  });

  it('reports a generation stopped by an unload as a cancel, not a finished reply', async () => {
    let releaseCompletion!: () => void;
    let completionStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      completionStarted = resolve;
    });
    mockCompletionImpl = async () => {
      completionStarted();
      await new Promise<void>((resolve) => {
        releaseCompletion = resolve;
      });

      return { text: 'half a rep' };
    };

    const gen = generateWithLocalModel({ messages });
    const outcome = gen.then(
      (value) => ({ value }),
      (error) => ({ error })
    );
    await started;
    const unload = unloadLocalModel();
    releaseCompletion();
    await unload;

    const result = await outcome;
    expect((result as { error?: unknown }).error).toBeInstanceOf(AiCancelledError);

    // The next request is not poisoned by the earlier stop.
    mockCompletionImpl = async () => ({ text: 'fine' });
    await expect(generateWithLocalModel({ messages })).resolves.toMatchObject({ text: 'fine' });
  });

  it('waits for an in-flight initLlama before releasing the context', async () => {
    const llama = jest.requireMock('llama.rn');
    let finishInit!: (ctx: typeof mockContext) => void;
    let initStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      initStarted = resolve;
    });
    llama.initLlama.mockImplementationOnce(() => {
      mockCalls.push('initStart');
      initStarted();

      return new Promise((resolve) => {
        finishInit = resolve;
      });
    });

    const gen = generateWithLocalModel({ messages });
    await started;

    const unload = unloadLocalModel();
    await Promise.resolve();
    try {
      expect(mockContext.release).not.toHaveBeenCalled();
    } finally {
      finishInit(mockContext);
      await Promise.all([gen, unload]);
    }

    expect(mockCalls).toEqual(['initStart', 'detach', 'release']);
    expect(isLocalModelLoaded()).toBe(false);
  });
});

describe('llamaRuntime.web', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.resetModules();
  });

  it('forwards penalties, strips template tokens and serializes unload', async () => {
    let webModule!: typeof import('../llamaRuntime.web');
    let resolveFetch!: (value: Response) => void;
    const fetchMock = jest.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        })
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    jest.isolateModules(() => {
      jest.doMock('../devWebBridge', () => ({
        isDevWebLocalModel: () => true,
        devLocalModelBaseUrl: () => 'http://localhost:8080',
      }));
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      webModule = require('../llamaRuntime.web');
    });

    const deltas: string[] = [];
    const gen = webModule.generateWithLocalModel({
      messages,
      penalties: { frequency_penalty: 0.4, presence_penalty: 0.4 },
      onDelta: (delta) => deltas.push(delta),
    });
    await Promise.resolve();

    const unload = webModule.unloadLocalModel();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toMatchObject({
      frequency_penalty: 0.4,
      presence_penalty: 0.4,
    });

    resolveFetch({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          choices: [{ message: { content: '<|im_start|>assistant hello<|im_end|>' } }],
        }),
    } as unknown as Response);

    const [result] = await Promise.all([gen, unload]);
    expect(result.text).toBe('hello');
    expect(deltas).toEqual(['hello']);
    expect(webModule.isLocalModelLoaded()).toBe(false);
  });
});
