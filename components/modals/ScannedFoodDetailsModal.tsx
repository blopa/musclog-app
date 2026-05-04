import { PlusCircle, ScanLine } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, View } from 'react-native';

import { BottomPopUp } from '@/components/BottomPopUp';
import { FoodInfoCard } from '@/components/cards/FoodInfoCard';
import { ServingSizeSelector } from '@/components/ServingSizeSelector';
import { Button } from '@/components/theme/Button';
import { FoodService } from '@/database/services';
import { useFoodProductDetails } from '@/hooks/useFoodProductDetails';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { isSuccessFoodDetailProductState } from '@/types/guards/openFoodFacts';
import type { SearchResultProduct } from '@/types/openFoodFacts';
import { handleError } from '@/utils/handleError';
import {
  getNutrimentsWithFallback,
  getNutrimentValue,
  getProductName,
  mapOpenFoodFactsProduct,
} from '@/utils/openFoodFactsMapper';
import { mapUSDAFoodToUnified } from '@/utils/usdaMapper';

type ScannedFoodDetailsModalProps = {
  visible: boolean;
  onClose: () => void;
  barcode: string;
  onAddFood?: (food: { food: any; amount: number }) => void;
};

export function ScannedFoodDetailsModal({
  visible,
  onClose,
  barcode,
  onAddFood,
}: ScannedFoodDetailsModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { intuitiveEatingMode } = useSettings();
  const [amount, setAmount] = useState(100);

  const { data: productData, isLoading, error } = useFoodProductDetails(barcode);

  const isScannedProductSuccess =
    isSuccessFoodDetailProductState(productData) ||
    (productData as any)?.source === 'usda' ||
    (productData as any)?.source === 'musclog';

  const handleAddFood = async () => {
    if (!isScannedProductSuccess) {
      return;
    }

    try {
      const existingFood = await FoodService.getFoodByBarcode(barcode);
      if (existingFood) {
        onAddFood?.({ food: existingFood, amount });
        onClose();
        return;
      }

      if ((productData as any)?.source === 'usda') {
        const usdaProduct = (productData as any).product;
        const mappedProduct = mapUSDAFoodToUnified(usdaProduct);
        const newFood = await FoodService.createFromUSDAProduct(
          usdaProduct,
          {
            calories: mappedProduct.calories || 0,
            protein: mappedProduct.protein || 0,
            carbs: mappedProduct.carbs || 0,
            fat: mappedProduct.fat || 0,
            fiber: mappedProduct.fiber || 0,
          },
          null,
          barcode
        );

        onAddFood?.({ food: newFood, amount });
        onClose();
        return;
      }

      if ((productData as any)?.source === 'musclog') {
        const musclogProduct = (productData as any).product;
        const newFood = await FoodService.createFromMusclogProduct(
          musclogProduct,
          {
            calories: Number(musclogProduct.calories || 0),
            protein: Number(musclogProduct.protein || 0),
            carbs: Number(musclogProduct.carbs || 0),
            fat: Number(musclogProduct.fat || 0),
            fiber: Number(musclogProduct.fiber || 0),
          },
          barcode
        );

        onAddFood?.({ food: newFood, amount });
        onClose();
        return;
      }

      if (isSuccessFoodDetailProductState(productData)) {
        const offProduct = productData.product as SearchResultProduct;
        const mappedProduct = mapOpenFoodFactsProduct(offProduct);
        const newFood = await FoodService.createFromV3Product(
          offProduct as any,
          {
            calories: mappedProduct.calories || 0,
            protein: mappedProduct.protein || 0,
            carbs: mappedProduct.carbs || 0,
            fat: mappedProduct.fat || 0,
            fiber: mappedProduct.fiber || 0,
          },
          null,
          barcode
        );

        onAddFood?.({ food: newFood, amount });
        onClose();
      }
    } catch (error) {
      handleError(error, 'ScannedFoodDetailsModal.handleAddFood', {
        showSnackbar: false,
      });
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <View className="flex-1 items-center justify-center py-8">
          <ActivityIndicator size="large" color={theme.colors.accent.primary} />
          <Text
            style={{
              marginTop: theme.spacing.padding.md,
              fontSize: theme.typography.fontSize.sm,
              color: theme.colors.text.tertiary,
            }}
          >
            {t('common.loading')}
          </Text>
        </View>
      );
    }

    if (error || !isScannedProductSuccess) {
      return (
        <View className="flex-1 items-center justify-center py-8">
          <Text
            style={{
              fontSize: theme.typography.fontSize.base,
              color: theme.colors.text.secondary,
              textAlign: 'center',
            }}
          >
            {t('food.addFoodItemToMeal.barcodeNotFound')}
          </Text>
        </View>
      );
    }

    let foodInfo;
    let brandText: string | undefined;

    if ((productData as any)?.source === 'usda') {
      const product = (productData as any).product;
      const mapped = mapUSDAFoodToUnified(product);
      foodInfo = {
        name: mapped.name,
        category: mapped.brand || product.dataType || t('food.generic'),
        calories: mapped.calories || 0,
        protein: mapped.protein || 0,
        carbs: mapped.carbs || 0,
        fat: mapped.fat || 0,
      };

      brandText = mapped.brand;
    } else if ((productData as any)?.source === 'musclog') {
      const product = (productData as any).product;
      foodInfo = {
        name: product.name || t('food.generic'),
        category: product.brand || t('food.generic'),
        calories: Number(product.calories || 0),
        protein: Number(product.protein || 0),
        carbs: Number(product.carbs || 0),
        fat: Number(product.fat || 0),
      };
      brandText = product.brand;
    } else {
      const product = (productData as any).product;
      const nutriments = getNutrimentsWithFallback(product);
      foodInfo = {
        name: getProductName(product),
        category: product.categories?.split(',')[0] || t('food.generic'),
        calories: getNutrimentValue(nutriments, 'energy-kcal') || 0,
        protein: getNutrimentValue(nutriments, 'proteins') || 0,
        carbs: getNutrimentValue(nutriments, 'carbohydrates') || 0,
        fat: getNutrimentValue(nutriments, 'fat') || 0,
      };

      brandText = product.brands;
    }

    return (
      <View>
        <FoodInfoCard food={foodInfo} intuitiveMode={intuitiveEatingMode} />
        <View pointerEvents="none" style={{ height: theme.spacing.padding.base }} />
        <ServingSizeSelector value={amount} onChange={setAmount} />

        {brandText ? (
          <Text
            style={{
              marginTop: theme.spacing.padding.md,
              fontSize: theme.typography.fontSize.sm,
              color: theme.colors.text.tertiary,
              textAlign: 'center',
            }}
          >
            {brandText}
          </Text>
        ) : null}
      </View>
    );
  };

  const renderFooter = () => {
    if (!isScannedProductSuccess) {
      return null;
    }

    return (
      <Button
        label={t('food.addFoodItemToMeal.addFoodToMeal')}
        variant="gradientCta"
        size="md"
        width="full"
        icon={PlusCircle}
        onPress={handleAddFood}
      />
    );
  };

  return (
    <BottomPopUp
      visible={visible}
      onClose={onClose}
      title={t('food.addFoodItemToMeal.scannedFoodDetails')}
      subtitle={barcode}
      headerIcon={<ScanLine size={theme.iconSize.lg} color={theme.colors.accent.primary} />}
      footer={renderFooter()}
      maxHeight="80%"
    >
      {renderContent()}
    </BottomPopUp>
  );
}
