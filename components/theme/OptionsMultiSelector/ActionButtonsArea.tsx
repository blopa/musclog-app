import { FC } from 'react';
import { View } from 'react-native';

import { useTheme } from '../../../hooks/useTheme';
import { DeleteActionButton } from './DeleteActionButton';
import { GroupActionButton } from './GroupActionButton';

type ActionButtonsAreaProps = {
  canGroup: boolean;
  canDelete: boolean;
  allSelectedInSameGroup: boolean;
  selectedCount: number;
  onGroupAction: () => void;
  onDelete: () => void;
};

export const ActionButtonsArea: FC<ActionButtonsAreaProps> = ({
  canGroup,
  canDelete,
  allSelectedInSameGroup,
  selectedCount,
  onGroupAction,
  onDelete,
}) => {
  const theme = useTheme();
  const showGroupButton = canGroup;
  const showDeleteButton = canDelete;

  if (!showGroupButton && !showDeleteButton) {
    return null;
  }

  return (
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: theme.spacing.padding.md,
        zIndex: theme.zIndex.max,
        width: '100%',
        gap: theme.spacing.gap.sm,
      }}
    >
      {showGroupButton ? (
        <GroupActionButton
          onPress={onGroupAction}
          allSelectedInSameGroup={allSelectedInSameGroup}
        />
      ) : null}
      {showDeleteButton ? (
        <DeleteActionButton onPress={onDelete} selectedCount={selectedCount} />
      ) : null}
    </View>
  );
};
