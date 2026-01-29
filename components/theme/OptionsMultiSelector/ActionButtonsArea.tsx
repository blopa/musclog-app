import React from 'react';
import { View } from 'react-native';
import { Trash2 } from 'lucide-react-native';
import { theme } from '../../../theme';
import { GroupActionButton } from './GroupActionButton';
import { DeleteActionButton } from './DeleteActionButton';

type ActionButtonsAreaProps = {
  canGroup: boolean;
  canDelete: boolean;
  allSelectedInSameGroup: boolean;
  selectedCount: number;
  onGroupAction: () => void;
  onDelete: () => void;
};

export const ActionButtonsArea: React.FC<ActionButtonsAreaProps> = ({
  canGroup,
  canDelete,
  allSelectedInSameGroup,
  selectedCount,
  onGroupAction,
  onDelete,
}) => {
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
