/* eslint-disable no-undef */
'use strict';

/**
 * Turns each `assets/avatars/loggy-animated/*.svg` into a react-native-svg component whose layers
 * Reanimated can move: `components/loggy/animated/Loggy<Pose>Animated.tsx`.
 *
 * react-native-svg cannot run CSS `@keyframes`, and the SVG transformer would flatten the layer
 * groups the keyframes name. So this script does the two halves itself:
 *   - the artwork: classes become `fill`s, hidden variants are dropped, svgo merges neighbouring
 *     paths, and every group an animation targets becomes a `<LoggyLayer>`;
 *   - the motion: each `#id { transform-origin; animation }` rule plus its `@keyframes` becomes a
 *     `LoggyLayerAnimation` (`utils/loggyAnimation.ts`), which that module plays back.
 *
 * Two things are shared across poses rather than repeated in each file. The path data that more
 * than one pose draws (the log, the legs and the other parts every pose stacks) is written once to
 * `loggyPaths.ts` and referenced by name, so a 20-pose set does not ship the same outline twenty
 * times; and `loggyPoses.ts` is the registry of every pose, so adding a pose never means editing
 * `LoggyPose.tsx`.
 *
 * The animated SVGs are themselves generated (`generate-loggy-svgs.js`, from the parts in
 * `assets/avatars/loggy-parts`): edit a part or `animations/<pose>.css` there, then run
 * `npm run generate-loggy`, which rebuilds the SVGs and then runs this script.
 * `components/__tests__/loggyAnimatedGenerated.test.ts` fails when a generated file is stale.
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { optimize } = require('svgo');
const prettier = require('prettier');

const { THEMED_COLOR_PATTERN } = require('../constants/loggyTheme');
const { readAttributes } = require('./lib/svgAttributes');

const ROOT = path.join(__dirname, '..');
const SOURCE_DIR = path.join(ROOT, 'assets', 'avatars', 'loggy-animated');
const OUTPUT_DIR = path.join(ROOT, 'components', 'loggy', 'animated');
const PATHS_FILE = path.join(OUTPUT_DIR, 'loggyPaths.ts');
const POSES_FILE = path.join(OUTPUT_DIR, 'loggyPoses.ts');

/** A path drawn by at least this many poses is written once, to `loggyPaths.ts`. */
const MIN_POSES_TO_SHARE = 2;

const NOTICE = `// The drawing below is Loggy's artwork, public domain (CC0 1.0): assets/avatars/LOGGY_LICENSE.txt.`;

const EASINGS = ['linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out'];

/** Splits `a { b } c { d }` into `[{ prelude: 'a', body: ' b ' }, …]`, keeping nested braces whole. */
function readBlocks(text) {
  const blocks = [];
  let depth = 0;
  let prelude = '';
  let body = '';

  for (const char of text) {
    if (char === '{') {
      depth += 1;

      if (depth === 1) {
        continue;
      }
    } else if (char === '}') {
      depth -= 1;

      if (depth === 0) {
        blocks.push({ prelude: prelude.trim(), body });
        prelude = '';
        body = '';
        continue;
      }
    }

    if (depth === 0) {
      prelude += char;
    } else {
      body += char;
    }
  }

  return blocks;
}

function readDeclarations(body) {
  const declarations = {};

  for (const part of body.split(';')) {
    const colon = part.indexOf(':');

    if (colon > 0) {
      declarations[part.slice(0, colon).trim()] = part.slice(colon + 1).trim();
    }
  }

  return declarations;
}

function numbersIn(text) {
  return text
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((token) => {
      const value = Number.parseFloat(token);

      if (Number.isNaN(value)) {
        throw new Error(`Cannot read "${token}" as a number`);
      }

      return value;
    });
}

