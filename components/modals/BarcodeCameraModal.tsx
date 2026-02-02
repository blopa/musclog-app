import type { CameraView as CameraViewType } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Dimensions } from 'react-native';

import { theme } from '../../theme';
import { detectBarcodes } from '../../utils/file';
import { CameraView, useCameraPermissions } from '../CameraView';
import { FullScreenModal } from './FullScreenModal';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CAMERA_ASPECT_RATIO = theme.aspectRatio.portrait;
const CAMERA_MAX_HEIGHT = SCREEN_HEIGHT * 0.6;
