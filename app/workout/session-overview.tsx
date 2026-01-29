import { useMemo } from 'react';
import { View, Text, Pressable, ScrollView, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  X,
  MoreHorizontal,
  Clock,
  Dumbbell,
  CheckCircle,
  ChevronRight,
  Play,
} from 'lucide-react-native';
import { MasterLayout } from '../../components/MasterLayout';
import { GenericCard } from '../../components/cards/GenericCard';
import { theme } from '../../theme';

type ExerciseStatus = 'completed' | 'in-progress' | 'pending' | 'skipped';

type Exercise = {
  id: string;
  name: string;
  imageUrl: string;
  status: ExerciseStatus;
  setsCompleted: number;
  totalSets: number;
};

const exercises: Exercise[] = [
  {
    id: '1',
    name: 'Incline Dumbbell Press',
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDUk5DGE9te3WrUtEqNtvyCU3_ptGcI55yoTO1AXjHc8TexvZYJNWxtZhj39EsUA2CZAxipdIaXIzGCYVwrvzDV0jL2-eF1cb3iA204pu3bJod6GyBH-l-bqZ_M068fna28XuZQGTfWp-i1BNO8RcSWx6WvsLj3cX8xJ3I7J_tHe_4WH9_CXvZx8fhTBTS8Iu8jxD5BVES96tMJijA9pwDIqctJbktA5VkRbaTAGtP-EVrusaU-51wJSRL4mu82I-7g2aDlnHsw2Rwv',
    status: 'completed',
    setsCompleted: 4,
    totalSets: 4,
  },
  {
    id: '2',
    name: 'Overhead Press (Dumbbell)',
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBzB0Jf0btBTky8cioc5ZyFhkq-f9bGJ3nXx7ZdCeP3gjVS3ngN_21UHCaXCrPXgpaREV-2pVWD0rkLQEcCDog7H0HHT7xD8R-1u6ZbRou8sRtfXoZLcMvRTjfVJqO-WWVQojeETObgZyhNu3qRRFRey7mp1VQ-_NCeg8VnBjIclyAp5GeB5PXH9y6POGTNjuIm3EMwTk42wcJDcJaOCKKljZn_hZ1kyVfzDl-SWKBzJWa0Z97YSi__I7zMMMTfY7MHTYKxCnevDLZ1',
    status: 'in-progress',
    setsCompleted: 2,
    totalSets: 3,
  },
  {
    id: '3',
    name: 'Lateral Side Raises',
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBOhjsZK7Dppm6RjNHzeVNzfHm21l0ohRaicDvo7j2nXETV-xBKTqbnNXED_J1rg1Dn_vdNmAP8iZcmBF2wImgco2VKqMhoquHJVfVsp62htxWO5Bs6EfTfnp2fEsysvbdEXhxO4hYfLg2vSoxO2NEaAFYAcQKU7D_xzDJCMgSFzDxgelO1gBlhjxYaYmA_8BkN7eORtyHpC5BTrH_h7xgVfqfn-AHYpTNLcjaxawhsaH1vWv8fZ-e9eVUvOZP6SyF6FeYZxcL-zb3h',
    status: 'pending',
    setsCompleted: 0,
    totalSets: 4,
  },
  {
    id: '4',
    name: 'Cable Tricep Pushdowns',
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAEK2jixQ7LHtdzCX_hUoKM-iakcLdEVVPPntnMXRqSTSGbt3Q-Bf0w77HTHqtOK-z5BWkfxUFhyPX4luE3moX2-F0Uhn-4EVtzPHipdJ0d6hQRr7_Np_xBYPuv8JPRuolZ__LHM6QVSnC6Wdxp2t-73q2ujuj1vhy3lMFj74yVEdgG9Vfa0STU-57-I1lzAcrTSdJTMTNTl3PaxFBJOKwV0lwMIUIk_DOkhEarf3fRorJB6eFhEQ0Nc2F2uaFJkfF_G5P5yEQeO-j-',
    status: 'skipped',
    setsCompleted: 0,
    totalSets: 3,
  },
  {
    id: '5',
    name: 'Overhead Tricep Extension',
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuB46tR61zAPRMOTWKhCOm3WUvkwA6W3eBOPufkeRVQDhbRI0RUxDzyjjQoFEUjbJsslRnDjTjoeabBs4wDzxwDla-TyD3dEZVJ1C3HMopB503fWLmDnDleqkM0BkzQ4nFY1xHab9IdC5BoE1otTnOThoqdxl-_lxQNGKWKTkYDkLRCwS4cBlE2fHaYuZEQiNmyMId13N-KHnsEW6Fh0sBNL8JfwADMuJMOqAGjbmbgX-PrY0CfUmP8Zgd0VVp4fVB3Hu2XPttdQtwwK',
    status: 'pending',
    setsCompleted: 0,
    totalSets: 3,
  },
  {
    id: '6',
    name: 'Dumbbell Shrugs',
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDQQxQqGOgOZufBPIHuKy21SgMHIcQCc3RdaCm8pe4Yxx2uGrZEGBDEeVdQt-DQfA0NPB8mJmooPNIyNSH1zCjW8Nc_z88IO3CFT5lJofEtfov-sYepYGan3faVCJOJV54MdLaTvJFWNBSl224LjSXvVUwcEm4uy3NGHQd0FePLWPW7x0cwB8X-kF86ZlbWvwsAfzVji4Ru-MGAgXspo-tRyJ2qGVQ7JTg04hYVp2xhtY1T-sTwZ52bowqYs-PWIpPuC7-fHhc06zl7',
    status: 'pending',
    setsCompleted: 0,
    totalSets: 2,
  },
];