/** `translateY(3px) scale(.9)` to `[{ fn: 'translate', args: [0, 3] }, { fn: 'scale', args: [.9, .9] }]`. */
function readTransform(value) {
  const functions = [];

  for (const [, name, rawArgs] of value.matchAll(/(\w+)\(([^)]*)\)/g)) {
    const args = numbersIn(rawArgs);

    switch (name) {
      case 'translate':
        functions.push({ fn: 'translate', args: [args[0], args[1] ?? 0] });
        break;
      case 'translateX':
        functions.push({ fn: 'translate', args: [args[0], 0] });
        break;
      case 'translateY':
        functions.push({ fn: 'translate', args: [0, args[0]] });
        break;
      case 'scale':
        functions.push({ fn: 'scale', args: [args[0], args[1] ?? args[0]] });
        break;
      case 'scaleX':
        functions.push({ fn: 'scale', args: [args[0], 1] });
        break;
      case 'scaleY':
        functions.push({ fn: 'scale', args: [1, args[0]] });
        break;
      case 'rotate':
        functions.push({ fn: 'rotate', args: [args[0]] });
        break;
      case 'skewX':
        functions.push({ fn: 'skewX', args: [args[0]] });
        break;
      default:
        throw new Error(`Unsupported CSS transform function ${name}()`);
    }
  }

  return functions;
}

function readKeyframes(name, body) {
  const frames = [];

  for (const { prelude, body: frameBody } of readBlocks(body)) {
    const declarations = readDeclarations(frameBody);
    const transform = readTransform(declarations.transform ?? '');
    const opacity = declarations.opacity === undefined ? undefined : Number(declarations.opacity);

    for (const stop of prelude.split(',')) {
      frames.push({
        at: Number.parseFloat(stop) / 100,
        transform,
        opacity,
      });
    }
  }

  frames.sort((a, b) => a.at - b.at);

  if (frames.length < 2 || frames[0].at !== 0 || frames[frames.length - 1].at !== 1) {
    throw new Error(`@keyframes ${name} must open at 0% and close at 100%`);
  }

  const fns = frames[0].transform.map((entry) => entry.fn);

  for (const frame of frames) {
    if (frame.transform.map((entry) => entry.fn).join() !== fns.join()) {
      throw new Error(`@keyframes ${name} changes its transform functions between frames`);
    }

    if ((frame.opacity === undefined) !== (frames[0].opacity === undefined)) {
      throw new Error(`@keyframes ${name} animates opacity in some frames only`);
    }
  }

  return {
    fns,
    animatesOpacity: frames[0].opacity !== undefined,
    frames: frames.map((frame) => ({
      at: frame.at,
      args: frame.transform.map((entry) => entry.args),
      ...(frame.opacity === undefined ? {} : { opacity: frame.opacity }),
    })),
  };
}

function readAnimationShorthand(value) {
  let name = null;
  let durationMs = null;
  let easing = 'ease';

  for (const token of value.split(/\s+/)) {
    if (/^[\d.]+m?s$/.test(token)) {
      durationMs = Math.round(Number.parseFloat(token) * (token.endsWith('ms') ? 1 : 1000));
    } else if (EASINGS.includes(token)) {
      easing = token;
    } else if (token === 'infinite') {
      continue;
    } else if (name === null) {
      name = token;
    } else {
      throw new Error(`Unsupported animation token "${token}" in "${value}"`);
    }
  }

  if (!name || !durationMs) {
    throw new Error(`Animation "${value}" needs a name and a duration`);
  }

  return { name, durationMs, easing };
}

