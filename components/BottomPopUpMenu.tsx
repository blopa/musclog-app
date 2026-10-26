import { ChevronRight } from 'lucide-react-native';
import { ComponentType, ReactNode } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { ListGroup } from '@/components/theme/ListGroup';
import { ListRow } from '@/components/theme/ListRow';
import { useTheme } from '@/hooks/useTheme';

import { BottomPopUp } from './BottomPopUp';

export type BottomPopUpMenuItem = {
  icon: ComponentType<{ size: number; color: string }>;
  /** Removed in Phase 3: menu icons are naked. Typed `never` so a leftover fails the build. */
  iconBgColor?: never;
  /** Only read to recognize a destructive item (the error color); other icons are neutral. */
  iconColor?: string;
  title: string;
  /** One line under the title. Leave it out when it would only restate the title. */
  description?: string;
  titleColor?: string;
  /** Show a chevron: the item pushes a screen or opens a sheet with more choices. */
  showChevron?: boolean;
  /**
   * Makes the menu a picker: `true` marks the current choice (accent icon and a check), `false`
   * an unpicked one. Leave it out on an ordinary action.
   */
  selected?: boolean;
  testID?: string;
  onPress: () => void;
  /** When true, the menu will not automatically close when this item is pressed */
  keepOpenOnPress?: boolean;
};

type BottomPopUpMenuProps = {
  visible: boolean;
  onClose?: () => void;
  title: string;
  subtitle?: string;
  items?: BottomPopUpMenuItem[];
  children?: ReactNode;
  footer?: ReactNode;
  maxHeight?: number | 'auto' | `${number}%`;
  headerIcon?: ReactNode;
  fullWidthItems?: boolean;
  /** When false, content is not wrapped in ScrollView (e.g. for sticky header + scrollable list) */
  scrollable?: boolean;
  isLoading?: boolean;
  loadingTitle?: string;
};

/** Destructive items sit at the end of the list, in the error color. */
function orderMenuItems(
  items: BottomPopUpMenuItem[],
  isDestructive: (item: BottomPopUpMenuItem) => boolean
): BottomPopUpMenuItem[] {
  return [...items.filter((item) => !isDestructive(item)), ...items.filter(isDestructive)];
}

export function BottomPopUpMenu({
  visible,
  onClose,
  title,
  subtitle,
  items,
  children,
  footer,
  maxHeight,
  headerIcon,
  scrollable = true,
  isLoading = false,
  loadingTitle,
}: BottomPopUpMenuProps) {
  const theme = useTheme();
  const isDestructive = (item: BottomPopUpMenuItem) =>
    item.titleColor === theme.colors.status.error || item.iconColor === theme.colors.status.error;

  const trailingFor = (item: BottomPopUpMenuItem) => {
    if (item.selected !== undefined) {
      // A picker row: ListRow draws the check on the picked row, nothing on the others.
      return item.selected ? undefined : null;
    }

    return item.showChevron ? (
      <ChevronRight size={theme.iconSize.sm} color={theme.colors.text.tertiary} />
    ) : null;
  };

  return (
    <BottomPopUp
      visible={visible}
      onClose={isLoading ? undefined : onClose}
      title={title}
      subtitle={subtitle}
      maxHeight={maxHeight}
      headerIcon={headerIcon}
      footer={footer}
      scrollable={scrollable}
    >
      {isLoading ? (
        <View className="items-center justify-center p-12">
          <ActivityIndicator size="large" color={theme.colors.accent.primary} />
          {loadingTitle ? (
            <Text className="mt-4 text-center text-lg font-semibold text-text-primary">
              {loadingTitle}
            </Text>
          ) : null}
        </View>
      ) : (
        children ||
        (items && (
          // The list is the sheet: it bleeds through BottomPopUp's 24pt content padding so the
          // rows and their press highlight span the sheet, while the row content stays on the
          // title's line.
          <View
            style={{
              marginHorizontal: -theme.spacing.padding.xl,
              marginTop: -theme.spacing.padding.md,
            }}
          >
            <ListGroup flush>
              {orderMenuItems(items, isDestructive).map((item, index) => (
                <ListRow
                  key={`${item.title}-${index}`}
                  variant="grouped"
                  icon={item.icon}
                  iconColor={isDestructive(item) ? theme.colors.status.error : undefined}
                  title={item.title}
                  titleColor={item.titleColor}
                  subtitle={item.description}
                  selected={item.selected}
                  testID={item.testID}
                  trailing={trailingFor(item)}
                  onPress={() => {
                    if (!item.keepOpenOnPress) {
                      onClose?.();
                    }

                    item.onPress();
                  }}
                />
              ))}
            </ListGroup>
          </View>
        ))
      )}
    </BottomPopUp>
  );
}
