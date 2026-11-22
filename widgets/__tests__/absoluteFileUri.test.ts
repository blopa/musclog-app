import { absoluteFileUri } from '@/widgets/absoluteFileUri';

describe('absoluteFileUri', () => {
  it('turns a bare path into a file URI', () => {
    expect(absoluteFileUri('/data/user/0/app/cache/camera-widget.png')).toBe(
      'file:///data/user/0/app/cache/camera-widget.png'
    );
  });

  it.each(['file:///data/x.png', 'content://media/x', 'asset:///camera.png', 'https://a.b/c.png'])(
    'keeps a URI that already has a scheme (%s)',
    (uri) => {
      expect(absoluteFileUri(uri)).toBe(uri);
    }
  );

  it('leaves a relative name alone (the copy then fails and is reported)', () => {
    expect(absoluteFileUri('camera-widget.png')).toBe('camera-widget.png');
  });
});