/** The motion in a `<style>` sheet: `{ loopMs, layers }`, shaped as `LoggyAnimation`. */
function readAnimation(css) {
  const blocks = readBlocks(css.replace(/\/\*[\s\S]*?\*\//g, ''));
  const keyframes = {};
  const layers = {};

  for (const { prelude, body } of blocks) {
    if (prelude.startsWith('@keyframes')) {
      const name = prelude.replace('@keyframes', '').trim();
      keyframes[name] = readKeyframes(name, body);
    }
  }

  for (const { prelude, body } of blocks) {
    if (!prelude.startsWith('#')) {
      continue;
    }

    const declarations = readDeclarations(body);

    if (!declarations.animation) {
      continue;
    }

    const { name, durationMs, easing } = readAnimationShorthand(declarations.animation);
    const frames = keyframes[name];

    if (!frames) {
      throw new Error(`${prelude} runs @keyframes ${name}, which is not defined`);
    }

    const [originX = 0, originY = 0] = numbersIn(declarations['transform-origin'] ?? '0 0');

    for (const selector of prelude.split(',')) {
      const id = selector.trim().replace(/^#/, '');

      if (!/^[\w-]+$/.test(id) || layers[id]) {
        throw new Error(`Cannot animate "${selector.trim()}" (unsupported or repeated selector)`);
      }

      layers[id] = {
        origin: [originX, originY],
        durationMs,
        easing,
        fns: frames.fns,
        frames: frames.frames,
        animatesOpacity: frames.animatesOpacity,
      };
    }
  }

  const durations = Object.values(layers).map((layer) => layer.durationMs);
  const loopMs = Math.max(...durations);

  if (!durations.length || durations.some((duration) => loopMs % duration !== 0)) {
    throw new Error('Every layer duration must divide the longest one so one clock can drive them');
  }

  return { loopMs, layers };
}

/** `.s4 { fill: #47ad92; stroke: … }` to `{ s4: 'fill="#47ad92" stroke="…"' }`, as SVG attributes. */
function readClasses(css) {
  const classes = {};

  for (const [, name, body] of css.matchAll(/\.(s\d+)\s*\{([^}]*)\}/g)) {
    classes[name] = Object.entries(readDeclarations(body))
      .map(([property, value]) => `${property}="${value}"`)
      .join(' ');
  }

  return classes;
}

/** Removes every `<g ... display="none">` subtree (the hidden face variants). */
function dropHiddenGroups(svg) {
  let result = svg;

  for (;;) {
    const start = result.search(/<g [^>]*display="none"[^>]*>/);

    if (start === -1) {
      return result;
    }

    const tag = /<(\/?)g\b[^>]*>/g;
    tag.lastIndex = start;
    let depth = 0;

    for (let match = tag.exec(result); match; match = tag.exec(result)) {
      depth += match[1] ? -1 : 1;

      if (depth === 0) {
        result = result.slice(0, start) + result.slice(tag.lastIndex);
        break;
      }
    }
  }
}

/** The `<g>`/`<path>` tree of an optimized SVG body. */
function readTree(svg) {
  const root = { children: [] };
  const stack = [root];

  for (const [, closing, tag, rawAttributes, selfClosing] of svg.matchAll(
    /<(\/?)(svg|g|path)((?:\s[^>]*?)?)(\/?)>/g
  )) {
    if (tag === 'svg') {
      continue;
    }

    if (closing) {
      stack.pop();
      continue;
    }

    const node = { tag, attributes: readAttributes(rawAttributes, 'optimized SVG'), children: [] };
    stack[stack.length - 1].children.push(node);

    if (!selfClosing) {
      stack.push(node);
    }
  }

  return root;
}

const PATH_PROPS = {
  d: 'd',
  fill: 'fill',
  stroke: 'stroke',
  'stroke-linejoin': 'strokeLinejoin',
  'stroke-width': 'strokeWidth',
};

/**
 * A themed fill (`var(--loggy-body, #47ad92)`, written by `palette.css`) becomes the prop
 * `{colors.body}`, so the pose paints the greens it is given instead of the ones it was drawn in.
 * Any other `var(...)` is refused: it would reach react-native-svg as an unreadable colour.
 */
function colorProp(value) {
  const themed = new RegExp(`^${THEMED_COLOR_PATTERN.source}$`).exec(value);

  if (themed) {
    return `{colors.${themed[1]}}`;
  }

  if (value.includes('var(')) {
    throw new Error(`Unsupported colour "${value}": only the themed Loggy greens may use var()`);
  }

  return JSON.stringify(value);
}

/** `drawn` collects the `d` of every path, so the caller knows which ones other poses draw too. */
function pathElement(node, drawn) {
  const unsupported = Object.keys(node.attributes).filter((name) => !PATH_PROPS[name]);

  if (!node.attributes.d || unsupported.length) {
    throw new Error(`Unsupported <path> attributes: ${JSON.stringify(node.attributes)}`);
  }

  drawn.add(node.attributes.d);

  const props = Object.entries(node.attributes)
    .map(([name, value]) =>
      name === 'fill' || name === 'stroke'
        ? `${PATH_PROPS[name]}=${colorProp(value)}`
        : `${PATH_PROPS[name]}=${JSON.stringify(value)}`
    )
    .join(' ');

  return `<Path ${props} />`;
}

function element(node, animatedIds, seen, drawn) {
  if (node.tag === 'path') {
    return pathElement(node, drawn);
  }

  const { id, ...rest } = node.attributes;

  if (Object.keys(rest).length) {
    throw new Error(`Unsupported <g> attributes: ${JSON.stringify(node.attributes)}`);
  }

  const children = node.children
    .map((child) => element(child, animatedIds, seen, drawn))
    .join('\n');

  // A group nothing moves is only a name; the layers keep the drawing order without it.
  if (!animatedIds.has(id)) {
    return children;
  }

  seen.add(id);

  return `<LoggyLayer clock={clock} layer={ANIMATION.layers[${JSON.stringify(id)}]}>\n${children}\n</LoggyLayer>`;
}

function pascalCase(pose) {
  return pose.charAt(0).toUpperCase() + pose.slice(1);
}

function buildPose(file) {
  const pose = path.basename(file, '.svg').replace(/^loggy-/, '');
  const name = `Loggy${pascalCase(pose)}Animated`;
  const source = fs.readFileSync(file, 'utf8');
  const css = /<style>([\s\S]*?)<\/style>/.exec(source)?.[1] ?? '';
  const animation = readAnimation(css);
  const classes = readClasses(css);
  const viewBox = /viewBox="([^"]+)"/.exec(source)?.[1];

  if (!viewBox) {
    throw new Error(`${file} has no viewBox`);
  }

  // Width and height of the drawing: `LoggyPose` takes its proportions from here.
  const [, , width, height] = viewBox
    .trim()
    .split(/[\s,]+/)
    .map(Number);

  if (!(width > 0 && height > 0)) {
    throw new Error(`${file} has a viewBox without a width and a height`);
  }

  const prepared = dropHiddenGroups(source.replace(/<style>[\s\S]*?<\/style>/, '')).replace(
    /class="(s\d+)"/g,
    (_, cls) => {
      if (!classes[cls]) {
        throw new Error(`${file} uses .${cls}, which the style sheet does not define`);
      }

      return classes[cls];
    }
  );

  // Keep the groups the keyframes name: svgo's id cleanup and group collapsing would erase them.
  const optimized = optimize(prepared, {
    plugins: [
      {
        name: 'preset-default',
        params: {
          overrides: {
            cleanupIds: false,
            collapseGroups: false,
            moveElemsAttrsToGroup: false,
            moveGroupAttrsToElems: false,
            removeViewBox: false,
          },
        },
      },
    ],
  }).data;

  const animatedIds = new Set(Object.keys(animation.layers));
  const seen = new Set();
  const drawn = new Set();
  const body = readTree(optimized)
    .children.map((child) => element(child, animatedIds, seen, drawn))
    .join('\n');
  const missing = [...animatedIds].filter((id) => !seen.has(id));

  if (missing.length) {
    throw new Error(`${file} animates ${missing.join(', ')}, which the drawing does not have`);
  }

  return { pose, name, animation, viewBox, width, height, body, drawn };
}

