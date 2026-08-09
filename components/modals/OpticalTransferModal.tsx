/**
 * Optical transfer — the entry point.
 *
 * Picks a direction and collects the optional passphrase, then hands off to the send or receive
 * screen. Both are mounted as children rather than siblings (see `docs/modals-problem-on-ios.md`).
 *
 * On the passphrase: the QR stream is plaintext light — anything on the sending screen is readable
 * by any camera pointed at it for the duration. A passphrase is what makes a bystander's recording
 * useless. It is optional because both phones are usually in the same pair of hands, and it must
 * be typed identically on both.
 */

import { ScanLine, Send } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Text, View } from 'react-native';

import { SettingsCard } from '@/components/cards/SettingsCard';
import { SecretInput } from '@/components/theme/SecretInput';
import { useDebouncedSettings } from '@/hooks/useDebouncedSettings';
import { useSubModalVisibility } from '@/hooks/useSubModalVisibility';
import { useTheme } from '@/hooks/useTheme';

import { FullScreenModal } from './FullScreenModal';
import { OpticalReceiveModal } from './OpticalReceiveModal';
import { OpticalSendModal } from './OpticalSendModal';

interface OpticalTransferModalProps {
  visible: boolean;
  onClose: () => void;
}

export function OpticalTransferModal({ visible, onClose }: OpticalTransferModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { requireExportEncryption } = useDebouncedSettings();

  const [sendVisible, setSendVisible] = useSubModalVisibility(visible);
  const [receiveVisible, setReceiveVisible] = useSubModalVisibility(visible);
  const [passphrase, setPassphrase] = useState('');

  // The same setting that forces a passphrase on file exports applies here — the optical channel
  // is strictly more exposed than a file the user hands to one app.
  const passphraseRequired = Boolean(requireExportEncryption);
  const canSend = !passphraseRequired || passphrase.length > 0;

  const iconContainerStyle = {
    alignItems: 'center' as const,
    backgroundColor: theme.colors.accent.primary20,
    borderRadius: theme.borderRadius.sm,
    height: theme.size['16'],
    justifyContent: 'center' as const,
    width: theme.size['16'],
  };

  return (
    <FullScreenModal
      onClose={onClose}
      subtitle={t('opticalTransfer.subtitle')}
      title={t('opticalTransfer.title')}
      visible={visible}
    >
      <View className="gap-6 px-4 py-6">
        <Text className="text-sm text-text-secondary">{t('opticalTransfer.explainer')}</Text>

        <View className="gap-3">
          <SettingsCard
            icon={<Send color={theme.colors.accent.primary} size={theme.iconSize.xl} />}
            iconContainerStyle={iconContainerStyle}
            onPress={() => canSend && setSendVisible(true)}
            subtitle={t('opticalTransfer.sendCardSubtitle')}
            title={t('opticalTransfer.sendCard')}
          />
          <SettingsCard
            icon={<ScanLine color={theme.colors.accent.primary} size={theme.iconSize.xl} />}
            iconContainerStyle={iconContainerStyle}
            onPress={() => setReceiveVisible(true)}
            subtitle={t('opticalTransfer.receiveCardSubtitle')}
            title={t('opticalTransfer.receiveCard')}
          />
        </View>

        <View className="gap-2">
          <SecretInput
            label={
              passphraseRequired
                ? t('opticalTransfer.passphraseRequired')
                : t('opticalTransfer.passphraseOptional')
            }
            onChangeText={setPassphrase}
            value={passphrase}
          />
          <Text className="text-xs text-text-tertiary">{t('opticalTransfer.passphraseHint')}</Text>
          {passphraseRequired && !canSend ? (
            <Text className="text-xs" style={{ color: theme.colors.status.warning }}>
              {t('opticalTransfer.passphraseRequiredHint')}
            </Text>
          ) : null}
        </View>

        {/* Web is a first-class end of a transfer, not a degraded one — a laptop screen is a
            better sender than a phone, and its webcam a workable receiver. What is worth saying is
            which half of the hardware each direction uses. */}
        {Platform.OS === 'web' ? (
          <Text className="text-xs text-text-tertiary">{t('opticalTransfer.webNote')}</Text>
        ) : null}
      </View>

      <OpticalSendModal
        onClose={() => setSendVisible(false)}
        passphrase={passphrase || undefined}
        visible={sendVisible}
      />
      <OpticalReceiveModal onClose={() => setReceiveVisible(false)} visible={receiveVisible} />
    </FullScreenModal>
  );
}
