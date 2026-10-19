import type { ComponentType } from 'react';

import { ListRow } from '@/components/theme/ListRow';

type ManagementItemProps = {
  title: string;
  description: string;
  icon: ComponentType<{ size: number; color: string }>;
  onPress?: () => void;
};

/** One entry of the Profile "Management" list. A row of a `ListGroup`. */
export function ManagementItem({ title, description, icon, onPress }: ManagementItemProps) {
  return (
    <ListRow variant="grouped" icon={icon} title={title} subtitle={description} onPress={onPress} />
  );
}