/** The key a shared path is stored under: stable for the same data, so a regeneration does not rename it. */
function pathKey(d) {
  return `p${crypto.createHash('sha1').update(d).digest('hex').slice(0, 8)}`;
}

/** The path data drawn by at least `MIN_POSES_TO_SHARE` poses, by key. */
function sharedPaths(built) {
  const posesByPath = new Map();

  for (const { pose, drawn } of built) {
    for (const d of drawn) {
      posesByPath.set(d, (posesByPath.get(d) ?? new Set()).add(pose));
    }
  }

  const shared = new Map();

  for (const [d, poses] of posesByPath) {
    if (poses.size < MIN_POSES_TO_SHARE) {
      continue;
    }

    const key = pathKey(d);

    if (shared.has(key)) {
      throw new Error(`Two different paths hash to ${key}`);
    }

    shared.set(key, d);
  }

  return shared;
}

async function format(code, outputPath) {
  const options = (await prettier.resolveConfig(outputPath)) ?? {};

  return prettier.format(code, { ...options, filepath: outputPath });
}

async function renderPose({ pose, name, animation, viewBox, width, height, body, drawn }, shared) {
  const keyByPath = new Map([...shared].map(([key, d]) => [d, key]));
  let usesShared = false;
  let code = body;

  for (const d of drawn) {
    const key = keyByPath.get(d);

    if (key) {
      usesShared = true;
      code = code.split(`d=${JSON.stringify(d)}`).join(`d={LOGGY_PATHS.${key}}`);
    }
  }

  const outputPath = path.join(OUTPUT_DIR, `${name}.tsx`);
  const source = `// Generated by scripts/generate-loggy-animated.js from assets/avatars/loggy-animated/loggy-${pose}.svg.
// Edit the parts in assets/avatars/loggy-parts, then run \`npm run generate-loggy\`.
${NOTICE}
import Svg, { Path } from 'react-native-svg';

${usesShared ? "import { LOGGY_PATHS } from '@/components/loggy/animated/loggyPaths';\n" : ''}import {
  type LoggyAnimatedArtProps,
  type LoggyAnimatedPose,
  LoggyLayer,
} from '@/components/loggy/LoggyLayer';
import type { LoggyAnimation } from '@/utils/loggyAnimation';

const ANIMATION: LoggyAnimation = ${JSON.stringify(animation)};

function Art({ clock, colors, ...props }: LoggyAnimatedArtProps) {
  return (
    <Svg viewBox=${JSON.stringify(viewBox)} {...props}>
      ${code}
    </Svg>
  );
}

export const ${name}: LoggyAnimatedPose = { Art, animation: ANIMATION, size: [${width}, ${height}] };
`;

  return [outputPath, await format(source, outputPath)];
}

