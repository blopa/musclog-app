import { analyzeSnapshot } from '../analyze';
import {
  deepLink,
  displayCommands,
  newSince,
  parseUiAutomatorDump,
  parseWmDensity,
  parseWmSize,
} from '../android';
import type { AuditProfile } from '../devices';

const DUMP = `<?xml version='1.0' encoding='UTF-8' standalone='yes' ?>
<hierarchy rotation="0">
  <node index="0" text="" resource-id="" class="android.widget.FrameLayout" content-desc="" clickable="false" scrollable="false" bounds="[0,0][1080,2400]">
    <node index="0" text="" resource-id="com.werules.logger:id/scroll" class="android.widget.ScrollView" content-desc="" clickable="false" scrollable="true" bounds="[0,100][1080,2200]">
      <node index="0" text="Scan &amp; go" resource-id="" class="android.widget.TextView" content-desc="" clickable="false" scrollable="false" bounds="[100,500][500,560]" />
      <node index="1" text="" resource-id="" class="android.view.ViewGroup" content-desc="Scan button" clickable="true" scrollable="false" bounds="[80,480][1000,600]">
        <node index="0" text="Label" resource-id="" class="android.widget.TextView" content-desc="" clickable="false" scrollable="false" bounds="[100,500][300,560]" />
      </node>
      <node index="2" text="Far below" resource-id="" class="android.widget.TextView" content-desc="" clickable="false" scrollable="false" bounds="[100,2500][500,2560]" />
    </node>
    <node index="1" text="Off screen" resource-id="" class="android.widget.TextView" content-desc="" clickable="false" scrollable="false" bounds="[1200,100][1400,160]" />
    <node index="2" text="" resource-id="com.werules.logger:id/field" class="android.widget.EditText" content-desc="Weight" clickable="true" scrollable="false" bounds="[40,1000][1040,1100]" />
    <node index="3" text="" resource-id="" class="android.widget.ImageView" content-desc="Avatar" clickable="false" scrollable="false" bounds="[40,2250][140,2350]" />
    <node index="4" text="" resource-id="" class="android.view.View" content-desc="" clickable="false" scrollable="false" bounds="[0,0][0,0]" />
  </node>
</hierarchy>`;

const SCREEN = { width: 1080, height: 2400 };

describe('parseUiAutomatorDump', () => {
  const parsed = parseUiAutomatorDump(DUMP, 3, SCREEN);
  const byLabel = (label: string) => parsed.snapshot.nodes.find((node) => node.label === label);

  it('reports the viewport and rects in dp, not pixels', () => {
    expect(parsed.snapshot.viewport).toEqual({ width: 360, height: 800 });
    expect(byLabel('Scan & go')?.rects[0]).toEqual({ x: 33.3, y: 166.7, w: 133.3, h: 20 });
  });

  it('decodes entities and classifies text, controls, inputs and images', () => {
    expect(byLabel('Scan & go')?.kind).toBe('text');
    expect(byLabel('Scan button')?.kind).toBe('interactive');
    expect(byLabel('Weight')?.kind).toBe('input');
    expect(byLabel('Avatar')?.kind).toBe('image');
    // A container with no text, no click and no description is not a node.
    expect(parsed.snapshot.nodes.map((node) => node.label)).not.toContain('');
  });

  it('nests a text under the control that holds it', () => {
    const button = byLabel('Scan button');
    const label = byLabel('Label');
    expect(label?.parent).toBe(button?.id);
    expect(byLabel('Scan & go')?.parent).toBeNull();
  });

  it('puts what sits in a scroller in its own scroll context and treats it as reachable', () => {
    expect(byLabel('Scan & go')?.scrollContext).toMatch(/^scroll:/);
    expect(byLabel('Weight')?.scrollContext).toBe('root');
    expect(byLabel('Far below')?.reachable).toBe(true);
  });

  it('marks content outside the screen with no scroller as unreachable', () => {
    expect(byLabel('Off screen')?.reachable).toBe(false);
    const findings = analyzeSnapshot(parsed.snapshot);
    expect(findings.find((finding) => finding.kind === 'unreachable')?.labels).toEqual([
      'Off screen',
    ]);
  });

  it('clips what is visible to the screen but keeps the full rect', () => {
    const far = byLabel('Far below');
    expect(far?.visible).toEqual([]);
    expect(far?.rects).toHaveLength(1);
  });

  it('skips zero-sized nodes and gives every node a key for diffing', () => {
    expect(parsed.keys).toHaveLength(parsed.snapshot.nodes.length);
    expect(new Set(parsed.keys).size).toBe(parsed.keys.length);
  });
});

describe('newSince', () => {
  it('keeps only what appeared after a tap, and re-links parents among the survivors', () => {
    const before = parseUiAutomatorDump(DUMP, 3, SCREEN);
    const after = parseUiAutomatorDump(
      DUMP.replace(
        '</hierarchy>',
        `<node index="9" text="" resource-id="" class="android.view.ViewGroup" content-desc="Sheet" clickable="true" scrollable="false" bounds="[0,1200][1080,2400]">
           <node index="0" text="Title" resource-id="" class="android.widget.TextView" content-desc="" clickable="false" scrollable="false" bounds="[40,1220][400,1280]" />
         </node></hierarchy>`
      ),
      3,
      SCREEN
    );
    const layer = newSince(after, new Set(before.keys));
    expect(layer.nodes.map((node) => node.label)).toEqual(['Sheet', 'Title']);
    expect(layer.nodes[1].parent).toBe(layer.nodes[0].id);
    expect(layer.nodes.map((node) => node.id)).toEqual([0, 1]);
  });
});

describe('adb output', () => {
  it('prefers an override over the physical size and density', () => {
    expect(parseWmSize('Physical size: 1080x2400\nOverride size: 720x1600\n')).toEqual({
      width: 720,
      height: 1600,
    });
    expect(parseWmSize('Physical size: 1080x2400\n')).toEqual({ width: 1080, height: 2400 });
    expect(parseWmDensity('Physical density: 420\nOverride density: 320\n')).toBe(320);
    expect(parseWmDensity('Physical density: 420\n')).toBe(420);
    expect(parseWmSize('garbage')).toBeNull();
    expect(parseWmDensity('garbage')).toBeNull();
  });

  it('builds the commands that make a device draw a profile, and the route deep link', () => {
    const profile = {
      id: '360x800-fs1.3',
      fontScale: 1.3,
      device: { pxWidth: 1080, pxHeight: 2400, density: 3 },
    } as unknown as AuditProfile;
    expect(displayCommands(profile)).toEqual([
      ['wm', 'size', '1080x2400'],
      ['wm', 'density', '480'],
      ['settings', 'put', 'system', 'font_scale', '1.3'],
    ]);
    expect(deepLink('/nutrition/food')).toBe('com.werules.logger:///app/nutrition/food');
    expect(deepLink('')).toBe('com.werules.logger:///app');
  });
});
