import { useRouter } from 'expo-router';
import { AlertCircle, Bluetooth, BluetoothOff } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TextInput, View } from 'react-native';

import { GenericCard } from '@/components/cards/GenericCard';
import { Button } from '@/components/theme/Button';
import { ToggleInput } from '@/components/theme/ToggleInput';
import BleDevice from '@/database/models/BleDevice';
import { BleDeviceService } from '@/database/services/BleDeviceService';
import { useDebouncedSettings } from '@/hooks/useDebouncedSettings';
import { useSubModalVisibility } from '@/hooks/useSubModalVisibility';
import { useTheme } from '@/hooks/useTheme';
import type { WitMotionDevice } from '@/modules/witmotion-ble';
import { useWitMotion } from '@/modules/witmotion-ble';

import { BleDevicePreviewModal } from './BleDevicePreviewModal';
import { ConfirmationModal } from './ConfirmationModal';
import { FullScreenModal } from './FullScreenModal';

interface ManageBleDevicesModalProps {
  visible: boolean;
  onClose: () => void;
}

export function ManageBleDevicesModal({ visible, onClose }: ManageBleDevicesModalProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const theme = useTheme();
  const wit = useWitMotion();
  const { bleGenerateChartPayload, handleBleGenerateChartPayloadChange, flushAllPendingChanges } =
    useDebouncedSettings(500);

  const [savedDevices, setSavedDevices] = useState<BleDevice[]>([]);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [renamingDevice, setRenamingDevice] = useState<BleDevice | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [confirmRemoveDevice, setConfirmRemoveDevice] = useState<BleDevice | null>(null);
  const [isConfirmRemoveVisible, setConfirmRemoveVisible] = useSubModalVisibility(visible);
  const [isPreviewVisible, setPreviewVisible] = useSubModalVisibility(visible);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const refreshSaved = useCallback(async () => {
    const devices = await BleDeviceService.getAll();
    setSavedDevices(devices);
  }, []);

  useEffect(() => {
    if (visible) {
      const run = () => {
        void refreshSaved();
      };
      run();
    }
  }, [visible, refreshSaved]);

  const savedDeviceIds = new Set(savedDevices.map((d) => d.deviceId));
  const unsavedDiscovered = wit.discoveredDevices.filter((d) => !savedDeviceIds.has(d.id));

  const handleSave = useCallback(
    async (device: WitMotionDevice) => {
      await BleDeviceService.saveDevice(device);
      await refreshSaved();
    },
    [refreshSaved]
  );

  const handleConnect = useCallback(
    async (saved: BleDevice) => {
      setConnectingId(saved.deviceId);
      try {
        await wit.connect(saved.deviceId);
        await saved.markConnected();
        await refreshSaved();
      } finally {
        setConnectingId(null);
      }
    },
    [wit, refreshSaved]
  );

  const handleDisconnect = useCallback(async () => {
    await wit.disconnect();
  }, [wit]);

  const handleOpenRepsRecording = useCallback(() => {
    onClose();
    router.navigate('/app/test/reps-recording');
  }, [onClose, router]);

  const handleStartRename = useCallback((device: BleDevice) => {
    setRenamingDevice(device);
    setRenameValue(device.displayName);
  }, []);

  const handleConfirmRename = useCallback(async () => {
    if (!renamingDevice) {
      return;
    }

    const trimmed = renameValue.trim();
    if (trimmed) {
      await renamingDevice.rename(trimmed);
      await refreshSaved();
    }

    setRenamingDevice(null);
    setRenameValue('');
  }, [renamingDevice, renameValue, refreshSaved]);

  const handleRequestRemove = useCallback(
    (device: BleDevice) => {
      setConfirmRemoveDevice(device);
      setConfirmRemoveVisible(true);
    },
    [setConfirmRemoveVisible]
  );

  const handleRemove = useCallback(async () => {
    if (!confirmRemoveDevice) {
      return;
    }

    if (wit.connectedDevice?.id === confirmRemoveDevice.deviceId) {
      await wit.disconnect();
    }

    await confirmRemoveDevice.markAsDeleted();
    setConfirmRemoveVisible(false);
    setConfirmRemoveDevice(null);
    await refreshSaved();
  }, [confirmRemoveDevice, wit, refreshSaved, setConfirmRemoveVisible]);

  useEffect(() => {
    if (!visible) {
      void flushAllPendingChanges();
    }
  }, [visible, flushAllPendingChanges]);

  const handleScanPress = useCallback(async () => {
    if (wit.isScanning) {
      wit.stopScan();
      return;
    }

    setPermissionDenied(false);
    const granted = await wit.requestPermissions();
    if (!granted) {
      setPermissionDenied(true);
      return;
    }

    await wit.startScan({ autoConnect: false });
  }, [wit]);

  return (
    <FullScreenModal visible={visible} onClose={onClose} title={t('settings.bleDevices.title')}>
      <View className="gap-6 p-4">
        {/* ── Saved sensors ───────────────────────────── */}
        <View>
          <Text className="mb-3 text-xs font-bold uppercase tracking-wider text-text-tertiary">
            {t('settings.bleDevices.savedSensors')}
          </Text>

          {savedDevices.length === 0 ? (
            <View className="items-center rounded-xl border border-border-light bg-bg-primary py-8">
              <BluetoothOff size={theme.iconSize['2xl']} color={theme.colors.text.tertiary} />
              <Text className="mt-3 text-sm text-text-tertiary">
                {t('settings.bleDevices.noSavedSensors')}
              </Text>
              <Text className="mt-1 text-xs text-text-muted">
                {t('settings.bleDevices.noSavedSensorsHint')}
              </Text>
            </View>
          ) : (
            <View className="gap-3">
              {savedDevices.map((device) => {
                const isConnected = wit.connectedDevice?.id === device.deviceId;
                const isConnecting = connectingId === device.deviceId;
                const connectLabel = isConnecting
                  ? t('settings.bleDevices.connecting')
                  : t('settings.bleDevices.connectButton');

                return (
                  <GenericCard key={device.id} variant="default">
                    <View className="p-4">
                      <View className="mb-3 flex-row items-center gap-3">
                        <View className="h-10 w-10 items-center justify-center rounded-lg bg-bg-card">
                          <Bluetooth
                            size={theme.iconSize.md}
                            color={
                              isConnected
                                ? theme.colors.status.success
                                : theme.colors.text.secondary
                            }
                          />
                        </View>
                        <View className="flex-1">
                          <Text className="font-semibold text-text-primary">
                            {device.displayName}
                          </Text>
                          <Text className="text-xs text-text-tertiary">
                            {device.lastConnectedAt
                              ? t('settings.bleDevices.lastConnected', {
                                  time: new Intl.DateTimeFormat(undefined, {
                                    dateStyle: 'medium',
                                    timeStyle: 'short',
                                  }).format(new Date(device.lastConnectedAt)),
                                })
                              : t('settings.bleDevices.neverConnected')}
                          </Text>
                        </View>
                        <View
                          className="rounded-full px-2 py-0.5"
                          style={{
                            backgroundColor: isConnected
                              ? theme.colors.status.success + '33'
                              : theme.colors.text.muted + '33',
                          }}
                        >
                          <Text
                            className="text-xs font-semibold"
                            style={{
                              color: isConnected
                                ? theme.colors.status.success
                                : theme.colors.text.secondary,
                            }}
                          >
                            {isConnected
                              ? t('settings.bleDevices.connected')
                              : t('settings.bleDevices.saved')}
                          </Text>
                        </View>
                      </View>

                      {renamingDevice?.id === device.id ? (
                        <View className="mb-3 flex-row items-center gap-2">
                          <TextInput
                            className="flex-1 rounded-lg border border-border-light bg-bg-primary px-3 py-2 text-text-primary"
                            value={renameValue}
                            onChangeText={setRenameValue}
                            autoFocus
                            onSubmitEditing={() => void handleConfirmRename()}
                          />
                          <Button
                            label="OK"
                            size="xs"
                            variant="accent"
                            onPress={() => void handleConfirmRename()}
                          />
                          <Button
                            label={t('common.cancel')}
                            size="xs"
                            variant="secondary"
                            onPress={() => setRenamingDevice(null)}
                          />
                        </View>
                      ) : null}

                      <View className="flex-row flex-wrap gap-2">
                        {isConnected ? (
                          <>
                            <Button
                              label={t('settings.bleDevices.disconnectButton')}
                              size="xs"
                              variant="secondary"
                              onPress={() => void handleDisconnect()}
                            />
                            <Button
                              label={t('settings.bleDevices.previewDataButton')}
                              size="xs"
                              variant="secondary"
                              onPress={() => setPreviewVisible(true)}
                            />
                            <Button
                              label={t('settings.bleDevices.repsRecordingButton')}
                              size="xs"
                              variant="accent"
                              onPress={handleOpenRepsRecording}
                            />
                          </>
                        ) : (
                          <Button
                            label={connectLabel}
                            size="xs"
                            variant="accent"
                            loading={isConnecting}
                            disabled={!!connectingId}
                            onPress={() => void handleConnect(device)}
                          />
                        )}
                        {renamingDevice?.id !== device.id ? (
                          <Button
                            label={t('settings.bleDevices.renameButton')}
                            size="xs"
                            variant="secondary"
                            onPress={() => handleStartRename(device)}
                          />
                        ) : null}
                        <Button
                          label={t('settings.bleDevices.removeButton')}
                          size="xs"
                          variant="discard"
                          onPress={() => handleRequestRemove(device)}
                        />
                      </View>
                    </View>
                  </GenericCard>
                );
              })}
            </View>
          )}
        </View>

        {/* ── Recording settings ──────────────────────── */}
        <View>
          <Text className="mb-3 text-xs font-bold uppercase tracking-wider text-text-tertiary">
            {t('settings.bleDevices.recordingSettings')}
          </Text>
          <ToggleInput
            items={[
              {
                key: 'ble-generate-chart-payload',
                label: t('settings.bleDevices.generateChartPayload'),
                subtitle: t('settings.bleDevices.generateChartPayloadSubtitle'),
                value: bleGenerateChartPayload,
                onValueChange: handleBleGenerateChartPayloadChange,
              },
            ]}
          />
        </View>

        {/* ── Discover new sensors ────────────────────── */}
        <View>
          <Text className="mb-3 text-xs font-bold uppercase tracking-wider text-text-tertiary">
            {t('settings.bleDevices.foundSensors')}
          </Text>

          <Button
            label={
              wit.isScanning
                ? t('settings.bleDevices.stopScanButton')
                : t('settings.bleDevices.scanButton')
            }
            variant={wit.isScanning ? 'secondary' : 'accent'}
            width="full"
            loading={wit.isScanning}
            onPress={handleScanPress}
          />

          {unsavedDiscovered.length > 0 ? (
            <View className="mt-3 gap-3">
              {unsavedDiscovered.map((device) => (
                <GenericCard key={device.id} variant="default">
                  <View className="flex-row items-center gap-3 p-4">
                    <View className="h-10 w-10 items-center justify-center rounded-lg bg-bg-card">
                      <Bluetooth size={theme.iconSize.md} color={theme.colors.text.secondary} />
                    </View>
                    <View className="flex-1">
                      <Text className="font-semibold text-text-primary">{device.name}</Text>
                      <Text className="text-xs text-text-tertiary">{device.id}</Text>
                    </View>
                    <Button
                      label={t('settings.bleDevices.saveSensor')}
                      size="xs"
                      variant="accent"
                      onPress={() => void handleSave(device)}
                    />
                  </View>
                </GenericCard>
              ))}
            </View>
          ) : null}

          {permissionDenied || wit.error ? (
            <View
              className="mt-3 flex-row items-center gap-3 rounded-xl p-3"
              style={{ backgroundColor: theme.colors.status.error + '1A' }}
            >
              <AlertCircle size={theme.iconSize.md} color={theme.colors.status.error} />
              <Text className="flex-1 text-sm" style={{ color: theme.colors.status.error }}>
                {permissionDenied ? t('settings.bleDevices.permissionDenied') : wit.error}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <ConfirmationModal
        visible={isConfirmRemoveVisible}
        onClose={() => setConfirmRemoveVisible(false)}
        onConfirm={() => void handleRemove()}
        title={t('settings.bleDevices.removeButton')}
        message={t('settings.bleDevices.removeConfirm', {
          name: confirmRemoveDevice?.displayName ?? '',
        })}
        confirmLabel={t('settings.bleDevices.removeButton')}
      />

      <BleDevicePreviewModal visible={isPreviewVisible} onClose={() => setPreviewVisible(false)} />
    </FullScreenModal>
  );
}
