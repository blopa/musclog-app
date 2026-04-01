import i18n from '../lang/lang';

export interface ProductNameResult {
  name: string;
  found: boolean;
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function str(val: unknown): string | undefined {
  if (typeof val === 'string' && val.trim()) {
    return val.trim();
  }

  return undefined;
}

/** Extract a name from an Open Food Facts product object. */
function extractOFFName(p: Record<string, unknown>): string | undefined {
  // 1. product_name (intentionally skip p.description — that belongs to USDA)
  let name = str(p.product_name);

  // 1a. product_name_<lang> (when lang field is present)
  if (!name && p.lang != null) {
    name = str(p[`product_name_${p.lang}`]);
  }

  // 1b. Scan all product_name_<lang> keys (V3 API sometimes omits bare product_name)
  if (!name) {
    for (const key of Object.keys(p)) {
      if (key.startsWith('product_name_') && key !== 'product_name') {
        name = str(p[key]);
        if (name) {
          break;
        }
      }
    }
  }

  // 2. abbreviated_product_name
  if (!name) {
    name = str(p.abbreviated_product_name);
  }

  // 3. generic_name
  if (!name) {
    name = str(p.generic_name);
  }

  if (!name && p.lang != null) {
    name = str(p[`generic_name_${p.lang}`]);
  }

  if (!name) {
    for (const key of Object.keys(p)) {
      if (key.startsWith('generic_name_') && key !== 'generic_name') {
        name = str(p[key]);
        if (name) {
          break;
        }
      }
    }
  }

  // 4. Ultimate fallback: brand (+ first category)
  if (!name) {
    const brand = str(p.brands);
    if (brand) {
      const firstCategory = str((p.categories as string | undefined)?.split(',')[0]);
      name = firstCategory ? `${brand} (${firstCategory})` : brand;
    }
  }

  return name;
}

/** Extract a name from a raw USDA FDC product object. */
function extractUSDAName(p: Record<string, unknown>): string | undefined {
  return str(p.description);
}

/**
 * Extract a name from a Musclog API product, local Food DB record,
 * or any simple `{ name: string }` shaped object.
 */
function extractMusclogName(p: Record<string, unknown>): string | undefined {
  return str(p.name);
}

function extractBySource(source: string, product: Record<string, unknown>): string | undefined {
  if (source === 'usda' || source === 'foundation') {
    return extractUSDAName(product);
  }

  if (source === 'openfood') {
    return extractOFFName(product);
  }

  // 'musclog' | 'local' | 'user' | 'ai' | unknown → all use a .name field
  return extractMusclogName(product) ?? extractOFFName(product);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Unified product name resolver.
 *
 * Accepts any of:
 *   - `SuccessFoodProductState`  { status: 'success', source?, product: {...} }
 *   - Raw OFF API response       { status: 'success', product: {...} }
 *   - OFF envelope               { product: {...} } or { products: [...] }
 *   - Raw OFF product object     (has product_name / code / _id / nutriments)
 *   - Raw USDA product object    (has fdcId + description)
 *   - Musclog / local Food model (has .name)
 *   - UnifiedFoodResult          (has .name already mapped)
 *
 * Returns `{ name, found: true }` when a real name is found,
 * or `{ name: i18n.t('food.unknownFood'), found: false }` as fallback.
 */
export function getProductName(data: unknown): ProductNameResult {
  const unknownResult = (): ProductNameResult => ({
    name: i18n.t('food.unknownFood'),
    found: false,
  });

  const foundResult = (name: string): ProductNameResult => ({ name, found: true });

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return unknownResult();
  }

  const d = data as Record<string, unknown>;

  // ── Step A: SuccessFoodProductState / raw OFF API response ──────────────────
  // Both have { status: 'success', product: { ... } }. The former also carries
  // a `.source` field that tells us which extractor to use.
  if (
    d.status === 'success' &&
    d.product &&
    typeof d.product === 'object' &&
    !Array.isArray(d.product) &&
    Object.keys(d.product as object).length > 0
  ) {
    const source = typeof d.source === 'string' ? d.source : 'openfood';
    const name = extractBySource(source, d.product as Record<string, unknown>);
    return name ? foundResult(name) : unknownResult();
  }

  // ── Step B: Other envelope wrappers ─────────────────────────────────────────
  // { product: { ... } } without status=success, or { products: [...] }
  const rawNested = d.product;
  if (
    rawNested &&
    typeof rawNested === 'object' &&
    !Array.isArray(rawNested) &&
    Object.keys(rawNested as object).length > 0
  ) {
    // Treat inner product as OFF (only OFF uses this wrapper outside Step A)
    const name = extractOFFName(rawNested as Record<string, unknown>);
    return name ? foundResult(name) : unknownResult();
  }
  if (Array.isArray(d.products) && d.products.length > 0) {
    return getProductName(d.products[0]);
  }

  // ── Step C: Payload IS the product — detect source from shape ───────────────

  // Already-mapped data (UnifiedFoodResult, Musclog raw, local Food model) has .name
  const directName = str(d.name);
  if (directName) {
    return foundResult(directName);
  }

  // USDA raw product: has fdcId
  if (d.fdcId != null) {
    const name = extractUSDAName(d);
    return name ? foundResult(name) : unknownResult();
  }

  // OFF raw product: fingerprint by OFF-specific fields
  if (
    d.product_name !== undefined ||
    d.code !== undefined ||
    d._id !== undefined ||
    d.nutriments !== undefined
  ) {
    const name = extractOFFName(d);
    return name ? foundResult(name) : unknownResult();
  }

  // Last resort: try OFF extraction
  const name = extractOFFName(d);
  return name ? foundResult(name) : unknownResult();
}
