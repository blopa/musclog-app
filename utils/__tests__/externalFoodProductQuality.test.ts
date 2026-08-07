import {
  getExternalProductDisplayQuality,
  getProductBarcodeFromSearchProduct,
  inferBarcodeNutritionSource,
  parseServingSizeFromProduct,
  resolveExternalFoodSource,
} from '@/utils/externalFoodProduct';

/** A minimal OFF barcode-detail state: no `source` field, recognised by its product shape. */
const offDetails = {
  status: 'success',
  product: {
    product_name: 'Chocolate bar',
    nutriscore_grade: 'E',
    ecoscore_grade: 'D',
    nova_group: 4,
    ingredients_analysis_tags: ['en:vegetarian'],
    nutriments: { 'energy-kcal_100g': 540 },
  },
} as any;

const musclogDetails = {
  status: 'success',
  source: 'musclog',
  product: { name: 'Volkorenbrood', nutriscore: 'A', novagroup: '2', organic: true },
} as any;

const usdaDetails = {
  status: 'success',
  source: 'usda',
  product: { fdcId: 12345, description: 'Rolled oats' },
} as any;

describe('externalFoodProduct — source resolution and quality dispatch', () => {
  describe('inferBarcodeNutritionSource', () => {
    it('honours an explicit source on the details state', () => {
      expect(inferBarcodeNutritionSource(usdaDetails, null)).toBe('usda');
      expect(inferBarcodeNutritionSource(musclogDetails, null)).toBe('musclog');
      expect(
        inferBarcodeNutritionSource({ status: 'success', source: 'openfood' } as any, null)
      ).toBe('openfood');
    });

    it('falls back to the search product source when the details state carries none', () => {
      expect(inferBarcodeNutritionSource(null, { source: 'usda' })).toBe('usda');
      expect(inferBarcodeNutritionSource(null, { source: 'musclog' })).toBe('musclog');
      expect(inferBarcodeNutritionSource({ status: 'failure' } as any, { source: 'openfood' })).toBe(
        'openfood'
      );
    });

    it('recognises an OFF detail state by its product shape when nothing is tagged', () => {
      expect(inferBarcodeNutritionSource(offDetails, null)).toBe('openfood');
    });

    it('returns null when the source genuinely cannot be determined', () => {
      // Deliberately null rather than a guess: the barcode screen shows "no nutrition data"
      // instead of silently reading the blob with the wrong provider's field names.
      expect(inferBarcodeNutritionSource(null, null)).toBeNull();
      expect(inferBarcodeNutritionSource({ status: 'failure', code: '123' }, null)).toBeNull();
      expect(
        inferBarcodeNutritionSource({ status: 'error', error: { message: 'boom' } }, {})
      ).toBeNull();
    });

    it('ignores an unrecognised source tag instead of trusting it', () => {
      expect(
        inferBarcodeNutritionSource({ status: 'success', source: 'fatsecret' } as any, null)
      ).toBeNull();
    });
  });

  describe('resolveExternalFoodSource', () => {
    it('reuses the inferred source whenever there is one', () => {
      expect(resolveExternalFoodSource(usdaDetails, null)).toBe('usda');
      expect(resolveExternalFoodSource(musclogDetails, null)).toBe('musclog');
      expect(resolveExternalFoodSource(offDetails, null)).toBe('openfood');
    });

    it('falls back to a USDA product shape (fdcId) when nothing is tagged', () => {
      expect(resolveExternalFoodSource(null, { fdcId: 999 })).toBe('usda');
      expect(
        resolveExternalFoodSource({ status: 'success', product: { fdcId: 999 } } as any, null)
      ).toBe('usda');
    });

    it('falls back to a source tag carried on the nested product', () => {
      // Reachable only when the state itself is not a successful OFF product state — otherwise the
      // OFF guard inside inferBarcodeNutritionSource already claims it.
      expect(
        resolveExternalFoodSource(
          { status: 'failure', product: { source: 'musclog', name: 'Kaas' } } as any,
          null
        )
      ).toBe('musclog');
    });

    it('never returns null — the save path must write the product under some source', () => {
      // Unlike inferBarcodeNutritionSource, this runs where a decision is mandatory; OFF is the
      // documented default.
      expect(resolveExternalFoodSource(null, null)).toBe('openfood');
      expect(resolveExternalFoodSource({ status: 'failure' }, {})).toBe('openfood');
    });
  });

  describe('getExternalProductDisplayQuality', () => {
    it('reads Open Food Facts badges through the OFF normaliser', () => {
      expect(getExternalProductDisplayQuality('openfood', offDetails)).toEqual({
        nutriScore: 'e',
        ecoScore: 'd',
        novaGroup: 4,
        labels: { vegetarian: true },
      });
    });

    it('reads Musclog badges through the Musclog normaliser', () => {
      expect(getExternalProductDisplayQuality('musclog', musclogDetails)).toEqual({
        nutriScore: 'a',
        novaGroup: 2,
        labels: { organic: true },
      });
    });

    it('resolves USDA to undefined instead of sniffing another provider’s field names', () => {
      // The invariant from AGENTS.md: dispatch on the already-resolved source. Even if a USDA
      // payload happened to carry an OFF-shaped field, it must not be read as a badge.
      const contaminated = {
        status: 'success',
        source: 'usda',
        product: { fdcId: 1, description: 'X', nutriscore_grade: 'a', nova_group: 1 },
      } as any;

      expect(getExternalProductDisplayQuality('usda', contaminated)).toBeUndefined();
    });

    it('returns undefined when the source is unknown, even for a readable OFF product', () => {
      expect(getExternalProductDisplayQuality(null, offDetails)).toBeUndefined();
    });

    it('returns undefined when the details state has no product to read', () => {
      expect(getExternalProductDisplayQuality('openfood', null)).toBeUndefined();
      expect(getExternalProductDisplayQuality('openfood', { status: 'failure' })).toBeUndefined();
      expect(
        getExternalProductDisplayQuality('openfood', { status: 'success', product: null } as any)
      ).toBeUndefined();
    });

    it('refuses an OFF payload that is not a successful food product state', () => {
      const nonFood = {
        status: 'success',
        product: { product_type: 'beauty', product_name: 'Face cream', nutriscore_grade: 'a' },
      } as any;

      expect(getExternalProductDisplayQuality('openfood', nonFood)).toBeUndefined();
    });

    it('composes with the inference step so a call site never re-derives the source', () => {
      const source = inferBarcodeNutritionSource(musclogDetails, null);
      expect(getExternalProductDisplayQuality(source, musclogDetails)).toMatchObject({
        nutriScore: 'a',
      });
    });
  });

  describe('getProductBarcodeFromSearchProduct', () => {
    it('prefers the OFF code and falls back to the USDA gtinUpc', () => {
      expect(getProductBarcodeFromSearchProduct({ code: '111', gtinUpc: '222' })).toBe('111');
      expect(getProductBarcodeFromSearchProduct({ gtinUpc: '222' })).toBe('222');
    });

    it('returns an empty string for a missing or non-object product', () => {
      expect(getProductBarcodeFromSearchProduct(null)).toBe('');
      expect(getProductBarcodeFromSearchProduct('123')).toBe('');
      expect(getProductBarcodeFromSearchProduct({})).toBe('');
    });
  });

  describe('parseServingSizeFromProduct', () => {
    it('prefers the grams inside parentheses over a leading non-gram amount', () => {
      expect(parseServingSizeFromProduct({ serving_size: '1 bar (45 g)' })).toBe(45);
    });

    it('falls back to the first number in the string', () => {
      expect(parseServingSizeFromProduct({ serving_size: '30g' })).toBe(30);
    });

    it('builds the string from the USDA servingSize fields when serving_size is absent', () => {
      expect(parseServingSizeFromProduct({ servingSize: 55, servingSizeUnit: 'g' })).toBe(55);
    });

    it('returns undefined when there is no usable number', () => {
      expect(parseServingSizeFromProduct(null)).toBeUndefined();
      expect(parseServingSizeFromProduct({})).toBeUndefined();
      expect(parseServingSizeFromProduct({ serving_size: 'one portion' })).toBeUndefined();
      expect(parseServingSizeFromProduct({ serving_size: '0 g' })).toBeUndefined();
    });
  });
});