function SessionHeader({ onClose }: { onClose: () => void }) {
  return (
    <View className="flex-row items-center justify-between bg-bg-primary/80 px-6 py-6">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close"
        className="-ml-2 rounded-full p-2"
        onPress={onClose}
      >
        <X size={theme.iconSize['2xl']} color={theme.colors.text.primary} />
      </Pressable>
      <Text className="text-lg font-semibold text-text-primary">Session Overview</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="More options"
        className="-mr-2 rounded-full p-2"
        onPress={() => {
          // no-op for now
        }}
      >
        <MoreHorizontal size={theme.iconSize['2xl']} color={theme.colors.text.primary} />
      </Pressable>
    </View>
  );
}

function WorkoutInfo() {
  return (
    <GenericCard variant="card" size="default">
      <View className="p-6">
        <View className="mb-2 flex-row items-start justify-between">
          <Text className="text-3xl font-extrabold tracking-tight text-text-primary">
            Push Day A
          </Text>
          <View className="rounded-full bg-accent-primary/10 px-3 py-1">
            <Text className="text-xs font-bold uppercase tracking-widest text-text-accent">
              In Progress
            </Text>
          </View>
        </View>

        <View className="flex-row items-center gap-4">
          <View className="flex-row items-center gap-2">
            <Clock size={theme.iconSize.sm} color={theme.colors.text.secondary} />
            <Text className="text-sm font-medium text-text-secondary">Est. 55 mins</Text>
          </View>
          <View className="flex-row items-center gap-2">
            <Dumbbell size={theme.iconSize.sm} color={theme.colors.text.secondary} />
            <Text className="text-sm font-medium text-text-secondary">6 Exercises</Text>
          </View>
        </View>
      </View>
    </GenericCard>
  );
}

