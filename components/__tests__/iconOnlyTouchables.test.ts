import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import * as ts from 'typescript';

/**
 * A button that draws only an icon says nothing to a screen reader unless it carries a label.
 * `IconButton` already makes `accessibilityLabel` a required prop; this catches the hand-rolled
 * `Pressable`/`TouchableOpacity` that wraps a lone icon. It reads the JSX rather than grepping, so
 * a label on a following line or a `Text` further down the tree is understood.
 */
const root = join(__dirname, '..', '..');
const TOUCHABLES = new Set(['Pressable', 'TouchableOpacity', 'TouchableHighlight']);
const LABEL_PROPS = ['accessibilityLabel', 'aria-label', 'accessibilityLabelledBy'];
/** Components that draw their own visible text, so a touchable around them is not icon-only. */
const TEXT_COMPONENTS = new Set(['Button', 'TextButton', 'ListRow', 'Chip']);

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const rel = relative(root, full).replace(/\\/g, '/');
    if (
      name === '__tests__' ||
      name === 'node_modules' ||
      rel === 'app/app/test' ||
      rel === 'app/(website)' ||
      rel === 'components/website'
    ) {
      continue;
    }

    if (statSync(full).isDirectory()) {
      sourceFiles(full, out);
    } else if (/\.tsx$/.test(name)) {
      out.push(full);
    }
  }

  return out;
}

function iconOnlyTouchables(file: string, source: string): number[] {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const icons = new Set<string>();
  sf.forEachChild((node) => {
    if (!ts.isImportDeclaration(node) || !node.importClause) {
      return;
    }

    const module = (node.moduleSpecifier as ts.StringLiteral).text;
    const bindings = node.importClause.namedBindings;
    if (module === 'lucide-react-native' && bindings && ts.isNamedImports(bindings)) {
      bindings.elements.forEach((element) => icons.add(element.name.text));
    }

    if (/vector-icons/.test(module) && node.importClause.name) {
      icons.add(node.importClause.name.text);
    }
  });

  const tagOf = (element: ts.JsxOpeningLikeElement) => element.tagName.getText(sf);
  const lines: number[] = [];

  const visit = (node: ts.Node) => {
    if (ts.isJsxElement(node) && TOUCHABLES.has(tagOf(node.openingElement))) {
      const attrs = node.openingElement.attributes.properties;
      const spreads = attrs.some((attr) => ts.isJsxSpreadAttribute(attr));
      const labelled = attrs.some(
        (attr) => ts.isJsxAttribute(attr) && LABEL_PROPS.includes(attr.name.getText(sf))
      );
      // A render-prop child is too dynamic to judge.
      const dynamic = node.children.some(
        (child) =>
          ts.isJsxExpression(child) &&
          child.expression &&
          (ts.isArrowFunction(child.expression) || ts.isFunctionExpression(child.expression))
      );

      if (!labelled && !spreads && !dynamic) {
        let hasText = false;
        let hasIcon = false;
        const inspect = (child: ts.Node) => {
          if (ts.isJsxText(child) && child.getText(sf).trim()) {
            hasText = true;
          }

          if (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child)) {
            const name = tagOf(ts.isJsxElement(child) ? child.openingElement : child);
            if (/Text$|Label$|Badge$/.test(name) && name !== 'TextInput') {
              hasText = true;
            }

            if (TEXT_COMPONENTS.has(name)) {
              hasText = true;
            }

            if (icons.has(name) || /Icon$/.test(name)) {
              hasIcon = true;
            }
          }

          if (
            ts.isJsxExpression(child) &&
            child.expression &&
            /\bt\(/.test(child.expression.getText(sf))
          ) {
            hasText = true;
          }

          child.forEachChild(inspect);
        };
        node.children.forEach(inspect);

        if (hasIcon && !hasText) {
          lines.push(sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1);
        }
      }
    }

    node.forEachChild(visit);
  };
  visit(sf);

  return lines;
}

describe('icon-only touchables', () => {
  it('every touchable that draws only an icon carries an accessibilityLabel', () => {
    const offenders: string[] = [];
    for (const file of [
      ...sourceFiles(join(root, 'app')),
      ...sourceFiles(join(root, 'components')),
    ]) {
      for (const line of iconOnlyTouchables(file, readFileSync(file, 'utf8'))) {
        offenders.push(`${relative(root, file).replace(/\\/g, '/')}:${line}`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it('flags a lone icon and accepts a labelled one or one beside text', () => {
    const header = "import { X } from 'lucide-react-native';\n";
    const bare = `${header}const a = <Pressable onPress={f}><X /></Pressable>;`;
    const labelled = `${header}const a = <Pressable accessibilityLabel="Close" onPress={f}><X /></Pressable>;`;
    const withText = `${header}const a = <Pressable onPress={f}><X /><Text>Close</Text></Pressable>;`;

    expect(iconOnlyTouchables('a.tsx', bare)).toEqual([2]);
    expect(iconOnlyTouchables('a.tsx', labelled)).toEqual([]);
    expect(iconOnlyTouchables('a.tsx', withText)).toEqual([]);
  });
});
