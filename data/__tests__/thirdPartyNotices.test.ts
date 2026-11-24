import notices from '@/data/thirdPartyNotices.json';

describe('third-party notices', () => {
  it('gives every entry an id, name, license and https licence link', () => {
    for (const notice of notices) {
      expect(notice.id).toEqual(expect.any(String));
      expect(notice.name).toEqual(expect.any(String));
      expect(notice.license).toEqual(expect.any(String));
      expect(notice.licenseUrl).toMatch(/^https:\/\//);
    }
  });

  it('has unique ids', () => {
    const ids = notices.map((notice) => notice.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('carries the MIT permission text for llama.rn', () => {
    const llama = notices.find((notice) => notice.id === 'llama-rn');
    expect(llama?.text?.startsWith('Permission is hereby granted')).toBe(true);
  });
});
