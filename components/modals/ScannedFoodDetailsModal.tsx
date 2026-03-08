import { PlusCircle, ScanLine } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, View } from 'react-native';

import { useFoodProductDetails } from '../../hooks/useFoodProductDetails';
import { useTheme } from '../../hooks/useTheme';
import {
  isSuccessFoodDetailProductState,
} from '../../types/guards/openFoodFacts';
import type { SearchResultProduct } from '../../types/openFoodFacts';
import { getNutrimentsWithFallback, getNutrimentValue, mapOpenFoodFactsProduct } from '../../utils/openFoodFactsMapper';
import { BottomPopUp } from '../BottomPopUp';
import { FoodInfoCard } from '../cards/FoodInfoCard';
import { Button } from '../theme/Button';
import { StepperInput } from '../theme/StepperInput';

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
  const [amount, setAmount] = useState(100);

  const { data: productData, isLoading, error } = useFoodProductDetails(barcode);

  const handleAddFood = () => {
    if (isSuccessFoodDetailProductState(productData)) {
      // Map the product data to UnifiedFoodResult format, then to a Food-like object
      const mappedProduct = mapOpenFoodFactsProduct(productData.product as SearchResultProduct);
      
      const foodForMeal = {
        food: {
          id: mappedProduct.id,
          name: mappedProduct.name,
          brand: mappedProduct.brand,
          calories: mappedProduct.calories || 0,
          protein: mappedProduct.protein || 0,
          carbs: mappedProduct.carbs || 0,
          fat: mappedProduct.fat || 0,
          fiber: mappedProduct.fiber || 0,
        },
        amount,
      };

      onAddFood?.(foodForMeal);
      onClose();
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

    if (error || !isSuccessFoodDetailProductState(productData)) {
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

    const product = productData.product;
    const nutriments = getNutrimentsWithFallback(product);
    
    // Extract nutritional values for FoodInfoCard
    const foodInfo = {
      name: product.product_name || product.generic_name || t('food.unknownFood'),
      category: product.categories?.split(',')[0] || t('food.generic'),
      calories: Math.round(getNutrimentValue(nutriments, 'energy-kcal') || 0),
      protein: Math.round(getNutrimentValue(nutriments, 'proteins') || 0),
      carbs: Math.round(getNutrimentValue(nutriments, 'carbohydrates') || 0),
      fat: Math.round(getNutrimentValue(nutriments, 'fat') || 0),
    };

    return (
      <View>
        <FoodInfoCard food={foodInfo} />
        
        <View
          style={{
            marginTop: theme.spacing.padding.lg,
            padding: theme.spacing.padding.md,
            backgroundColor: theme.colors.background.card,
            borderRadius: theme.borderRadius.md,
            borderWidth: theme.borderWidth.thin,
            borderColor: theme.colors.border.light,
          }}
        >
          <StepperInput
            label={t('food.addFoodItemToMeal.amount')}
            value={amount}
            onChangeValue={setAmount}
            onIncrement={() => setAmount(amount + 1)}
            onDecrement={() => setAmount(Math.max(0, amount - 1))}
            unit="g"
          />
        </View>

        {product.brands ? <Text
            style={{
              marginTop: theme.spacing.padding.md,
              fontSize: theme.typography.fontSize.sm,
              color: theme.colors.text.tertiary,
              textAlign: 'center',
            }}
        >
            {product.brands}
          </Text> : null}
      </View>
    );
  };

  const renderFooter = () => {
    if (!isSuccessFoodDetailProductState(productData)) {
      return null;
    }

    return (
      <Button
        label={t('food.addFoodItemToMeal.addSelectedFoods', { count: 1 })}
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
