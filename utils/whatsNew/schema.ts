import {
  isWhatsNewSettingValue,
  WHATS_NEW_ACTIONS,
  WHATS_NEW_CONDITIONS,
  WHATS_NEW_ICONS,
  WHATS_NEW_SETTING_CATALOG,
  WHATS_NEW_SETTINGS,
  type WhatsNewAction,
  type WhatsNewCondition,
  type WhatsNewIconName,
  type WhatsNewSetting,
} from './catalog';
import { compareVersions, parseVersion } from './version';

export type WhatsNewKey = `whatsNew.${string}`;
type Copy = { descriptionKey?: WhatsNewKey; icon?: WhatsNewIconName };
type BlockBase = { id: string; supersededIn?: string };
export type WhatsNewOption = Copy & { value: string; labelKey: WhatsNewKey };
export type WhatsNewFeature = Copy & {
  id: string;
  icon: WhatsNewIconName;
  labelKey: WhatsNewKey;
  action?: WhatsNewAction;
};
export type WhatsNewBlock = BlockBase &
  (
    | (Copy & { type: 'info'; titleKey: WhatsNewKey })
    | (Omit<Copy, 'icon'> & {
        type: 'choice';
        setting: WhatsNewSetting;
        titleKey: WhatsNewKey;
        options?: WhatsNewOption[];
      })
    | { type: 'featureList'; titleKey?: WhatsNewKey; items: WhatsNewFeature[] }
    | (Copy & { type: 'action'; action: WhatsNewAction; labelKey: WhatsNewKey })
  );
