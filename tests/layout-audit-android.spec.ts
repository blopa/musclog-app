import { test } from '@playwright/test';
import fs from 'fs';
import path from 'path';

import { analyzeSnapshot } from './layoutAudit/analyze';
import {
  createAdb,
  deepLink,
  displayCommands,
  dumpUi,
  listDevices,
  newSince,
  parseUiAutomatorDump,
  parseWmDensity,
  parseWmSize,
  APP_PACKAGE,
  type Adb,
} from './layoutAudit/android';
import { loadAuditProfiles } from './layoutAudit/devices';
import { SHARD_DIR, type ShardEntry } from './layoutAudit/report';
import { MAIN_ROUTES, MODAL_AUDIT_BUTTONS } from './layoutAudit/routes';

/**
 * Runs the layout audit on a connected Android device or emulator. EXPERIMENTAL: written against
 * the adb and uiautomator documentation, not yet exercised on hardware. Needs:
 *  - `adb` on the PATH and one device (set ANDROID_SERIAL when several are attached)
 *  - the app installed and past onboarding, with data worth looking at
 *  - for the modal sweep (`MUSCLOG_LAYOUT_ANDROID_MODALS=1`), a development build, since the
 *    `/app/test/modals` fixture is guarded in production builds
 *
 * The device's display size, density and font scale are changed for each profile and restored
 * afterwards, even when the run fails.
 */

const profiles = loadAuditProfiles();
const MODALS = process.env.MUSCLOG_LAYOUT_ANDROID_MODALS === '1';
const MAX_SWIPES = 30;

interface DisplayState {
  size: { width: number; height: number };
  density: number;
  fontScale: string;
}

function readDisplay(adb: Adb): DisplayState {
  const size = parseWmSize(adb.shell('wm', 'size'));
  const dpi = parseWmDensity(adb.shell('wm', 'density'));
  if (!size || !dpi) {
    throw new Error('could not read the device display size and density');
  }

  const fontScale = adb.shell('settings', 'get', 'system', 'font_scale').trim();
  return { size, density: dpi / 160, fontScale: fontScale === 'null' ? '1.0' : fontScale };
}

const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function swipeUp(adb: Adb, size: { width: number; height: number }): void {
  const x = Math.round(size.width / 2);
  adb.shell(
    'input',
    'swipe',
    String(x),
    String(Math.round(size.height * 0.75)),
    String(x),
    String(Math.round(size.height * 0.25)),
    '300'
  );
}

test.describe('layout audit [android]', () => {
  test.setTimeout(3_600_000);

  for (const profile of profiles) {
    test(`android-${profile.id}`, async ({}, testInfo) => {
      test.skip(testInfo.project.name !== `android-${profile.id}`, 'another profile');
      const devices = listDevices();
      test.skip(devices.length === 0, 'no Android device or emulator attached (adb devices)');

      const adb = createAdb(process.env.ANDROID_SERIAL ?? devices[0]);
      const original = readDisplay(adb);
      const entries: ShardEntry[] = [];
      const base = {
        platform: 'android' as const,
        profile: `android-${profile.id}`,
        locale: 'device',
        fontScale: profile.fontScale,
        viewport: {
          width: Math.round(profile.device.pxWidth / profile.device.density),
          height: Math.round(profile.device.pxHeight / profile.device.density),
        },
      };
      const dump = () =>
        parseUiAutomatorDump(dumpUi(adb), profile.device.density, {
          width: profile.device.pxWidth,
          height: profile.device.pxHeight,
        });
      const open = (routePath: string) => {
        adb.shell('am', 'start', '-W', '-a', 'android.intent.action.VIEW', '-d', deepLink(routePath), APP_PACKAGE);
        return new Promise<void>((resolve) => setTimeout(resolve, 2500));
      };

      try {
        for (const command of displayCommands(profile)) {
          adb.shell(...command);
        }

        await new Promise((resolve) => setTimeout(resolve, 1500));
        for (const route of MAIN_ROUTES) {
          const url = deepLink(route.path);
          try {
            console.log(`[layout:android] ${profile.id}: ${route.name}`);
            await open(route.path);
            const { snapshot } = dump();
            entries.push({
              ...base,
              surface: 'screen',
              name: route.name,
              url,
              status: 'audited',
              pass: 'top',
              findings: analyzeSnapshot(snapshot),
            });
          } catch (error) {
            entries.push({
              ...base,
              surface: 'screen',
              name: route.name,
              url,
              status: 'failed',
              note: (error as Error).message.split('\n')[0],
              pass: 'top',
              findings: [],
            });
          }
        }

        if (MODALS) {
          const fixture = '/test/modals';
          for (const text of MODAL_AUDIT_BUTTONS) {
            const url = deepLink(fixture);
            try {
              console.log(`[layout:android] ${profile.id}: modal ${text}`);
              await open(fixture);
              let before = dump();
              let hit = before.snapshot.nodes.find((node) => node.label === text);
              for (let swipes = 0; !hit && swipes < MAX_SWIPES; swipes++) {
                swipeUp(adb, { width: profile.device.pxWidth, height: profile.device.pxHeight });
                await new Promise((resolve) => setTimeout(resolve, 300));
                before = dump();
                hit = before.snapshot.nodes.find((node) => node.label === text);
              }

              if (!hit) {
                entries.push({
                  ...base,
                  surface: 'modal',
                  name: text,
                  url,
                  status: 'skipped',
                  note: 'button not found on the fixture (is this a development build?)',
                  pass: 'top',
                  findings: [],
                });
                continue;
              }

              const rect = hit.rects[0];
              adb.shell(
                'input',
                'tap',
                String(Math.round((rect.x + rect.w / 2) * profile.device.density)),
                String(Math.round((rect.y + rect.h / 2) * profile.device.density))
              );
              await new Promise((resolve) => setTimeout(resolve, 1500));
              const after = dump();
              const layer = newSince(after, new Set(before.keys));
              entries.push({
                ...base,
                surface: 'modal',
                name: text,
                url,
                status: layer.nodes.length > 0 ? 'audited' : 'skipped',
                note: layer.nodes.length > 0 ? undefined : 'nothing new appeared after the tap',
                pass: 'top',
                findings: analyzeSnapshot(layer),
              });
            } catch (error) {
              entries.push({
                ...base,
                surface: 'modal',
                name: text,
                url,
                status: 'failed',
                note: (error as Error).message.split('\n')[0],
                pass: 'top',
                findings: [],
              });
            }
          }
        }
      } finally {
        adb.shell('wm', 'size', 'reset');
        adb.shell('wm', 'density', 'reset');
        adb.shell('settings', 'put', 'system', 'font_scale', original.fontScale);
        fs.mkdirSync(SHARD_DIR, { recursive: true });
        fs.writeFileSync(
          path.join(SHARD_DIR, `${slug(base.profile)}__device__${slug(testInfo.title)}.json`),
          JSON.stringify(entries)
        );
      }
    });
  }
});
