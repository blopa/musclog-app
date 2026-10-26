import { Children, createContext, Fragment, isValidElement, type ReactNode } from 'react';
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
  /**
   * Full-bleed rows with no surface of their own, for a list that IS the sheet or menu (a
   * `BottomPopUpMenu`, the account menu). The caller places it edge to edge; rows pad their content
   * by 24 so it lines up with the sheet's title, and the press highlight spans the whole width.
   */
  flush?: boolean;
};

/** Lets a `ListRow variant="grouped"` know it sits in a flush list. */
export const ListGroupContext = createContext<{ flush: boolean }>({ flush: false });

/**
 * One rounded surface holding rows separated by hairlines: the native-style grouped list that
 * replaces a card per row. Rows draw no surface of their own (`ListRow variant="grouped"`).
 */
export function ListGroup({ title, footer, children, testID, flush = false }: ListGroupProps) {
  const theme = useTheme();
  const rows = Children.toArray(children).filter((child) => isValidElement(child));

  return (
    <View testID={testID}>
      {title ? <SectionLabel className="mb-2 px-1">{title}</SectionLabel> : null}
      <View
        className={
          flush
            ? undefined
            : 'overflow-hidden rounded-card border border-border-light bg-bg-overlay'
        }
      >
        {rows.map((row, index) => (
          <Fragment key={isValidElement(row) && row.key != null ? row.key : index}>
            {index > 0 ? (
              <View
                style={{
                  height: StyleSheet.hairlineWidth,
                  backgroundColor: theme.colors.background.ink10,
                  marginLeft: flush ? theme.spacing.padding.xl : theme.spacing.padding.base,
                }}
              />
            ) : null}
            <ListGroupContext.Provider value={{ flush }}>{row}</ListGroupContext.Provider>
          </Fragment>
        ))}
      </View>
      {footer ? <Text className="mt-2 px-1 text-xs text-text-tertiary">{footer}</Text> : null}
    </View>
  );
}
