import fs from 'node:fs';
import path from 'node:path';

type GalleryData = {
  poses: { name: string; face: string; still: string; animated: string; refs: string[] }[];
  faces: { name: string; id: string; markup: string }[];
  parts: { id: string; variants: { ref: string; markup: string; usedBy: string[] }[] }[];
  themes: { id: string; loggy: Record<'body' | 'shade' | 'deep', string> }[];
  palette: { cls: string }[];
};

const { buildGalleryData, buildGalleryHtml, scriptSafeJson } =
  require('../generate-loggy-gallery') as {
    buildGalleryData: () => GalleryData;
    buildGalleryHtml: (data?: GalleryData) => string;
    scriptSafeJson: (value: unknown) => string;
  };
const { THEME_IDS } = require('../../theme.registry') as { THEME_IDS: string[] };
const { LOGGY_COLORS_BY_THEME } = require('../../constants/loggyTheme') as {
  LOGGY_COLORS_BY_THEME: Record<string, Record<string, string>>;
};

const PARTS_DIR = path.join(__dirname, '..', '..', 'assets', 'avatars', 'loggy-parts');
const manifest = JSON.parse(fs.readFileSync(path.join(PARTS_DIR, 'poses.json'), 'utf8'));
const data = buildGalleryData();

describe('Loggy gallery (assets/avatars/index.html)', () => {
  it('shows every pose of poses.json, still and animated, with only its own face', () => {
    expect(data.poses.map((pose) => pose.name)).toEqual(Object.keys(manifest.poses));

    for (const pose of data.poses) {
      const ownFace = data.faces.find((face) => face.name === pose.face)!;

      for (const svg of [pose.still, pose.animated]) {
        expect(svg).toContain(`<g id="${ownFace.id}">`);
        // The page swaps faces itself, so the hidden copies are left out.
        expect(svg).not.toMatch(/<g id="face[^"]*" display="none"/);
      }

      expect(pose.animated).toContain('@keyframes');
    }
  });

  it('shows every face in faceOrder and every part file of the library', () => {
    expect(data.faces.map((face) => face.name)).toEqual(manifest.faceOrder);

    const onDisk = fs
      .readdirSync(PARTS_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !['animations', 'faces'].includes(entry.name))
      .flatMap((entry) =>
        fs
          .readdirSync(path.join(PARTS_DIR, entry.name))
          .filter((file) => file.endsWith('.svg'))
          .map((file) => `${entry.name}/${file.replace(/\.svg$/, '')}`)
      )
      .sort();
    const shown = data.parts.flatMap((part) => part.variants.map((variant) => variant.ref)).sort();

    expect(shown).toEqual(onDisk);
  });

  it('lists which poses stack each part', () => {
    const variant = data.parts
      .flatMap((part) => part.variants)
      .find((entry) => entry.ref === 'leg-l/standing')!;

    expect(variant.usedBy).toEqual(
      data.poses.filter((pose) => pose.refs.includes('leg-l/standing')).map((pose) => pose.name)
    );
    expect(variant.usedBy.length).toBeGreaterThan(1);
  });

  it('offers every theme with the greens constants/loggyTheme.js gives it', () => {
    expect(data.themes.map((theme) => theme.id)).toEqual(THEME_IDS);

    for (const theme of data.themes) {
      expect(theme.loggy).toEqual(LOGGY_COLORS_BY_THEME[theme.id]);
    }
  });

  it('embeds the data so no script element can be closed early', () => {
    expect(scriptSafeJson({ svg: '</script><!-- x -->' })).not.toContain('<');
    expect(JSON.parse(scriptSafeJson({ svg: '</script>' }))).toEqual({ svg: '</script>' });

    const html = buildGalleryHtml(data);
    const scripts = html.match(/<script[\s>]/g) ?? [];
    const closings = html.match(/<\/script>/g) ?? [];

    expect(scripts).toHaveLength(2);
    expect(closings).toHaveLength(2);

    const json = /<script id="loggy-data" type="application\/json">([\s\S]*?)<\/script>/.exec(
      html
    )![1];

    expect(JSON.parse(json).poses).toHaveLength(data.poses.length);
  });
});
