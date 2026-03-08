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
import { getNutrimentsWithFallback, getNutrimentValue, getProductName, mapOpenFoodFactsProduct } from '../../utils/openFoodFactsMapper';
import { BottomPopUp } from '../BottomPopUp';
import { FoodInfoCard } from '../cards/FoodInfoCard';
import { ServingSizeSelector } from '../ServingSizeSelector';
import { Button } from '../theme/Button';

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
      name: getProductName(product),
      category: product.categories?.split(',')[0] || t('food.generic'),
      calories: Math.round(getNutrimentValue(nutriments, 'energy-kcal') || 0),
      protein: Math.round(getNutrimentValue(nutriments, 'proteins') || 0),
      carbs: Math.round(getNutrimentValue(nutriments, 'carbohydrates') || 0),
      fat: Math.round(getNutrimentValue(nutriments, 'fat') || 0),
    };

    return (
      <View>
        <FoodInfoCard food={foodInfo} />
        
        <ServingSizeSelector
          value={amount}
          onChange={setAmount}
          quickSizes={[
            { label: '50g', value: 50 },
            { label: '100g', value: 100 },
            { label: '150g', value: 150 },
            { label: '200g', value: 200 },
            { label: '250g', value: 250 },
          ]}
        />

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
