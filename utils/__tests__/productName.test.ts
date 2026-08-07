import i18n from '@/lang/lang';
import { getProductName } from '@/utils/productName';

const UNKNOWN = i18n.t('food.unknownFood');

const expectUnknown = (input: unknown) =>
  expect(getProductName(input)).toEqual({ name: UNKNOWN, found: false });

describe('getProductName', () => {
  describe('Open Food Facts products', () => {
    it('prefers product_name', () => {
      expect(
        getProductName({ code: '1', product_name: 'Granola', generic_name: 'Cereal' })
      ).toEqual({ name: 'Granola', found: true });
    });

    it('uses the product_name_<lang> field named by the product lang', () => {
      expect(getProductName({ code: '1', lang: 'nl', product_name_nl: 'Volkorenbrood' }).name).toBe(
        'Volkorenbrood'
      );
    });

    it('scans any product_name_<lang> key, since the V3 API sometimes omits the bare one', () => {
      expect(getProductName({ code: '1', product_name_fr: 'Pain complet' }).name).toBe(
        'Pain complet'
      );
    });

    it('falls back through abbreviated_product_name and generic_name', () => {
      expect(getProductName({ code: '1', abbreviated_product_name: 'Choc bar' }).name).toBe(
        'Choc bar'
      );
      expect(getProductName({ code: '1', generic_name: 'Chocolate' }).name).toBe('Chocolate');
      expect(getProductName({ code: '1', lang: 'es', generic_name_es: 'Chocolate' }).name).toBe(
        'Chocolate'
      );
    });

    it('falls back last to the brand, qualified by the first category', () => {
      expect(getProductName({ code: '1', brands: 'Acme', categories: 'Snacks,Bars' }).name).toBe(
        'Acme (Snacks)'
      );
      expect(getProductName({ code: '1', brands: 'Acme' }).name).toBe('Acme');
    });

    it('ignores blank and non-string names', () => {
      expect(getProductName({ code: '1', product_name: '   ', generic_name: 'Cereal' }).name).toBe(
        'Cereal'
      );
      expectUnknown({ code: '1', product_name: 42 });
    });

    it('trims surrounding whitespace off the resolved name', () => {
      expect(getProductName({ code: '1', product_name: '  Granola  ' }).name).toBe('Granola');
    });

    it('never reads USDA’s description field for an OFF product', () => {
      // `description` belongs to USDA; treating it as an OFF name would mislabel products.
      expectUnknown({ code: '1', description: 'Not a name' });
    });
  });

  describe('source-tagged product states', () => {
    it('uses the USDA extractor when the state says usda', () => {
      expect(
        getProductName({
          status: 'success',
          source: 'usda',
          product: { fdcId: 1, description: 'Oats, rolled' },
        }).name
      ).toBe('Oats, rolled');
    });

    it('uses the .name field for musclog / local / ai states', () => {
      expect(
        getProductName({ status: 'success', source: 'musclog', product: { name: 'Kaas' } }).name
      ).toBe('Kaas');
    });

    it('defaults an untagged success state to the OFF extractor', () => {
      expect(getProductName({ status: 'success', product: { product_name: 'Bar' } }).name).toBe(
        'Bar'
      );
    });

    it('reports not-found when a success state carries a nameless product', () => {
      expectUnknown({ status: 'success', product: { code: '1' } });
    });
  });

  describe('envelope shapes', () => {
    it('unwraps { product: {...} } without a success status', () => {
      expect(getProductName({ product: { product_name: 'Bar' } }).name).toBe('Bar');
    });

    it('unwraps { products: [...] } by taking the first entry', () => {
      expect(
        getProductName({ products: [{ product_name: 'First' }, { product_name: 'Second' }] }).name
      ).toBe('First');
    });

    it('ignores an empty product envelope and empty product arrays', () => {
      expectUnknown({ product: {} });
      expectUnknown({ products: [] });
    });
  });

  describe('already-mapped and raw payloads', () => {
    it('uses .name directly for a UnifiedFoodResult / local Food record', () => {
      expect(getProductName({ id: '1', name: 'My custom food', source: 'user' }).name).toBe(
        'My custom food'
      );
    });

    it('uses description for a raw USDA payload detected by fdcId', () => {
      expect(getProductName({ fdcId: 123, description: 'Oats' }).name).toBe('Oats');
      expectUnknown({ fdcId: 123 });
    });
  });

  describe('fallback', () => {
    it('returns the localized unknown label with found:false for unusable input', () => {
      expectUnknown(null);
      expectUnknown(undefined);
      expectUnknown('a string');
      expectUnknown([{ product_name: 'Bar' }]);
      expectUnknown({});
    });
  });
});
