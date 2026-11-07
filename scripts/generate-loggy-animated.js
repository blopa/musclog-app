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
 * The animated SVGs are themselves generated (`generate-loggy-svgs.js`, from the parts in
 * `assets/avatars/loggy-parts`): edit a part or `animations/<pose>.css` there, then run
 * `npm run generate-loggy`, which rebuilds the SVGs and then runs this script.
 * `components/__tests__/loggyAnimatedGenerated.test.ts` fails when a generated file is stale.
 */

const fs = require('node:fs');
const path = require('node:path');
const { optimize } = require('svgo'); // Reached through react-native-svg-transformer.
const prettier = require('prettier');

const { THEMED_COLOR_PATTERN } = require('../constants/loggyTheme');
const { readAttributes } = require('./lib/svgAttributes');

const ROOT = path.join(__dirname, '..');
const SOURCE_DIR = path.join(ROOT, 'assets', 'avatars', 'loggy-animated');
const OUTPUT_DIR = path.join(ROOT, 'components', 'loggy', 'animated');

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

function pathElement(node) {
  const unsupported = Object.keys(node.attributes).filter((name) => !PATH_PROPS[name]);

  if (!node.attributes.d || unsupported.length) {
    throw new Error(`Unsupported <path> attributes: ${JSON.stringify(node.attributes)}`);
  }

  const props = Object.entries(node.attributes)
    .map(([name, value]) =>
      name === 'fill' || name === 'stroke'
        ? `${PATH_PROPS[name]}=${colorProp(value)}`
        : `${PATH_PROPS[name]}=${JSON.stringify(value)}`
    )
    .join(' ');

  return `<Path ${props} />`;
}

function element(node, animatedIds, seen) {
  if (node.tag === 'path') {
    return pathElement(node);
  }

  const { id, ...rest } = node.attributes;

  if (Object.keys(rest).length) {
    throw new Error(`Unsupported <g> attributes: ${JSON.stringify(node.attributes)}`);
  }

  const children = node.children.map((child) => element(child, animatedIds, seen)).join('\n');

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

async function generateOne(file) {
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
  const body = readTree(optimized)
    .children.map((child) => element(child, animatedIds, seen))
    .join('\n');
  const missing = [...animatedIds].filter((id) => !seen.has(id));

  if (missing.length) {
    throw new Error(`${file} animates ${missing.join(', ')}, which the drawing does not have`);
  }

  const code = `// Generated by scripts/generate-loggy-animated.js from assets/avatars/loggy-animated/loggy-${pose}.svg.
// Edit the parts in assets/avatars/loggy-parts, then run \`npm run generate-loggy\`.
import Svg, { Path } from 'react-native-svg';

import {
  type LoggyAnimatedArtProps,
  type LoggyAnimatedPose,
  LoggyLayer,
} from '@/components/loggy/LoggyLayer';
import type { LoggyAnimation } from '@/utils/loggyAnimation';

const ANIMATION: LoggyAnimation = ${JSON.stringify(animation)};

function Art({ clock, colors, ...props }: LoggyAnimatedArtProps) {
  return (
    <Svg viewBox=${JSON.stringify(viewBox)} {...props}>
      ${body}
    </Svg>
  );
}

export const ${name}: LoggyAnimatedPose = { Art, animation: ANIMATION };
`;

  const outputPath = path.join(OUTPUT_DIR, `${name}.tsx`);
  const options = (await prettier.resolveConfig(outputPath)) ?? {};

  return [outputPath, await prettier.format(code, { ...options, filepath: outputPath })];
}

/** Every generated file's path and contents, without writing anything. */
async function generateAll() {
  const files = fs
    .readdirSync(SOURCE_DIR)
    .filter((name) => name.endsWith('.svg'))
    .sort();

  return Object.fromEntries(
    await Promise.all(files.map((name) => generateOne(path.join(SOURCE_DIR, name))))
  );
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