/** `requires` shows the page only to people for whom that condition holds. */
export type WhatsNewPage = BlockBase & { blocks: WhatsNewBlock[]; requires?: WhatsNewCondition };
export type WhatsNewRelease = { version: string; pages: WhatsNewPage[] };

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isKey = (value: unknown): value is WhatsNewKey =>
  typeof value === 'string' && /^whatsNew\.[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*$/.test(value);
const contains = (values: readonly string[], value: unknown) =>
  typeof value === 'string' && values.includes(value);

/** Fail closed at the smallest usable unit; retain valid siblings for older app builds. */
export function parseWhatsNewRelease(
  raw: unknown,
  fileName: string
): {
  release: WhatsNewRelease | null;
  issues: string[];
} {
  const issues: string[] = [];
  const issue = (path: string, reason: string) => {
    issues.push(`${path}: ${reason}`);
  };

  if (
    !isObject(raw) ||
    !parseVersion(raw.version) ||
    raw.version !== fileName.replace(/\.json$/, '')
  ) {
    return { release: null, issues: [`${fileName}: invalid or mismatched version`] };
  }

  const version = raw.version as string;
  const properties = (obj: Record<string, unknown>, allowed: string[], path: string) => {
    Object.keys(obj)
      .filter((key) => !allowed.includes(key))
      .forEach((key) => issue(path, `unknown property ${key}`));
  };

  const base = (obj: Record<string, unknown>, ids: Set<string>, path: string): boolean => {
    if (typeof obj.id !== 'string' || !obj.id.trim() || ids.has(obj.id)) {
      issue(path, 'invalid or duplicate id');
      return false;
    }

    ids.add(obj.id);
    if (
      obj.supersededIn !== undefined &&
      (!parseVersion(obj.supersededIn) || compareVersions(obj.supersededIn as string, version) <= 0)
    ) {
      issue(path, 'supersededIn must be a later release version');
      return false;
    }

    return true;
  };

  const copy = (obj: Record<string, unknown>, required: string[], path: string): boolean => {
    for (const key of ['titleKey', 'descriptionKey', 'labelKey']) {
      if ((required.includes(key) || obj[key] !== undefined) && !isKey(obj[key])) {
        issue(path, `invalid ${key}`);
        return false;
      }
    }

    if (obj.icon !== undefined && !contains(WHATS_NEW_ICONS, obj.icon)) {
      issue(path, 'unknown icon');
      return false;
    }

    return true;
  };

  const parseBlock = (value: unknown, ids: Set<string>, path: string): WhatsNewBlock | null => {
    if (!isObject(value)) {
      issue(path, 'invalid block');
      return null;
    }

    if (!base(value, ids, path)) {
      return null;
    }

    const common = ['id', 'type', 'supersededIn'];
    switch (value.type) {
      case 'info':
        properties(value, [...common, 'icon', 'titleKey', 'descriptionKey'], path);
        if (!copy(value, ['titleKey'], path)) {
          return null;
        }

        break;
      case 'choice': {
        properties(value, [...common, 'setting', 'titleKey', 'descriptionKey', 'options'], path);
        if (!copy(value, ['titleKey'], path)) {
          return null;
        }

        if (!contains(WHATS_NEW_SETTINGS, value.setting)) {
          issue(path, 'unknown setting');
          return null;
        }

        const setting = value.setting as WhatsNewSetting;
        if (WHATS_NEW_SETTING_CATALOG[setting].kind === 'enum') {
          if (!Array.isArray(value.options) || value.options.length < 2) {
            issue(path, 'at least two options required');
            return null;
          }

          const seen = new Set<unknown>();
          for (const option of value.options) {
            if (!isObject(option)) {
              issue(path, 'invalid option');
              return null;
            }

            properties(option, ['value', 'labelKey', 'descriptionKey', 'icon'], path);
            if (!copy(option, ['labelKey'], path)) {
              return null;
            }

            if (!isWhatsNewSettingValue(setting, option.value) || seen.has(option.value)) {
              issue(path, 'invalid or duplicate option value');
              return null;
            }

            seen.add(option.value);
          }
        } else if (value.options !== undefined) {
          issue(path, 'options not allowed');
          return null;
        }

        break;
      }

      case 'featureList': {
        properties(value, [...common, 'titleKey', 'items'], path);
        if (!copy(value, [], path)) {
          return null;
        }

        if (!Array.isArray(value.items)) {
          issue(path, 'invalid items');
          return null;
        }

        const itemIds = new Set<string>();
        const items = value.items.filter((item, index) => {
          const itemPath = `${path}.items[${index}]`;
          if (!isObject(item)) {
            issue(itemPath, 'invalid item');
            return false;
          }

          properties(item, ['id', 'icon', 'labelKey', 'descriptionKey', 'action'], itemPath);
          if (!base(item, itemIds, itemPath) || !copy(item, ['labelKey'], itemPath)) {
            return false;
          }

          if (!contains(WHATS_NEW_ICONS, item.icon)) {
            issue(itemPath, 'missing or unknown icon');
            return false;
          }

          if (item.action !== undefined && !contains(WHATS_NEW_ACTIONS, item.action)) {
            issue(itemPath, 'unknown action');
            return false;
          }

          return true;
        });
        if (!items.length) {
          issue(path, 'empty feature list');
          return null;
        }

        return { ...value, items } as WhatsNewBlock;
      }

      case 'action':
        properties(value, [...common, 'action', 'icon', 'labelKey', 'descriptionKey'], path);
        if (!copy(value, ['labelKey'], path)) {
          return null;
        }

        if (!contains(WHATS_NEW_ACTIONS, value.action)) {
          issue(path, 'unknown action');
          return null;
        }

        break;
      default:
        issue(path, 'unknown block type');
        return null;
    }

    return value as WhatsNewBlock;
  };

  properties(raw, ['version', 'pages'], fileName);
  const pages: WhatsNewPage[] = [];
  const pageIds = new Set<string>();
  if (!Array.isArray(raw.pages)) {
    issue(fileName, 'invalid pages');
  } else {
    raw.pages.forEach((page, index) => {
      const path = `${fileName}.pages[${index}]`;
      if (!isObject(page)) {
        issue(path, 'invalid page');
        return;
      }

      properties(page, ['id', 'blocks', 'supersededIn', 'requires'], path);
      if (!base(page, pageIds, path)) {
        return;
      }

      if (page.requires !== undefined && !contains(WHATS_NEW_CONDITIONS, page.requires)) {
        issue(path, 'unknown requires condition');
        return;
      }

      if (!Array.isArray(page.blocks)) {
        issue(path, 'invalid blocks');
        return;
      }

      const ids = new Set<string>();
      const blocks = page.blocks
        .map((block, i) => parseBlock(block, ids, `${path}.blocks[${i}]`))
        .filter((block): block is WhatsNewBlock => block !== null);
      if (!blocks.length) {
        issue(path, 'empty page');
        return;
      }

      pages.push({
        id: page.id as string,
        blocks,
        ...(page.supersededIn ? { supersededIn: page.supersededIn as string } : {}),
        ...(page.requires ? { requires: page.requires as WhatsNewCondition } : {}),
      });
    });
  }

  if (!pages.length) {
    issue(fileName, 'empty release');
  }

  return { release: { version, pages }, issues };
}
