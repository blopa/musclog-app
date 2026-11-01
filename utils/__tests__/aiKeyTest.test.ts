import { testApiKey } from '../aiKeyTest';

const mockGenerate = jest.fn();
jest.mock('../gemini', () => ({
  configureBasicGenAI: jest.fn(async () => ({ generateContent: mockGenerate })),
}));
const mockList = jest.fn();
const mockClaudeList = jest.fn();
jest.mock('../claude', () => ({
  buildClaudeClient: jest.fn(() => ({ models: { list: mockClaudeList } })),
}));
jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({ models: { list: mockList } })),
}));

describe('testApiKey', () => {
  beforeEach(() => {
    mockGenerate.mockReset();
    mockList.mockReset();
    mockClaudeList.mockReset();
  });

  it('accepts a key the provider answers to', async () => {
    mockGenerate.mockResolvedValue({});
    mockList.mockResolvedValue({});
    await expect(testApiKey('gemini', 'k')).resolves.toBe('ok');
    await expect(testApiKey('openai', 'k')).resolves.toBe('ok');
  });

  it('checks a Claude key by listing models, which needs no model and bills nothing', async () => {
    mockClaudeList.mockResolvedValue({});
    await expect(testApiKey('claude', 'k')).resolves.toBe('ok');
    expect(mockClaudeList).toHaveBeenCalledWith({ limit: 1 });
  });

  it('reports a rejected Claude key for a 401, and a network failure as network', async () => {
    mockClaudeList.mockRejectedValueOnce(
      Object.assign(new Error('invalid x-api-key'), { status: 401 })
    );
    await expect(testApiKey('claude', 'bad')).resolves.toBe('rejected');
    mockClaudeList.mockRejectedValueOnce(new Error('Connection error.'));
    await expect(testApiKey('claude', 'k')).resolves.toBe('network');
  });

  it("reports a rejected key for Gemini's 400 API_KEY_INVALID and OpenAI's 401", async () => {
    mockGenerate.mockRejectedValue(Object.assign(new Error('API key not valid'), { status: 400 }));
    mockList.mockRejectedValue(Object.assign(new Error('Incorrect API key'), { status: 401 }));
    await expect(testApiKey('gemini', 'bad')).resolves.toBe('rejected');
    await expect(testApiKey('openai', 'bad')).resolves.toBe('rejected');
  });

  it('does NOT call a network failure a rejected key', async () => {
    mockGenerate.mockRejectedValue(new Error('fetch failed: ECONNRESET'));
    mockList.mockRejectedValue(new Error('Connection error.'));
    await expect(testApiKey('gemini', 'k')).resolves.toBe('network');
    await expect(testApiKey('openai', 'k')).resolves.toBe('network');
  });

  it('treats a malformed request that is also a 400 as network/other, not a bad key', async () => {
    mockGenerate.mockRejectedValue(
      Object.assign(new Error('Invalid JSON payload'), { status: 400 })
    );
    await expect(testApiKey('gemini', 'k')).resolves.toBe('network');
  });

  it('rejects an empty key without a request', async () => {
    await expect(testApiKey('gemini', '   ')).resolves.toBe('rejected');
    expect(mockGenerate).not.toHaveBeenCalled();
  });
});
