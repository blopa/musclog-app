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
  jest.clearAllMocks();
  await unloadLocalModel();
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

  it('attaches the projector only for a photo and releases it afterwards', async () => {
    await generateWithLocalModel({ messages, image: 'file:///photo.jpg' });

    expect(mockCalls).toEqual(['init', 'attach', 'detach']);
    const sent = mockContext.completion.mock.calls[0][0] as { messages: { content: unknown }[] };
    expect(sent.messages[0].content).toEqual([
      { type: 'text', text: 'hi' },
      { type: 'image_url', image_url: { url: 'file:///photo.jpg' } },
    ]);

    mockCalls.length = 0;
    await generateWithLocalModel({ messages });
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
    expect(mockContext.releaseMultimodal).toHaveBeenCalled();
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
