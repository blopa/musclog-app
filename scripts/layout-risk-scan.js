#!/usr/bin/env node
/* eslint-disable no-undef */
/**
 * layout-risk-scan.js
 *
 * A static, noisy, cheap ranking of the files most likely to look cramped on a small phone or
 * with a large system font. It cannot prove a layout is broken; it points the runtime audit
 * (`npm run layout:audit`) and a human at the code with the most risky patterns first.
 *
 * Rules read the JSX only (no types, no rendering):
 *   row-text-no-shrink    a flex-row holding text that can neither shrink nor truncate
 *   row-buttons           two or more Buttons side by side with no flex-1 to share the width
 *   row-many-items        a flex-row of four or more children that cannot wrap
 *   fixed-width           a literal width of 240+ px (a 344 dp phone is narrower than that)
 *   fixed-height-text     a literal height around text that a larger font would outgrow
 *   absolute-over-text    an absolutely positioned sibling of text
 *   window-math           manual Dimensions / useWindowDimensions arithmetic
 *
 * Usage:
 *   npm run layout:scan                      top 40 files
 *   npm run layout:scan -- --top 100
 *   npm run layout:scan -- --min-score 6 --json
 *   npm run layout:scan -- --dir components/modals
 */

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_DIRS = ['app/app', 'components'];
/** The marketing website renders plain HTML and is audited by its own screenshots. */
const SKIPPED_PATH = /(^|\/)(__tests__|test|website)(\/|$)|\.(test|spec)\.tsx?$|\.d\.ts$/;

const RULES = {
  'row-text-no-shrink': {
    weight: 3,
    message: 'flex-row holds text that cannot shrink or truncate (no flex-1, shrink or numberOfLines)',
  },
  'row-buttons': {
    weight: 2,
    message: 'two or more Buttons share a flex-row with no flex-1: labels outgrow the width',
  },
  'row-many-items': {
    weight: 2,
    message: 'flex-row of four or more children that cannot wrap',
  },
  'fixed-width': {
    weight: 2,
    message: 'literal width wider than a small phone',
  },
  'fixed-height-text': {
    weight: 2,
    message: 'literal height around text: a larger font outgrows the box',
  },
  'absolute-over-text': {
    weight: 2,
    message: 'absolutely positioned element next to text can collide with it',
  },
  'window-math': {
    weight: 1,
    message: 'manual window-size arithmetic instead of flex layout',
  },
};

const SHRINKS = ['flex-1', 'flex-shrink', 'shrink', 'min-w-0', 'flex-auto'];
const FIXED_WIDTH_PX = 240;
const FIXED_HEIGHT_PX = 20;
const MANY_ITEMS = 4;

function collectStrings(node, into = []) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    into.push(node.text);
  } else if (ts.isTemplateExpression(node)) {
    into.push(node.head.text);
    node.templateSpans.forEach((span) => {
      into.push(span.literal.text);
      collectStrings(span.expression, into);
    });
  } else {
    ts.forEachChild(node, (child) => collectStrings(child, into));
  }

  return into;
}

function attributeMap(opening) {
  const map = new Map();
  opening.attributes.properties.forEach((attribute) => {
    if (ts.isJsxAttribute(attribute) && attribute.name) {
      map.set(attribute.name.getText(), attribute.initializer);
    }
  });

  return map;
}

function classTokens(attributes) {
  const initializer = attributes.get('className');
  if (!initializer) {
    return [];
  }

  return collectStrings(initializer)
    .join(' ')
    .split(/\s+/)
    .filter(Boolean);
}

