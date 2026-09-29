import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import ts from 'typescript';

/**
 * A module with `.web.ts` / `.ios.ts` / `.android.ts` siblings is one module as far as
 * every importer is concerned: Metro picks the variant, and the import site names a
 * symbol without knowing which file it will land in. So a symbol the base module
 * exports but a sibling does not is not a type error anywhere — it is a
 * `TypeError: x is not a function` on exactly one platform, at runtime.
 *
 * v2.12.2 shipped two of these: `syncDailySteps` existed only in
 * `services/healthConnectFitness.ts`, so the home screen crashed on web and iOS the
 * moment the app came back to the foreground, and `sendOnDeviceStructured` was
 * missing from `utils/onDeviceAi.web.ts`.
 *
 * The invariant is one-directional: a sibling may export MORE than the base (a
 * web-only helper such as `restoreReloadTarget` is legitimate), never less.
 */

const ROOT = resolve(__dirname, '../..');

// Logic layers, where modules are imported by shared cross-platform code. Route and
// component files are deliberately out of scope: their contract is the default export,
// and their named exports are file-local helpers.
const SCANNED_DIRS = ['constants', 'database', 'hooks', 'services', 'utils'];

const PLATFORM_SUFFIXES = ['web', 'ios', 'android', 'native'] as const;

/**
 * Exports that are deliberately absent from a sibling, with the reason. Listing one
 * here is a decision; omitting it fails the build, so a new asymmetry cannot be
 * introduced silently.
 */
const ALLOWED_OMISSIONS: Record<string, Record<string, string>> = {
  'database/preMigrationBackup.ts': {
    registerPreMigrationDbBackup:
      'Native-only: registers the expo-sqlite VACUUM INTO snapshot taken by preMigrationCapture, which database/adapter.web.ts never imports.',
    writePortableBackup:
      'Native-only: writes the snapshot to the filesystem; web recovery points live in IndexedDB via webBackupPayloadStore.',
  },
};

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '__tests__' || entry === '__mocks__') {
      continue;
    }
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else if (/\.tsx?$/.test(entry) && !entry.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Named VALUE exports only. Types are erased at runtime and TypeScript checks the
 * base module regardless of which variant Metro bundles, so a type present on one
 * platform and not another cannot produce the failure this guards.
 */
function namedValueExportsOf(file: string): Set<string> {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true
  );
  const names = new Set<string>();

  const isExported = (node: ts.Node) =>
    ts.getCombinedModifierFlags(node as ts.Declaration).valueOf() &
    ts.ModifierFlags.Export.valueOf();
  const isDefault = (node: ts.Node) =>
    ts.getCombinedModifierFlags(node as ts.Declaration).valueOf() &
    ts.ModifierFlags.Default.valueOf();

  for (const statement of source.statements) {
    if (ts.isExportDeclaration(statement)) {
      if (
        !statement.isTypeOnly &&
        statement.exportClause &&
        ts.isNamedExports(statement.exportClause)
      ) {
        for (const element of statement.exportClause.elements) {
          if (!element.isTypeOnly) {
            names.add(element.name.text);
          }
        }
      }
      continue;
    }

    if (!isExported(statement) || isDefault(statement)) {
      continue;
    }

    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) {
          names.add(declaration.name.text);
        }
      }
    } else if (
      (ts.isFunctionDeclaration(statement) ||
        ts.isClassDeclaration(statement) ||
        ts.isEnumDeclaration(statement)) &&
      statement.name
    ) {
      names.add(statement.name.text);
    }
  }

  return names;
}

function platformFamilies(): { base: string; siblings: string[] }[] {
  const families: { base: string; siblings: string[] }[] = [];

  for (const dir of SCANNED_DIRS) {
    for (const file of walk(join(ROOT, dir))) {
      const match = file.match(/^(.*)\.(tsx?)$/);
      if (!match) {
        continue;
      }
      const [, stem, ext] = match;
      if (PLATFORM_SUFFIXES.some((suffix) => stem.endsWith(`.${suffix}`))) {
        continue;
      }

      const siblings = PLATFORM_SUFFIXES.map((suffix) => `${stem}.${suffix}.${ext}`).filter(
        (candidate) => {
          try {
            return statSync(candidate).isFile();
          } catch {
            return false;
          }
        }
      );

      if (siblings.length > 0) {
        families.push({ base: file, siblings });
      }
    }
  }

  return families;
}

describe('platform module parity', () => {
  const families = platformFamilies();

  it('finds the platform-variant modules it is meant to guard', () => {
    expect(families.length).toBeGreaterThan(5);
    expect(families.map(({ base }) => base)).toContain(
      join(ROOT, 'services/healthConnectFitness.ts')
    );
  });

  it.each(families.map(({ base, siblings }) => [base.slice(ROOT.length + 1), base, siblings]))(
    '%s exports the same surface on every platform',
    (_label, base: string, siblings: string[]) => {
      const relativeBase = base.slice(ROOT.length + 1);
      const baseExports = namedValueExportsOf(base);
      const allowed = ALLOWED_OMISSIONS[relativeBase] ?? {};

      for (const sibling of siblings) {
        const siblingExports = namedValueExportsOf(sibling);
        const missing = [...baseExports].filter(
          (name) => !siblingExports.has(name) && !(name in allowed)
        );

        expect({ sibling: sibling.slice(ROOT.length + 1), missing }).toEqual({
          sibling: sibling.slice(ROOT.length + 1),
          missing: [],
        });
      }
    }
  );
});