function ExerciseCard({
  name,
  imageUrl,
  status,
  setsCompleted,
  totalSets,
}: {
  name: string;
  imageUrl: string;
  status: ExerciseStatus;
  setsCompleted: number;
  totalSets: number;
}) {
  const isCompleted = status === 'completed';
  const isSkipped = status === 'skipped';
  const isInProgress = status === 'in-progress';

  const titleClassName = useMemo(() => {
    if (isCompleted) return 'text-text-primary';
    if (isInProgress) return 'text-text-primary';
    if (isSkipped) return 'text-text-muted';
    return 'text-text-secondary';
  }, [isCompleted, isInProgress, isSkipped]);

  return (
    <GenericCard
      variant="card"
      size="default"
      isPressable
      onPress={() => {
        // navigate to exercise details / logger
      }}
    >
      <View className="p-4">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-4">
            <View
              className={`h-16 w-16 overflow-hidden rounded-lg border border-border-default bg-bg-secondary ${
                isSkipped ? 'opacity-60' : ''
              }`}
            >
              <Image
                source={{ uri: imageUrl }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
              />
            </View>

            <View className="flex-1">
              <View className="flex-row items-center gap-2">
                <Text className={`text-lg font-bold leading-tight ${titleClassName}`}>{name}</Text>
                {isSkipped ? (
                  <View className="rounded bg-bg-secondary px-2 py-1">
                    <Text className="text-[10px] font-bold text-text-muted">SKIPPED</Text>
                  </View>
                ) : null}
              </View>

              <View className="mt-2 flex-row items-center gap-2">
                {Array.from({ length: totalSets }).map((_, i) => (
                  <View
                    key={i}
                    className={`h-1.5 w-6 rounded-full ${
                      isSkipped
                        ? 'border border-border-light'
                        : i < setsCompleted
                          ? 'bg-accent-primary'
                          : 'bg-bg-secondary'
                    }`}
                  />
                ))}
              </View>
            </View>
          </View>

          {isCompleted ? (
            <CheckCircle size={theme.iconSize.lg} color={theme.colors.accent.primary} />
          ) : (
            <ChevronRight size={theme.iconSize.lg} color={theme.colors.text.secondary} />
          )}
        </View>
      </View>
    </GenericCard>
  );
}

function ExerciseList() {
  return (
    <View className="gap-3">
      <Text className="px-2 text-xs font-bold uppercase tracking-widest text-text-muted">
        Workout Sequence
      </Text>
      <View className="gap-3">
        {exercises.map((exercise) => (
          <ExerciseCard
            key={exercise.id}
            name={exercise.name}
            imageUrl={exercise.imageUrl}
            status={exercise.status}
            setsCompleted={exercise.setsCompleted}
            totalSets={exercise.totalSets}
          />
        ))}
      </View>
    </View>
  );
}

function ResumeButton() {
  return (
    <View className="absolute bottom-0 left-0 right-0">
      <LinearGradient
        colors={[theme.colors.background.primary, 'rgba(10, 31, 26, 0.95)', 'transparent']}
        start={{ x: 0.5, y: 1 }}
        end={{ x: 0.5, y: 0 }}
      >
        <View className="px-6 pb-10 pt-6">
          <LinearGradient
            colors={[theme.colors.accent.primary, theme.colors.accent.secondary]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{ borderRadius: theme.borderRadius.xl }}
          >
            <Pressable
              accessibilityRole="button"
              className="w-full flex-row items-center justify-center gap-2 py-5"
              onPress={() => {
                // resume session
              }}
            >
              <Play size={theme.iconSize.md} color={theme.colors.text.primary} fill="#ffffff" />
              <Text className="text-lg font-extrabold uppercase tracking-tight text-text-primary">
                Resume Session
              </Text>
            </Pressable>
          </LinearGradient>
        </View>
      </LinearGradient>
    </View>
  );
}

export default function SessionOverviewScreen() {
  const router = useRouter();

  return (
    <MasterLayout showNavigationMenu={false}>
      <View className="flex-1 bg-bg-primary">
        <SessionHeader onClose={() => router.back()} />

        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 160 }}
        >
          <View className="gap-4 px-4">
            <WorkoutInfo />
            <ExerciseList />
          </View>
        </ScrollView>

        <ResumeButton />
      </View>
    </MasterLayout>
  );
}