/** `style={{ width: 300 }}` or an array of such objects, as name → literal text. */
function styleProps(attributes) {
  const initializer = attributes.get('style');
  const props = new Map();
  const read = (node) => {
    if (ts.isObjectLiteralExpression(node)) {
      node.properties.forEach((property) => {
        if (ts.isPropertyAssignment(property)) {
          props.set(property.name.getText().replace(/['"]/g, ''), property.initializer.getText().replace(/['"]/g, ''));
        }
      });
    } else if (ts.isArrayLiteralExpression(node)) {
      node.elements.forEach(read);
    } else if (ts.isJsxExpression(node) && node.expression) {
      read(node.expression);
    }
  };
  if (initializer) {
    read(initializer);
  }

  return props;
}

function tagOf(element) {
  const opening = ts.isJsxElement(element) ? element.openingElement : element;
  return opening.tagName.getText();
}

function openingOf(element) {
  return ts.isJsxElement(element) ? element.openingElement : element;
}

function isTextLike(tag) {
  if (/Input|Button|Field|Context|Provider/.test(tag)) {
    return false;
  }

  return tag === 'Text' || tag.endsWith('.Text') || tag.endsWith('Text');
}

function isRow(tokens, style) {
  return (
    tokens.includes('flex-row') || tokens.includes('flex-row-reverse') || style.get('flexDirection') === 'row'
  );
}

function shrinks(tokens, attributes, style) {
  return (
    SHRINKS.some((token) => tokens.includes(token)) ||
    attributes.has('numberOfLines') ||
    style.has('flex') ||
    style.has('flexShrink') ||
    style.has('minWidth')
  );
}

function arbitraryPx(tokens, prefix) {
  const found = [];
  tokens.forEach((token) => {
    const match = new RegExp(`^${prefix}-\\[(\\d+)(?:px)?\\]$`).exec(token);
    if (match) {
      found.push(Number(match[1]));
    }
  });

  return found;
}

function childElements(element) {
  if (!ts.isJsxElement(element)) {
    return [];
  }

  return element.children.filter((child) => ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child));
}

/**
 * @param {string} source
 * @param {string} fileName
 * @returns {{ file: string, score: number, findings: Array<{ rule: string, weight: number, line: number, message: string }> }}
 */
function scanSource(source, fileName) {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const findings = [];
  const report = (rule, node, detail) => {
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    findings.push({
      rule,
      weight: RULES[rule].weight,
      line: line + 1,
      message: detail ? `${RULES[rule].message} (${detail})` : RULES[rule].message,
    });
  };

  const visit = (node) => {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const opening = openingOf(node);
      const attributes = attributeMap(opening);
      const tokens = classTokens(attributes);
      const style = styleProps(attributes);
      const tag = tagOf(node);

      const widths = [
        ...arbitraryPx(tokens, 'w'),
        ...arbitraryPx(tokens, 'min-w'),
        ...[style.get('width'), style.get('minWidth')].filter((value) => /^\d+$/.test(value ?? '')).map(Number),
      ].filter((value) => value >= FIXED_WIDTH_PX);
      if (widths.length > 0) {
        report('fixed-width', opening, `${Math.max(...widths)}px on <${tag}>`);
      }

      const children = childElements(node);
      const hasDynamicChildren = ts.isJsxElement(node) && node.children.some((child) => ts.isJsxExpression(child) && child.expression);

      if (isRow(tokens, style) && !tokens.includes('flex-wrap') && style.get('flexWrap') !== 'wrap') {
        const texts = children.filter((child) => isTextLike(tagOf(child)));
        const canShrink = (child) => {
          const childAttributes = attributeMap(openingOf(child));
          return shrinks(classTokens(childAttributes), childAttributes, styleProps(childAttributes));
        };
        const rigid = texts.filter((child) => !canShrink(child));
        // A flexible sibling (flex-1, a truncating text) absorbs a longer string, so the row only
        // holds a risk when nothing in it can give.
        if (children.length >= 2 && rigid.length > 0 && !children.some(canShrink)) {
          report('row-text-no-shrink', opening, `${rigid.length} of ${texts.length} text child(ren)`);
        }

        const buttons = children.filter((child) => tagOf(child) === 'Button');
        const sharing = buttons.filter((child) => {
          const childAttributes = attributeMap(openingOf(child));
          return !classTokens(childAttributes).includes('flex-1') && !styleProps(childAttributes).has('flex');
        });
        if (buttons.length >= 2 && sharing.length >= 2) {
          report('row-buttons', opening, `${buttons.length} Buttons`);
        }

        if (children.length >= MANY_ITEMS && !hasDynamicChildren) {
          report('row-many-items', opening, `${children.length} children`);
        }
      }

      const heights = [
        ...arbitraryPx(tokens, 'h'),
        ...[style.get('height')].filter((value) => /^\d+$/.test(value ?? '')).map(Number),
      ].filter((value) => value >= FIXED_HEIGHT_PX);
      if (heights.length > 0 && children.some((child) => isTextLike(tagOf(child)))) {
        const allLimited = children
          .filter((child) => isTextLike(tagOf(child)))
          .every((child) => attributeMap(openingOf(child)).has('numberOfLines'));
        if (!allLimited) {
          report('fixed-height-text', opening, `${Math.max(...heights)}px on <${tag}>`);
        }
      }

      if (children.some((child) => isTextLike(tagOf(child)))) {
        const overlays = children.filter((child) => {
          const childAttributes = attributeMap(openingOf(child));
          return (
            classTokens(childAttributes).includes('absolute') ||
            styleProps(childAttributes).get('position') === 'absolute'
          );
        });
        if (overlays.length > 0 && !isTextLike(tag)) {
          report('absolute-over-text', opening, `${overlays.length} absolute sibling(s)`);
        }
      }
    }

    if (
      ts.isCallExpression(node) &&
      /^(Dimensions\.get|useWindowDimensions)$/.test(node.expression.getText(sourceFile))
    ) {
      report('window-math', node);
    }

    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  return {
    file: fileName,
    score: findings.reduce((total, finding) => total + finding.weight, 0),
    findings,
  };
}

function listFiles(directory) {
  const absolute = path.resolve(ROOT, directory);
  if (!fs.existsSync(absolute)) {
    return [];
  }

  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(directory, entry.name);
    if (SKIPPED_PATH.test(relative)) {
      return [];
    }

    if (entry.isDirectory()) {
      return listFiles(relative);
    }

    return /\.tsx$/.test(entry.name) ? [relative] : [];
  });
}

