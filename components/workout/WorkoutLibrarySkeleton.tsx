import { View } from 'react-native';

import { SkeletonLoader } from '@/components/theme/SkeletonLoader';
import { useTheme } from '@/hooks/useTheme';

/**
 * The workout library's loading placeholder: one featured card plus three standard ones, matching
 * the shapes `WorkoutCard` renders.
 *
 * Its own file because it is ~60 lines of pure layout with no logic, and inline it was the largest
 * single block in `WorkoutLibraryContent` — burying that component's actual job, which is choosing
 * between the grouped and flat layouts.
 */
export function WorkoutLibrarySkeleton() {
  const theme = useTheme();

  return (
    <>
      <View
        className="rounded-lg border bg-bg-card p-5"
        style={{ borderColor: theme.colors.background.ink5 }}
      >
        <View className="mb-4 flex-row items-start justify-between">
          <View className="flex-1 gap-2">
            <SkeletonLoader width="40%" height={theme.size['5']} />
            <SkeletonLoader width="60%" height={theme.size['6']} />
            <SkeletonLoader width="50%" height={theme.size['4']} />
          </View>
          <SkeletonLoader
            width={theme.size['16']}
            height={theme.size['16']}
            borderRadius={theme.borderRadius.md}
          />
        </View>
        <View className="flex-row gap-3">
          <SkeletonLoader
            width={theme.size['120']}
            height={theme.size['44']}
            borderRadius={theme.borderRadius.md}
          />
          <SkeletonLoader
            width={theme.size['12']}
            height={theme.size['44']}
            borderRadius={theme.borderRadius.md}
          />
        </View>
      </View>
      {[1, 2, 3].map((index) => (
        <View
          key={index}
          className="rounded-lg border bg-bg-card p-4"
          style={{ borderColor: theme.colors.background.ink5 }}
        >
          <View className="flex-row items-center gap-3">
            <SkeletonLoader
              width={theme.size['12']}
              height={theme.size['12']}
              borderRadius={theme.borderRadius.md}
            />
            <View className="flex-1 gap-2">
              <SkeletonLoader width="75%" height={theme.size['4']} />
              <SkeletonLoader width="50%" height={theme.size['3']} />
            </View>
          </View>
          <View className="mt-4 flex-row gap-2">
            <SkeletonLoader
              width={theme.size['20']}
              height={theme.size['8']}
              borderRadius={theme.borderRadius.lg}
            />
            <SkeletonLoader
              width={theme.size['20']}
              height={theme.size['8']}
              borderRadius={theme.borderRadius.lg}
            />
          </View>
        </View>
      ))}
    </>
  );
}
