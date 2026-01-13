import { useState, useRef, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions, StatusBar, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import {
  X,
  LightbulbOff,
  Lightbulb,
  MessageSquareText,
  ScanBarcode,
  Sparkles,
  FileText,
  CheckCircle,
} from 'lucide-react-native';
import { theme } from '../../theme';
import { BottomPopUpMenu } from '../../components/BottomPopUpMenu';
import { TextInput as RNTextInput } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CAMERA_ASPECT_RATIO = 4 / 5;
const CAMERA_MAX_HEIGHT = SCREEN_HEIGHT * 0.6;

type CameraMode = 'ai-meal-photo' | 'ai-label-scan' | 'barcode-scan';

export default function AICameraScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [cameraMode, setCameraMode] = useState<CameraMode>('ai-meal-photo');
  const [isDetecting, setIsDetecting] = useState(true);
  const [isContextModalVisible, setIsContextModalVisible] = useState(false);
  const [mealDescription, setMealDescription] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const cameraRef = useRef<CameraView>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const quickTags = [
    'High Protein',
    'Low Carb',
    'Large Serving',
    'Eating Out',
    'Vegan',
  ];

  // Pulse animation for AI detecting indicator
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  // Request camera permission on mount
  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission]);

  const handleTakePicture = async () => {
    if (!cameraRef.current) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
      });
      // TODO: Process the photo based on camera mode
      console.log('Photo taken:', photo);
    } catch (error) {
      console.error('Error taking picture:', error);
    }
  };

  const handleClose = () => {
    router.back();
  };

  const handleFlashToggle = () => {
    setFlashEnabled(!flashEnabled);
  };

  const handleModeChange = (mode: CameraMode) => {
    setCameraMode(mode);
  };

  const handleToggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleApplyContext = () => {
    // TODO: Apply context to AI processing
    console.log('Context applied:', { mealDescription, selectedTags });
    setIsContextModalVisible(false);
    setMealDescription('');
    setSelectedTags([]);
  };

  const handleCancelContext = () => {
    setIsContextModalVisible(false);
    setMealDescription('');
    setSelectedTags([]);
  };

  if (!permission) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <Text className="text-white">Requesting camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View className="flex-1 items-center justify-center bg-black px-6">
        <Text className="mb-4 text-center text-lg text-white">
          Camera permission is required to use this feature
        </Text>
        <Pressable onPress={requestPermission} className="rounded-xl bg-accent-primary px-6 py-3">
          <Text className="font-semibold text-black">Grant Permission</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <StatusBar barStyle="light-content" />
      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Camera Background */}
        <View className="absolute inset-0">
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing="back"
            flash={flashEnabled ? 'on' : 'off'}
          />
          {/* Gradient Overlay */}
          <LinearGradient
            colors={['rgba(0,0,0,0.6)', 'transparent', 'rgba(0,0,0,0.9)']}
            locations={[0, 0.5, 1]}
            style={StyleSheet.absoluteFill}
          />
        </View>

        {/* Header */}
        <View className="relative z-20 flex-row items-center justify-between px-4 pb-2 pt-4">
          <Pressable
            onPress={handleClose}
            className="h-10 w-10 items-center justify-center rounded-full"
            style={{
              backgroundColor: 'rgba(30, 35, 33, 0.4)',
              borderWidth: 1,
              borderColor: 'rgba(255, 255, 255, 0.1)',
            }}>
            <X size={20} color={theme.colors.text.primary} />
          </Pressable>

          {/* AI Detecting Indicator */}
          <View
            className="flex-row items-center gap-1 rounded-full px-3 py-1"
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              borderWidth: 1,
              borderColor: 'rgba(255, 255, 255, 0.05)',
            }}>
            <Animated.View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: '#ef4444',
                transform: [{ scale: pulseAnim }],
              }}
            />
            <Text className="text-xs font-semibold uppercase tracking-wide text-white/90">
              AI Detecting
            </Text>
          </View>

          <Pressable
            onPress={handleFlashToggle}
            className="h-10 w-10 items-center justify-center rounded-full"
            style={{
              backgroundColor: 'rgba(30, 35, 33, 0.4)',
              borderWidth: 1,
              borderColor: 'rgba(255, 255, 255, 0.1)',
            }}>
            {flashEnabled ? (
              <Lightbulb size={20} color={theme.colors.text.primary} />
            ) : (
              <LightbulbOff size={20} color={theme.colors.text.primary} />
            )}
          </Pressable>
        </View>

        {/* Main Content - Camera Frame */}
        <View className="relative z-10 flex-1 items-center justify-center px-6">
          {/* Camera Frame Container */}
          <View
            className="relative w-full rounded-2xl"
            style={{
              aspectRatio: CAMERA_ASPECT_RATIO,
              maxHeight: CAMERA_MAX_HEIGHT,
              borderWidth: 1,
              borderColor: 'rgba(255, 255, 255, 0.2)',
              overflow: 'visible',
            }}>
            {/* Corner Markers */}
            <View
              className="absolute -left-1 -top-1 h-8 w-8 rounded-tl-lg border-l-2 border-t-2"
              style={{ borderColor: theme.colors.accent.primary }}
            />
            <View
              className="absolute -right-1 -top-1 h-8 w-8 rounded-tr-lg border-r-2 border-t-2"
              style={{ borderColor: theme.colors.accent.primary }}
            />
            <View
              className="absolute -bottom-1 -left-1 h-8 w-8 rounded-bl-lg border-b-2 border-l-2"
              style={{ borderColor: theme.colors.accent.primary }}
            />
            <View
              className="absolute -bottom-1 -right-1 h-8 w-8 rounded-br-lg border-b-2 border-r-2"
              style={{ borderColor: theme.colors.accent.primary }}
            />

            {/* Center Line */}
            <View
              className="absolute left-0 right-0"
              style={{
                top: '50%',
                height: 1,
                backgroundColor: theme.colors.accent.primary + '80',
              }}
            />
          </View>

          {/* Instruction Text */}
          <Text className="mt-6 text-center text-sm font-medium text-white/90 drop-shadow-md">
            Point at your meal for instant estimation
          </Text>
        </View>

        {/* Bottom Controls */}
        <View className="relative z-20 px-4 pb-10 pt-4">
          {/* Mode Selector */}
          <View className="mb-6 w-full items-center">
            <View
              className="w-full max-w-sm flex-row items-stretch justify-between rounded-2xl p-1.5"
              style={{
                backgroundColor: 'rgba(30, 35, 33, 0.9)',
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.1)',
              }}>
              {/* AI Meal Photo */}
              <Pressable
                onPress={() => handleModeChange('ai-meal-photo')}
                className="flex-1 rounded-xl px-2 py-2.5"
                style={
                  cameraMode === 'ai-meal-photo'
                    ? {
                        backgroundColor: 'transparent',
                      }
                    : {}
                }>
                {cameraMode === 'ai-meal-photo' ? (
                  <LinearGradient
                    colors={['#6366f1', '#29e08e']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    className="absolute inset-0 rounded-xl"
                  />
                ) : null}
                <View className="flex-row items-center justify-center gap-1.5">
                  <Sparkles
                    size={18}
                    color={cameraMode === 'ai-meal-photo' ? '#ffffff' : theme.colors.text.secondary}
                  />
                  <Text
                    className="text-[10px] font-bold uppercase tracking-wide"
                    style={{
                      color:
                        cameraMode === 'ai-meal-photo' ? '#ffffff' : theme.colors.text.secondary,
                    }}>
                    AI Meal Photo
                  </Text>
                </View>
              </Pressable>

              {/* AI Label Scan */}
              <Pressable
                onPress={() => handleModeChange('ai-label-scan')}
                className="flex-1 rounded-xl px-2 py-2.5"
                style={
                  cameraMode === 'ai-label-scan'
                    ? {
                        backgroundColor: 'transparent',
                      }
                    : {}
                }>
                {cameraMode === 'ai-label-scan' ? (
                  <LinearGradient
                    colors={['#6366f1', '#29e08e']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    className="absolute inset-0 rounded-xl"
                  />
                ) : null}
                <View className="flex-row items-center justify-center gap-1.5">
                  <FileText
                    size={18}
                    color={cameraMode === 'ai-label-scan' ? '#ffffff' : theme.colors.text.secondary}
                  />
                  <Text
                    className="text-[10px] font-bold uppercase tracking-wide"
                    style={{
                      color:
                        cameraMode === 'ai-label-scan' ? '#ffffff' : theme.colors.text.secondary,
                    }}>
                    AI Label Scan
                  </Text>
                </View>
              </Pressable>

              {/* Barcode Scan */}
              <Pressable
                onPress={() => handleModeChange('barcode-scan')}
                className="flex-1 rounded-xl px-2 py-2.5"
                style={
                  cameraMode === 'barcode-scan'
                    ? {
                        backgroundColor: 'transparent',
                      }
                    : {}
                }>
                {cameraMode === 'barcode-scan' ? (
                  <LinearGradient
                    colors={['#6366f1', '#29e08e']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    className="absolute inset-0 rounded-xl"
                  />
                ) : null}
                <View className="flex-row items-center justify-center gap-1.5">
                  <ScanBarcode
                    size={18}
                    color={cameraMode === 'barcode-scan' ? '#ffffff' : theme.colors.text.secondary}
                  />
                  <Text
                    className="text-[10px] font-bold uppercase tracking-wide"
                    style={{
                      color:
                        cameraMode === 'barcode-scan' ? '#ffffff' : theme.colors.text.secondary,
                    }}>
                    Barcode Scan
                  </Text>
                </View>
              </Pressable>
            </View>
          </View>

          {/* Camera Controls */}
          <View className="flex-row items-center justify-between px-2">
            {/* Gallery Thumbnail */}
            <Pressable
              className="h-12 w-12 items-center justify-center overflow-hidden rounded-lg"
              style={{
                backgroundColor: 'rgba(30, 35, 33, 0.5)',
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.1)',
              }}>
              <View className="h-full w-full p-1">
                <View className="h-full w-full rounded bg-white/10" style={{ opacity: 0.7 }} />
              </View>
            </Pressable>

            {/* Shutter Button */}
            <Pressable
              onPress={handleTakePicture}
              className="h-20 w-20 items-center justify-center rounded-full active:scale-95"
              style={{
                borderWidth: 4,
                borderColor: '#ffffff',
              }}>
              <View
                className="absolute inset-0 rounded-full"
                style={{
                  borderWidth: 1,
                  borderColor: 'rgba(0, 0, 0, 0.2)',
                }}
              />
              <View
                className="h-16 w-16 rounded-full bg-white"
                style={{ backgroundColor: '#ffffff' }}
              />
            </Pressable>

            {/* Context Button */}
            <Pressable
              onPress={() => setIsContextModalVisible(true)}
              className="h-12 w-12 items-center justify-center rounded-full"
              style={{
                backgroundColor: 'rgba(30, 35, 33, 0.5)',
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.1)',
              }}>
              <MessageSquareText size={20} color={theme.colors.text.primary} />
            </Pressable>
          </View>
        </View>
      </SafeAreaView>

      {/* Context Modal */}
      <BottomPopUpMenu
        visible={isContextModalVisible}
        onClose={handleCancelContext}
        title="Add Context for AI"
        maxHeight="85%"
        headerIcon={
          <View
            className="h-10 w-10 items-center justify-center rounded-xl"
            style={{
              backgroundColor: 'transparent',
            }}>
            <LinearGradient
              colors={['#6366f1', '#29e08e']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              className="absolute inset-0 rounded-xl"
            />
            <Sparkles size={24} color="#ffffff" />
          </View>
        }>
        <View className="pt-2">
          {/* Describe Your Meal Section */}
          <View className="mb-6">
            <Text className="mb-2 ml-1 text-xs font-bold uppercase tracking-widest text-text-secondary">
              DESCRIBE YOUR MEAL
            </Text>
            <View
              className="w-full rounded-lg border p-4"
              style={{
                backgroundColor: 'rgba(17, 20, 19, 0.5)',
                borderColor: 'rgba(255, 255, 255, 0.1)',
              }}>
              <RNTextInput
                className="min-h-[100px] w-full bg-transparent text-[15px] text-text-primary"
                style={{
                  color: theme.colors.text.primary,
                  textAlignVertical: 'top',
                }}
                placeholder="e.g. This is a homemade dish with olive oil, about 2 cups of pasta..."
                placeholderTextColor="rgba(255, 255, 255, 0.2)"
                value={mealDescription}
                onChangeText={setMealDescription}
                multiline
                numberOfLines={4}
              />
            </View>
          </View>

          {/* Quick Tags Section */}
          <View className="mb-8">
            <Text className="mb-3 ml-1 text-xs font-bold uppercase tracking-widest text-text-secondary">
              QUICK TAGS
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {quickTags.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <Pressable
                    key={tag}
                    onPress={() => handleToggleTag(tag)}
                    className="rounded-full border px-4 py-2"
                    style={{
                      backgroundColor: isSelected
                        ? 'rgba(255, 255, 255, 0.1)'
                        : 'rgba(42, 50, 46, 1)',
                      borderColor: 'rgba(255, 255, 255, 0.05)',
                    }}>
                    <Text className="text-sm font-medium text-text-primary">{tag}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Action Buttons */}
          <View className="flex-row gap-3">
            <Pressable
              onPress={handleCancelContext}
              className="flex-1 rounded-xl border px-6 py-4"
              style={{
                backgroundColor: 'rgba(42, 50, 46, 1)',
                borderColor: 'rgba(255, 255, 255, 0.05)',
              }}>
              <Text className="text-center text-sm font-bold text-text-primary">Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleApplyContext}
              className="flex-[2] rounded-xl px-6 py-4 active:scale-[0.98]"
              style={{
                overflow: 'hidden',
              }}>
              <LinearGradient
                colors={['#6366f1', '#29e08e']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                className="absolute inset-0"
              />
              <View className="flex-row items-center justify-center gap-2">
                <Text className="text-sm font-bold text-white">Apply Context</Text>
                <CheckCircle size={18} color="#ffffff" />
              </View>
            </Pressable>
          </View>
        </View>
      </BottomPopUpMenu>
    </View>
  );
}
