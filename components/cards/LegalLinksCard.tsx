import Constants from 'expo-constants';
import { ExternalLink } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, Text, View } from 'react-native';

import packageJson from '../../package.json';
import { useTheme } from '../../hooks/useTheme';
import { GenericCard } from './GenericCard';

const buildNumber =
  Constants.expoConfig?.ios?.buildNumber ?? Constants.expoConfig?.android?.versionCode ?? null;

interface LegalLinksCardProps {
  containerStyle?: any;
}

export function LegalLinksCard({ containerStyle }: LegalLinksCardProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <View style={{ marginBottom: theme.spacing.padding.sm, width: '100%', ...containerStyle }}>
      <GenericCard variant="default" size="sm" containerStyle={{ width: '100%' }}>
        <View
          style={{
            width: '100%',
            paddingHorizontal: theme.spacing.padding.base,
            paddingTop: theme.spacing.padding.sm,
            paddingBottom: theme.spacing.padding.sm,
          }}
        >
          <Pressable
            style={({ pressed }) => [
              {
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: theme.spacing.padding.md,
                paddingRight: theme.size.xl + theme.spacing.padding.sm,
                paddingHorizontal: 0,
                paddingLeft: 0,
                backgroundColor: pressed ? theme.colors.background.overlay : 'transparent',
                borderRadius: theme.borderRadius.sm,
              },
            ]}
            onPress={() => Linking.openURL('https://musclog.app/en-us/terms')}
          >
            <Text
              style={{
                fontSize: theme.typography.fontSize.base,
                color: theme.colors.text.primary,
              }}
              numberOfLines={1}
            >
              {t('settings.termsOfService')}
            </Text>
            <View
              style={{
                position: 'absolute',
                right: 0,
                top: 0,
                bottom: 0,
                width: theme.size.xl,
                justifyContent: 'center',
                alignItems: 'center',
              }}
              pointerEvents="none"
            >
              <ExternalLink size={theme.iconSize.lg} color={theme.colors.text.secondary} />
            </View>
          </Pressable>

          <View
            style={{
              height: theme.borderWidth.thin,
              backgroundColor: theme.colors.border.light,
              marginVertical: theme.spacing.padding.sm,
            }}
          />

          <Pressable
            style={({ pressed }) => [
              {
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: theme.spacing.padding.md,
                paddingRight: theme.size.xl + theme.spacing.padding.sm,
                paddingHorizontal: 0,
                paddingLeft: 0,
                backgroundColor: pressed ? theme.colors.background.overlay : 'transparent',
                borderRadius: theme.borderRadius.sm,
              },
            ]}
            onPress={() => Linking.openURL('https://musclog.app/en-us/privacy')}
          >
            <Text
              style={{
                fontSize: theme.typography.fontSize.base,
                color: theme.colors.text.primary,
              }}
              numberOfLines={1}
            >
              {t('settings.privacyPolicy')}
            </Text>
            <View
              style={{
                position: 'absolute',
                right: 0,
                top: 0,
                bottom: 0,
                width: theme.size.xl,
                justifyContent: 'center',
                alignItems: 'center',
              }}
              pointerEvents="none"
            >
              <ExternalLink size={theme.iconSize.lg} color={theme.colors.text.secondary} />
            </View>
          </Pressable>

          <View
            style={{
              height: theme.borderWidth.thin,
              backgroundColor: theme.colors.border.light,
              marginVertical: theme.spacing.padding.sm,
            }}
          />

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: theme.spacing.padding.md,
              paddingHorizontal: 0,
            }}
          >
            <Text
              style={{
                fontSize: theme.typography.fontSize.base,
                color: theme.colors.text.secondary,
              }}
            >
              Musclog v{packageJson.version}
              {buildNumber != null ? ` (Build ${buildNumber})` : ''}
            </Text>
          </View>
        </View>
      </GenericCard>
    </View>
  );
}