async function renderPaths(shared) {
  const entries = [...shared]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, d]) => `  ${key}: ${JSON.stringify(d)},`)
    .join('\n');
  const source = `// Generated by scripts/generate-loggy-animated.js. Do not edit.
// The path data that more than one pose draws, written once and named by a hash of the data.
${NOTICE}
export const LOGGY_PATHS = {
${entries}
};
`;

  return [PATHS_FILE, await format(source, PATHS_FILE)];
}

/** `loggyPoses.ts`: every pose's generated component by name, so `LoggyPose` keeps no list of its own. */
async function renderRegistry(built) {
  const poses = built
    .map(({ pose, name }) => ({ pose, name }))
    .sort((a, b) => a.pose.localeCompare(b.pose));
  const imports = poses
    .map(({ name }) => `import { ${name} } from '@/components/loggy/animated/${name}';`)
    .join('\n');
  const entries = poses.map(({ pose, name }) => `  ${pose}: ${name},`).join('\n');
  const source = `// Generated by scripts/generate-loggy-animated.js. Do not edit.
// Every pose's generated component, by name. Adding a pose adds a line here by itself.
// Loggy's artwork is public domain (CC0 1.0): assets/avatars/LOGGY_LICENSE.txt.
${imports}
import type { LoggyAnimatedPose } from '@/components/loggy/LoggyLayer';

export const LOGGY_POSES = {
${entries}
} as const satisfies Record<string, LoggyAnimatedPose>;
`;

  return [POSES_FILE, await format(source, POSES_FILE)];
}

/** Every generated file's path and contents, without writing anything. */
async function generateAll() {
  const files = fs
    .readdirSync(SOURCE_DIR)
    .filter((name) => name.endsWith('.svg'))
    .sort();
  const poses = files.map((name) => buildPose(path.join(SOURCE_DIR, name)));
  const shared = sharedPaths(poses);

  return Object.fromEntries([
    ...(await Promise.all(poses.map((pose) => renderPose(pose, shared)))),
    await renderPaths(shared),
    await renderRegistry(poses),
  ]);
}

async function main() {
  const generated = await generateAll();

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  for (const [outputPath, contents] of Object.entries(generated)) {
    fs.writeFileSync(outputPath, contents);
    console.log(`wrote ${path.relative(ROOT, outputPath)} (${contents.length} bytes)`);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { generateAll, readAnimation, SOURCE_DIR };
