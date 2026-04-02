import { ArrowRight, CheckCircle, X } from 'lucide-react-native';
import { ReactNode, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../components/theme/Button';

type ButtonVariant =
  | 'accent'
  | 'discard'
  | 'outline'
  | 'secondary'
  | 'secondaryGradient'
  | 'dashed'
  | 'gradientCta';
type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANTS: ButtonVariant[] = [
  'accent',
  'discard',
  'outline',
  'secondary',
  'secondaryGradient',
  'dashed',
  'gradientCta',
];

const SIZES: ButtonSize[] = ['sm', 'md', 'lg'];

type ButtonExampleProps = {
  variant: ButtonVariant;
  size?: ButtonSize;
  label?: string;
  icon?: typeof ArrowRight;
  disabled?: boolean;
};

function ButtonExample({
  variant,
  size = 'md',
  label,
  icon,
  disabled = false,
}: ButtonExampleProps) {
  const defaultLabel = label || variant.charAt(0).toUpperCase() + variant.slice(1);
  return (
    <View className="mb-4">
      <Text className="mb-2 text-xs font-semibold text-text-secondary">
        {variant} {size} {disabled ? '(disabled)' : ''}
      </Text>
      <Button
        label={defaultLabel}
        variant={variant}
        size={size}
        icon={icon}
        disabled={disabled}
        width="full"
      />
    </View>
  );
}

type SectionProps = {
  title: string;
  children: ReactNode;
};

function Section({ title, children }: SectionProps) {
  return (
    <View className="mb-8">
      <Text className="mb-4 text-xl font-bold text-text-primary">{title}</Text>
      {children}
    </View>
  );
}

export default function ButtonTestScreen() {
  const [pressedCount, setPressedCount] = useState(0);

  return (
    <SafeAreaView className="flex-1 bg-bg-primary" edges={['top']}>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-6 py-6">
          {/* Header */}
          <View className="mb-8">
            <Text className="mb-2 text-3xl font-bold text-text-primary">Button Component</Text>
            <Text className="text-base text-text-secondary">
              All variants, sizes, and states of the Button component
            </Text>
          </View>

          {/* Interactive Example */}
          <Section title="Interactive Example">
            <View className="mb-4">
              <Text className="mb-2 text-xs font-semibold text-text-secondary">
                Pressed {pressedCount} times
              </Text>
              <Button
                label="Click Me"
                variant="accent"
                icon={ArrowRight}
                onPress={() => setPressedCount((prev) => prev + 1)}
                width="full"
              />
            </View>
          </Section>

          {/* All Variants - Medium Size */}
          <Section title="All Variants (Medium Size)">
            {VARIANTS.map((variant) => (
              <ButtonExample key={variant} variant={variant} size="md" />
            ))}
          </Section>

          {/* All Variants with Icons */}
          <Section title="All Variants with Icons">
            {VARIANTS.map((variant) => (
              <ButtonExample
                key={`${variant}-icon`}
                variant={variant}
                size="md"
                icon={ArrowRight}
              />
            ))}
          </Section>

          {/* All Sizes - Accent Variant */}
          <Section title="All Sizes (Accent Variant)">
            {SIZES.map((size) => (
              <ButtonExample key={size} variant="accent" size={size} label={`Size: ${size}`} />
            ))}
          </Section>

          {/* Disabled States */}
          <Section title="Disabled States">
            {VARIANTS.map((variant) => (
              <ButtonExample key={`${variant}-disabled`} variant={variant} size="md" disabled />
            ))}
          </Section>

          {/* Width Variants */}
          <Section title="Width Variants">
            <View className="mb-4">
              <Text className="mb-2 text-xs font-semibold text-text-secondary">Full Width</Text>
              <Button label="Full Width" variant="accent" width="full" />
            </View>
            <View className="mb-4">
              <Text className="mb-2 text-xs font-semibold text-text-secondary">Flex-1 (50%)</Text>
              <View className="flex-row gap-3">
                <Button label="Flex-1" variant="accent" width="flex-1" />
                <Button label="Flex-1" variant="outline" width="flex-1" />
              </View>
            </View>
            <View className="mb-4">
              <Text className="mb-2 text-xs font-semibold text-text-secondary">Flex-2 (66%)</Text>
              <View className="flex-row gap-3">
                <Button label="Flex-2" variant="accent" width="flex-2" />
                <Button label="Flex-1" variant="outline" width="flex-1" />
              </View>
            </View>
            <View className="mb-4">
              <Text className="mb-2 text-xs font-semibold text-text-secondary">Auto Width</Text>
              <Button label="Auto Width" variant="accent" width="auto" />
            </View>
          </Section>

          {/* Common Use Cases */}
          <Section title="Common Use Cases">
            <View className="mb-4">
              <Text className="mb-2 text-xs font-semibold text-text-secondary">Primary Action</Text>
              <Button label="Save Changes" variant="accent" icon={CheckCircle} width="full" />
            </View>
            <View className="mb-4">
              <Text className="mb-2 text-xs font-semibold text-text-secondary">
                Destructive Action
              </Text>
              <Button label="Delete Item" variant="discard" icon={X} width="full" />
            </View>
            <View className="mb-4">
              <Text className="mb-2 text-xs font-semibold text-text-secondary">
                Secondary Action
              </Text>
              <Button label="Cancel" variant="outline" width="full" />
            </View>
            <View className="mb-4">
              <Text className="mb-2 text-xs font-semibold text-text-secondary">CTA Button</Text>
              <Button label="Get Started" variant="gradientCta" icon={ArrowRight} width="full" />
            </View>
          </Section>

          {/* Button Groups */}
          <Section title="Button Groups">
            <View className="mb-4">
              <Text className="mb-2 text-xs font-semibold text-text-secondary">
                Modal Footer Style
              </Text>
              <View className="flex-row gap-3">
                <Button label="Cancel" variant="outline" width="flex-1" size="sm" />
                <Button label="Confirm" variant="accent" width="flex-2" size="sm" />
              </View>
            </View>
            <View className="mb-4">
              <Text className="mb-2 text-xs font-semibold text-text-secondary">Action Buttons</Text>
              <View className="flex-row gap-3">
                <Button label="Skip" variant="outline" width="flex-1" size="sm" />
                <Button label="Save" variant="accent" width="flex-1" size="sm" />
              </View>
            </View>
          </Section>

          {/* Bottom spacing */}
          <View className="h-8" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
