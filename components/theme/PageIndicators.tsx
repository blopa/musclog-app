import { View } from 'react-native';
import { theme } from '../../theme';

type PageIndicatorsProps = {
  totalPages: number;
  currentPage: number;
};

export function PageIndicators({ totalPages, currentPage }: PageIndicatorsProps) {
  return (
    <View className="flex-row items-center justify-center gap-2">
      {Array.from({ length: totalPages }).map((_, index) => {
        const isActive = index === currentPage;
        return (
          <View
            key={index}
            className={isActive ? 'h-2 rounded-full' : 'h-2 w-2 rounded-full'}
            style={
              isActive
                ? {
                    width: theme.size['8'],
                    backgroundColor: theme.colors.status.emeraldLight,
                    shadowColor: theme.colors.status.emeraldLight,
                    shadowOffset: theme.shadowOffset.zero,
                    shadowOpacity: theme.shadowOpacity.medium50,
                    shadowRadius: theme.shadowRadius.lg,
                    elevation: theme.elevation.lg,
                  }
                : {
                    backgroundColor: theme.colors.background.white10,
                  }
            }
          />
        );
      })}
    </View>
  );
}
