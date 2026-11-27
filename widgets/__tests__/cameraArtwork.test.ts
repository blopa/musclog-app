import { copyCameraArtwork } from '@/widgets/cameraArtwork';

/** What the "disk" holds, by URI. */
const mockFiles = new Set<string>();

jest.mock('../../assets/camera-widget.png', () => 1, { virtual: true });

jest.mock('expo-file-system', () => ({
  File: class {
    uri: string;
    constructor(...parts: string[]) {
      this.uri = parts.join('/');
    }
    get exists() {
      return mockFiles.has(this.uri);
    }
    delete() {
      mockFiles.delete(this.uri);
    }
    // The native side refuses anything that is not an absolute URI.
    async copy(destination: { uri: string }) {
      await Promise.resolve();
      if (!this.uri.includes(':')) {
        throw new Error('URI is not absolute');
      }

      mockFiles.add(destination.uri);
    }
  },
}));

/** The asset a release Android build reports for a bundled image: a bare resource name. */
let mockBundledLocalUri = 'assets_camerawidget';

jest.mock('expo-asset', () => {
  class Asset {
    localUri: string | null = null;
    name: string;
    type: string;
    hash: string | null;
    uri: string;
    constructor(meta: { name: string; type: string; hash: string | null; uri: string }) {
      this.name = meta.name;
      this.type = meta.type;
      this.hash = meta.hash;
      this.uri = meta.uri;
    }
    static fromModule() {
      const asset = new Asset({
        name: 'camera-widget',
        type: 'png',
        hash: 'abc123',
        uri: mockBundledLocalUri,
      });
      asset.localUri = mockBundledLocalUri;

      return { downloadAsync: async () => asset };
    }
    // The native module opens a resource name and caches it as a file.
    async downloadAsync() {
      this.localUri = `file:///cache/ExponentAsset-${this.hash}.${this.type}`;

      return this;
    }
  }

  return { Asset };
});

beforeEach(() => {
  mockFiles.clear();
  mockBundledLocalUri = 'assets_camerawidget';
});

describe('copyCameraArtwork', () => {
  it('copies an Android resource name through the asset cache', async () => {
    await expect(copyCameraArtwork('file:///widgets')).resolves.toBe(
      'file:///widgets/smart-camera.png'
    );
  });

  it('copies a file URI as it is', async () => {
    mockBundledLocalUri = 'file:///data/cache/camera-widget.png';

    await expect(copyCameraArtwork('file:///widgets')).resolves.toBe(
      'file:///widgets/smart-camera.png'
    );
  });

  it('replaces the copy a previous launch left', async () => {
    mockFiles.add('file:///widgets/smart-camera.png');

    await expect(copyCameraArtwork('file:///widgets')).resolves.toBe(
      'file:///widgets/smart-camera.png'
    );
  });
});
