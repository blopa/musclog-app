import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { SectionLabel } from '@/components/theme/SectionLabel';
import { useTheme } from '@/hooks/useTheme';

type ListGroupProps = {
  /** Optional heading above the surface. */
  title?: string;
  /** Optional supporting text below the surface. */
  footer?: string;
  /** `ListRow variant="grouped"` rows (or anything else that is one row tall). */
  children: ReactNode;
  testID?: string;
};

/**
 * One rounded surface holding rows separated by hairlines: the native-style grouped list that
 * replaces a card per row. Rows draw no surface of their own (`ListRow variant="grouped"`).
 */
export function ListGroup({ title, footer, children, testID }: ListGroupProps) {
  const theme = useTheme();
  const rows = Children.toArray(children).filter((child) => isValidElement(child));

  return (
    <View testID={testID}>
      {title ? <SectionLabel className="mb-2 px-1">{title}</SectionLabel> : null}
      <View className="overflow-hidden rounded-2xl border border-border-light bg-bg-overlay">
        {rows.map((row, index) => (
          <Fragment key={isValidElement(row) && row.key != null ? row.key : index}>
            {index > 0 ? (
              <View
                style={{
                  height: StyleSheet.hairlineWidth,
                  backgroundColor: theme.colors.background.ink10,
                  marginLeft: theme.spacing.padding.base,
                }}
              />
            ) : null}
            {row}
          </Fragment>
        ))}
      </View>
      {footer ? <Text className="mt-2 px-1 text-xs text-text-tertiary">{footer}</Text> : null}
    </View>
  );
}
