import { useCallback, useState } from 'react';

import { findAlternateBarcodeSource } from '@/hooks/useFoodProductDetails';
import {
  type BarcodeSearchProduct,
  inferBarcodeNutritionSource,
  type ProductDetailsQueryData,
} from '@/utils/externalFoodProduct';
import { handleError } from '@/utils/handleError';

type UseAlternateBarcodeSourceParams = {
  barcode: string | null | undefined;
  /** The primary product-details query result (used to infer the source already in use). */
  productDetails: ProductDetailsQueryData | null | undefined;
  /** Preloaded search product, when the modal was opened from search instead of a barcode lookup. */
  productFromSearch?: BarcodeSearchProduct | null;
  /** Context label passed to {@link handleError} on a failed cross-source fetch. */
  errorContext: string;
  /** Invoked when no other provider yields usable nutrition (e.g. to enable manual editing). */
  onExhausted?: () => void;
};

/**
 * Owns the "try another source" state cluster (`refetchedProductDetails`, in-flight flag, and the
 * exhausted-all-sources flag) and the cross-provider lookup. Shared by the food-details modals so
 * the alternate-source behavior lives in one place instead of being re-wired through setter bags.
 *
 * When the lookup exhausts every other provider, `alternateSourceLookupFailed` flips to `true`;
 * callers typically watch that to enable manual editing.
 */
export function useAlternateBarcodeSource({
  barcode,
  productDetails,
  productFromSearch = null,
  errorContext,
  onExhausted,
}: UseAlternateBarcodeSourceParams) {
  const [refetchedProductDetails, setRefetchedProductDetails] =
    useState<ProductDetailsQueryData | null>(null);
  const [isRefetchingSource, setIsRefetchingSource] = useState(false);
  const [alternateSourceLookupFailed, setAlternateSourceLookupFailed] = useState(false);

  const tryAnotherSource = useCallback(async () => {
    if (!barcode) {
      return;
    }

    setIsRefetchingSource(true);
    const effectiveDetails = refetchedProductDetails ?? productDetails;
    const currentSource = inferBarcodeNutritionSource(effectiveDetails, productFromSearch);

    try {
      const found = await findAlternateBarcodeSource(barcode, currentSource);
      if (found) {
        setAlternateSourceLookupFailed(false);
        setRefetchedProductDetails(found);
      } else {
        setAlternateSourceLookupFailed(true);
        onExhausted?.();
      }
    } catch (error) {
      handleError(error, errorContext);
      setAlternateSourceLookupFailed(true);
      onExhausted?.();
    } finally {
      setIsRefetchingSource(false);
    }
  }, [
    barcode,
    productDetails,
    productFromSearch,
    refetchedProductDetails,
    errorContext,
    onExhausted,
  ]);

  const reset = useCallback(() => {
    setRefetchedProductDetails(null);
    setIsRefetchingSource(false);
    setAlternateSourceLookupFailed(false);
  }, []);

  return {
    refetchedProductDetails,
    isRefetchingSource,
    alternateSourceLookupFailed,
    tryAnotherSource,
    reset,
  };
}