function scanFiles(directories = DEFAULT_DIRS) {
  return directories
    .flatMap(listFiles)
    .map((file) => scanSource(fs.readFileSync(path.join(ROOT, file), 'utf8'), file))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || a.file.localeCompare(b.file));
}

function parseArguments(argv) {
  const options = { top: 40, minScore: 1, json: false, directories: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--top') {
      options.top = Number(argv[++i]);
    } else if (argv[i] === '--min-score') {
      options.minScore = Number(argv[++i]);
    } else if (argv[i] === '--dir') {
      options.directories.push(argv[++i]);
    } else if (argv[i] === '--json') {
      options.json = true;
    }
  }

  return options;
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  const results = scanFiles(options.directories.length > 0 ? options.directories : DEFAULT_DIRS).filter(
    (result) => result.score >= options.minScore
  );
  if (options.json) {
    process.stdout.write(JSON.stringify(results, null, 2) + '\n');
    return;
  }

  const shown = results.slice(0, options.top);
  process.stdout.write(`${results.length} file(s) with layout risk signals; showing ${shown.length}.\n\n`);
  shown.forEach((result) => {
    process.stdout.write(`${String(result.score).padStart(3)}  ${result.file}\n`);
    result.findings
      .sort((a, b) => b.weight - a.weight || a.line - b.line)
      .slice(0, 6)
      .forEach((finding) => {
        process.stdout.write(`       :${finding.line}  ${finding.rule} — ${finding.message}\n`);
      });
    if (result.findings.length > 6) {
      process.stdout.write(`       … ${result.findings.length - 6} more\n`);
    }
  });
}

if (require.main === module) {
  main();
}

module.exports = { RULES, scanFiles, scanSource };
