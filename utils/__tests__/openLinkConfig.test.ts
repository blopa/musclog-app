import fs from 'fs';
import path from 'path';

import appJson from '../../app.json';
import websiteRoutes from '../../components/website/websiteRoutes.json';
import { OPEN_LINK_PATH, OPEN_LINK_SCHEME } from '../openLink';

const root = path.resolve(__dirname, '../..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');
const expo = appJson.expo as any;

/**
 * Only `https://musclog.app/open` may open the app. The native manifest and entitlements are
 * generated from `app.json` by prebuild, so this is where the rule is pinned.
 */
describe('open link configuration', () => {
  it('uses the scheme the widgets already use', () => {
    expect(OPEN_LINK_SCHEME).toBe(expo.scheme);
  });

  it('claims exactly one https path on Android, and verifies it', () => {
    const filters = expo.android.intentFilters;

    expect(filters).toHaveLength(1);
    expect(filters[0]).toMatchObject({ action: 'VIEW', autoVerify: true });
    expect(filters[0].category).toEqual(expect.arrayContaining(['BROWSABLE', 'DEFAULT']));
    // An exact `path`: `pathPrefix` would also claim /openfoo and /open/anything.
    expect(filters[0].data).toEqual([
      { scheme: 'https', host: 'musclog.app', path: OPEN_LINK_PATH },
    ]);
  });

  it('associates only the musclog.app domain on iOS', () => {
    expect(expo.ios.associatedDomains).toEqual(['applinks:musclog.app']);
  });
});

describe('app link verification files', () => {
  const assetLinks = JSON.parse(read('public/.well-known/assetlinks.json'));
  const aasa = JSON.parse(read('public/.well-known/apple-app-site-association'));

  it('names the Android package the manifest is built for', () => {
    expect(assetLinks).toHaveLength(1);
    expect(assetLinks[0].relation).toEqual(['delegate_permission/common.handle_all_urls']);
    expect(assetLinks[0].target).toMatchObject({
      namespace: 'android_app',
      package_name: expo.android.package,
    });
    expect(assetLinks[0].target.sha256_cert_fingerprints.length).toBeGreaterThan(0);
  });

  it('names the iOS bundle id and claims only /open', () => {
    expect(aasa.applinks.details).toHaveLength(1);
    expect(aasa.applinks.details[0].appIDs).toHaveLength(1);
    expect(aasa.applinks.details[0].appIDs[0].endsWith(`.${expo.ios.bundleIdentifier}`)).toBe(true);
    expect(aasa.applinks.details[0].components).toEqual([{ '/': OPEN_LINK_PATH }]);
  });

  it('is published with the site, which GitHub Pages only serves from the dot-folder when copied', () => {
    expect(read('.github/workflows/deploy-gh-pages.yml')).toContain(
      'cp -rL public/.well-known/. dist/.well-known/'
    );
    expect(read('.github/workflows/deploy-gh-pages.yml')).toContain('touch dist/.nojekyll');
  });
});

describe('the /open page', () => {
  it('is a noindex route, so the generated robots.txt disallows it', () => {
    expect(websiteRoutes.open).toEqual({
      path: OPEN_LINK_PATH,
      robots: expect.stringContaining('noindex'),
    });
    expect(read('public/robots.txt')).toContain(`Disallow: ${OPEN_LINK_PATH}\n`);
  });

  it('has a native stub next to the web page', () => {
    expect(fs.existsSync(path.join(root, 'app/(website)/open.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'app/(website)/open.web.tsx'))).toBe(true);
  });
});
