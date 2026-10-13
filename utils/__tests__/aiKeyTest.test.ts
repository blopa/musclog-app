import { testApiKey } from '../aiKeyTest';

const mockGenerate = jest.fn();
jest.mock('../gemini', () => ({
  configureBasicGenAI: jest.fn(async () => ({ generateContent: mockGenerate })),
}));
const mockList = jest.fn();
jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({ models: { list: mockList } })),
}));

describe('testApiKey', () => {
  beforeEach(() => {
    mockGenerate.mockReset();
    mockList.mockReset();
  });

  it('accepts a key the provider answers to', async () => {
    mockGenerate.mockResolvedValue({});
    mockList.mockResolvedValue({});
    await expect(testApiKey('gemini', 'k')).resolves.toBe('ok');
    await expect(testApiKey('openai', 'k')).resolves.toBe('ok');
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
