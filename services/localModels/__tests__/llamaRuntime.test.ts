import { reportAiEvent } from '@/utils/aiTelemetry';
import { AiCancelledError, OnDeviceUnavailableError } from '@/utils/aiErrors';

const mockInstalled: {
  value: null | {
    manifest: {
      id: string;
      imageMaxTokens: number;
      contextTokens: number;
      textSampling: { temperature: number; minP: number; repeatPenalty: number };
    };
    modelPath: string;
    projectorPath: string | null;
  };
} = { value: null };

const mockTextInstalled: { value: typeof mockInstalled.value } = { value: null };

const mockCalls: string[] = [];
let mockInitShouldFail = false;
let mockCompletionImpl: (params: unknown, cb?: (d: { token: string }) => void) => Promise<unknown>;
let mockChatTemplate: string | undefined;

const mockContext = {
  model: {
    get metadata() {
      return { 'tokenizer.chat_template': mockChatTemplate };
    },
  },
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
  localModelStore: { getInstalled: jest.fn(async () => mockInstalled.value) },
  localTextModelStore: { getInstalled: jest.fn(async () => mockTextInstalled.value) },
  registerLocalModelUnloader: jest.fn(),
}));

jest.mock('@/utils/sentry', () => ({ captureException: jest.fn() }));
jest.mock('@/utils/handleError', () => ({ handleError: jest.fn() }));

import { handleError } from '@/utils/handleError';

import {
  generateWithLocalModel,
  isLocalModelLoaded,
  LOCAL_MODEL_IDLE_MS,
  LOCAL_PROJECTOR_IDLE_MS,
  unloadLocalModel,
} from '../llamaRuntime';

const INSTALLED = {
  manifest: {
    id: 'm',
    imageMaxTokens: 256,
    contextTokens: 4096,
    textSampling: { temperature: 0.1, minP: 0.15, repeatPenalty: 1.05 },
  },
  modelPath: 'file:///models/m.gguf',
  projectorPath: 'file:///models/p.gguf',
};

const messages = [{ role: 'user' as const, content: 'hi' }];

