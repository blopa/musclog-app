import type { LucideIcon } from 'lucide-react-native';

import { ListRow } from '@/components/theme/ListRow';

type TrackingMethodButtonProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  onPress: () => void;
};

/** One way to log food. A row of a `ListGroup`: same anatomy for every method, AI camera included. */
export function TrackingMethodButton({
  icon,
  title,
  description,
  onPress,
}: TrackingMethodButtonProps) {
  return (
    <ListRow variant="grouped" icon={icon} title={title} subtitle={description} onPress={onPress} />
  );
}