beforeEach(async () => {
  jest.useFakeTimers();
  mockCalls.length = 0;
  mockInitShouldFail = false;
  mockChatTemplate = undefined;
  mockInstalled.value = INSTALLED;
  mockTextInstalled.value = null;
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

describe('two models', () => {
  const TEXT = {
    manifest: {
      id: 't',
      imageMaxTokens: 0,
      contextTokens: 4096,
      textSampling: { temperature: 0.33, minP: 0.2, repeatPenalty: 1.2 },
    },
    modelPath: 'file:///models/t.gguf',
    projectorPath: null,
  };
  const photo = { messages, image: 'file:///photo.jpg' };
  const { initLlama } = jest.requireMock('llama.rn') as { initLlama: jest.Mock };

  beforeEach(() => {
    mockTextInstalled.value = TEXT;
  });

  it('sends a text request to the text model without a projector', async () => {
    await generateWithLocalModel({ messages });

    expect(initLlama.mock.calls[0][0]).toMatchObject({ model: '/models/t.gguf' });
    expect(mockContext.initMultimodal).not.toHaveBeenCalled();
  });

  it('sends a photo request to the main model with its projector', async () => {
    await generateWithLocalModel(photo);

    expect(initLlama.mock.calls[0][0]).toMatchObject({ model: '/models/m.gguf' });
    expect(mockContext.initMultimodal).toHaveBeenCalledTimes(1);
  });

  it('releases the text context before loading the main one, and the reverse', async () => {
    await generateWithLocalModel({ messages });
    await generateWithLocalModel(photo);

    expect(mockCalls.indexOf('release')).toBeGreaterThan(-1);
    expect(mockCalls.indexOf('release')).toBeLessThan(mockCalls.lastIndexOf('init'));
    expect(initLlama).toHaveBeenCalledTimes(2);

    mockCalls.length = 0;
    await generateWithLocalModel({ messages });
    expect(mockCalls.indexOf('release')).toBeLessThan(mockCalls.indexOf('init'));
    expect(initLlama).toHaveBeenCalledTimes(3);
  });

  it('reuses the context for two text requests in a row', async () => {
    await generateWithLocalModel({ messages });
    await generateWithLocalModel({ messages });

    expect(initLlama).toHaveBeenCalledTimes(1);
  });

  it('uses the main model for text when no text model is installed', async () => {
    mockTextInstalled.value = null;
    await generateWithLocalModel({ messages });

    expect(initLlama.mock.calls[0][0]).toMatchObject({ model: '/models/m.gguf' });
  });

  it('samples plain text with the loaded model manifest', async () => {
    await generateWithLocalModel({ messages });

    expect(mockContext.completion.mock.calls[0][0]).toMatchObject({
      temperature: 0.33,
      min_p: 0.2,
      penalty_repeat: 1.2,
    });
  });

  it('loads again after an unload', async () => {
    await generateWithLocalModel({ messages });
    await unloadLocalModel();
    await generateWithLocalModel({ messages });

    expect(initLlama).toHaveBeenCalledTimes(2);
  });
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

  it('samples a plain-text reply with the vendor settings from the manifest', async () => {
    await generateWithLocalModel({ messages });

    expect(mockContext.completion.mock.calls[0][0]).toMatchObject({
      temperature: 0.1,
      min_p: 0.15,
      penalty_repeat: 1.05,
    });
    expect(mockContext.completion.mock.calls[0][0]).not.toHaveProperty('penalty_freq');
    expect(mockContext.completion.mock.calls[0][0]).not.toHaveProperty('penalty_present');
  });

  it('lets an explicit temperature win over the vendor temperature', async () => {
    await generateWithLocalModel({ messages, temperature: 0.7 });

    expect(mockContext.completion.mock.calls[0][0]).toMatchObject({
      temperature: 0.7,
      min_p: 0.15,
      penalty_repeat: 1.05,
    });
  });

  it('gives a schema or a photo no vendor sampling, only the default temperature', async () => {
    const schema = { type: 'object', properties: {} };
    await generateWithLocalModel({ messages, schema });
    await generateWithLocalModel({ messages, image: 'file:///photo.jpg' });

    for (const call of mockContext.completion.mock.calls) {
      expect(call[0]).toMatchObject({ temperature: 0.2 });
      expect(call[0]).not.toHaveProperty('min_p');
      expect(call[0]).not.toHaveProperty('penalty_repeat');
    }
  });

  describe('tool calls', () => {
    const tools = [
      { name: 'copy_meal', description: 'Copy a meal', parameters: { type: 'object' } },
    ];

    it('sends tools in the wrapped shape with tool_choice auto and no response_format', async () => {
      await generateWithLocalModel({ messages, tools });

      const params = mockContext.completion.mock.calls[0][0] as Record<string, unknown>;
      expect(params).toMatchObject({
        tools: [
          {
            type: 'function',
            function: {
              name: 'copy_meal',
              description: 'Copy a meal',
              parameters: { type: 'object' },
            },
          },
        ],
        tool_choice: 'auto',
      });
      expect(params).not.toHaveProperty('response_format');
    });

    it('returns the calls: string arguments kept, object ones stringified, nameless dropped', async () => {
      mockCompletionImpl = async () => ({
        text: '',
        tool_calls: [
          { id: 'a', function: { name: 'copy_meal', arguments: '{"x":1}' } },
          { function: { name: 'search_food', arguments: { q: 'rice' } } },
          { id: 'c', function: { arguments: '{}' } },
        ],
      });
      const result = await generateWithLocalModel({ messages, tools });

      expect(result.toolCalls).toEqual([
        { id: 'a', name: 'copy_meal', arguments: '{"x":1}' },
        { name: 'search_food', arguments: '{"q":"rice"}' },
      ]);
    });

    it('has an empty list when the model answered in text, and none without tools', async () => {
      const withTools = await generateWithLocalModel({ messages, tools });
      const without = await generateWithLocalModel({ messages });

      expect(withTools.toolCalls).toEqual([]);
      expect(without).not.toHaveProperty('toolCalls');
    });

    it('maps assistant tool calls and tool messages to the OpenAI snake_case shape', async () => {
      await generateWithLocalModel({
        messages: [
          { role: 'user', content: 'hi' },
          { role: 'assistant', content: '', toolCalls: [{ name: 'copy_meal', arguments: '{}' }] },
          { role: 'tool', content: 'done', toolCallId: 'call_0' },
        ],
        tools,
      });

      const sent = (mockContext.completion.mock.calls[0][0] as { messages: unknown[] }).messages;
      expect(sent).toEqual([
        { role: 'user', content: 'hi' },
        {
          role: 'assistant',
          content: '',
          tool_calls: [
            { id: 'call_0', type: 'function', function: { name: 'copy_meal', arguments: '{}' } },
          ],
        },
        { role: 'tool', content: 'done', tool_call_id: 'call_0' },
      ]);
    });

    it('takes no vendor sampling, and an explicit temperature wins', async () => {
      await generateWithLocalModel({ messages, tools });
      await generateWithLocalModel({ messages, tools, temperature: 0 });

      const [first, second] = mockContext.completion.mock.calls.map((c) => c[0]);
      expect(first).toMatchObject({ temperature: 0.2 });
      expect(first).not.toHaveProperty('min_p');
      expect(first).not.toHaveProperty('penalty_repeat');
      expect(second).toMatchObject({ temperature: 0 });
    });

    // Without the override llama.cpp b10256 cannot build the grammar for LFM2.5-VL-450M's
    // template and every request with tools fails ("Failed to initialize sampling").
    it('overrides a template llama.cpp would not recognise, only for a request with tools', async () => {
      mockChatTemplate = '{{- "List of tools: " + (tools | tojson) -}}';

      await generateWithLocalModel({ messages, tools });
      await generateWithLocalModel({ messages });

      const [withTools, without] = mockContext.completion.mock.calls.map((c) => c[0]);
      expect(withTools).toMatchObject({
        chat_template: `${mockChatTemplate}{#- List of tools: [ -#}`,
      });
      expect(without).not.toHaveProperty('chat_template');
    });

    it('keeps the model template when llama.cpp already recognises it', async () => {
      mockChatTemplate = '{{- "List of tools: [" -}}';

      await generateWithLocalModel({ messages, tools });

      expect(mockContext.completion.mock.calls[0][0]).not.toHaveProperty('chat_template');
    });

    it('rejects tools together with a schema without calling completion', async () => {
      await expect(generateWithLocalModel({ messages, tools, schema: {} })).rejects.toThrow(
        'tools or a schema'
      );
      expect(mockContext.completion).not.toHaveBeenCalled();
    });
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

describe('unload failures are reported', () => {
  it('reports a failed release once and still resolves', async () => {
    await generateWithLocalModel({ messages });
    jest.mocked(handleError).mockClear();
    mockContext.release.mockRejectedValueOnce(new Error('release failed'));

    await expect(unloadLocalModel()).resolves.toBeUndefined();
    expect(handleError).toHaveBeenCalledTimes(1);
    expect(handleError).toHaveBeenCalledWith(expect.any(Error), 'localModels.unload', {
      showSnackbar: false,
    });
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

  it('sends vendor sampling for plain text, strips template tokens and serializes unload', async () => {
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
      onDelta: (delta) => deltas.push(delta),
    });
    await Promise.resolve();

    const unload = webModule.unloadLocalModel();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toMatchObject({
      temperature: 0.1,
      min_p: 0.15,
      repeat_penalty: 1.05,
    });
    expect(body).not.toHaveProperty('frequency_penalty');
    expect(body).not.toHaveProperty('presence_penalty');

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

  it('sends tools and reads tool_calls from the dev server', async () => {
    let webModule!: typeof import('../llamaRuntime.web');
    const fetchMock = jest.fn(async () => ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          choices: [
            {
              message: {
                content: '',
                tool_calls: [{ id: 't1', function: { name: 'copy_meal', arguments: { a: 1 } } }],
              },
            },
          ],
        }),
    }));
    global.fetch = fetchMock as unknown as typeof fetch;

    jest.isolateModules(() => {
      jest.doMock('../devWebBridge', () => ({
        isDevWebLocalModel: () => true,
        devLocalModelBaseUrl: () => 'http://localhost:8080',
      }));
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      webModule = require('../llamaRuntime.web');
    });

    const tools = [{ name: 'copy_meal', description: 'd', parameters: { type: 'object' } }];
    const result = await webModule.generateWithLocalModel({ messages, tools });
    const body = JSON.parse(
      (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string
    );

    expect(body.tool_choice).toBe('auto');
    expect(body.tools[0]).toEqual({
      type: 'function',
      function: { name: 'copy_meal', description: 'd', parameters: { type: 'object' } },
    });
    expect(body).not.toHaveProperty('min_p');
    expect(result.toolCalls).toEqual([{ id: 't1', name: 'copy_meal', arguments: '{"a":1}' }]);
    await expect(
      webModule.generateWithLocalModel({ messages, tools, schema: {} })
    ).rejects.toThrow();
  });
});
