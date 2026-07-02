/**
 * imagePicker.ts — 공통 이미지 선택 유틸
 *
 * 문제: Android 구형 기기(갤럭시 노트10 등)에서 expo-image-picker가
 *       기본 갤러리 앱을 찾지 못할 때 "앱을 설치해야 합니다" 시스템 다이얼로그 표시
 *
 * 해결:
 *  1. requestMediaLibraryPermissionsAsync → 권한 확인
 *  2. launchImageLibraryAsync 실패 시 catch로 잡아 사용자에게 안내
 *  3. 구형 Android 호환: mediaTypes 배열 대신 MediaTypeOptions 폴백
 */

import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';
import type { TFunction } from 'i18next';

export interface PickImageResult {
  uri: string;
  width: number;
  height: number;
  mimeType?: string;
}

/**
 * 갤러리에서 이미지 1장 선택
 * 권한 없거나 취소하면 null 반환
 * allowsEditing: true + aspect 지정 시 선택 즉시 crop UI 표시
 */
export async function pickImageFromLibrary(
  t: TFunction,
  options?: {
    quality?: number;
    allowsEditing?: boolean;
    aspect?: [number, number];
  },
): Promise<PickImageResult | null> {
  try {
    // Android 사진 선택 도구(Photo Picker) 사용 — 별도 미디어 권한 요청 불필요 (Google Play 정책 준수)
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions
        ? ImagePicker.MediaTypeOptions.Images
        : ('images' as unknown as ImagePicker.MediaTypeOptions),
      quality: options?.quality ?? 0.8,
      allowsMultipleSelection: false,
      allowsEditing: options?.allowsEditing ?? false,
      aspect: options?.aspect,
    });

    if (result.canceled || result.assets.length === 0) return null;

    const asset = result.assets[0];
    return {
      uri: asset.uri,
      width: asset.width,
      height: asset.height,
      mimeType: asset.mimeType ?? undefined,
    };
  } catch (err) {
    // 구형 Android: 갤러리 앱 없을 때 발생
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('No Activity') || msg.includes('activity') || msg.includes('설치')) {
      Alert.alert(
        t('imagePicker.galleryUnavailable.title'),
        t('imagePicker.galleryUnavailable.desc'),
      );
    } else {
      Alert.alert(t('common.error'), t('imagePicker.loadFailed'));
    }
    return null;
  }
}

/**
 * 갤러리에서 여러 장 선택 (일괄 추가용)
 * 권한 없거나 취소하면 빈 배열 반환
 */
export async function pickMultipleFromLibrary(
  t: TFunction,
  options?: {
    quality?: number;
    selectionLimit?: number;
  },
): Promise<PickImageResult[]> {
  try {
    // Android 사진 선택 도구(Photo Picker) 사용 — 별도 미디어 권한 요청 불필요 (Google Play 정책 준수)
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions
        ? ImagePicker.MediaTypeOptions.Images
        : ('images' as unknown as ImagePicker.MediaTypeOptions),
      quality: options?.quality ?? 0.8,
      allowsMultipleSelection: true,
      selectionLimit: options?.selectionLimit ?? 20,
    });

    if (result.canceled || result.assets.length === 0) return [];

    return result.assets.map((asset) => ({
      uri: asset.uri,
      width: asset.width,
      height: asset.height,
      mimeType: asset.mimeType ?? undefined,
    }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('No Activity') || msg.includes('activity') || msg.includes('설치')) {
      Alert.alert(
        t('imagePicker.galleryUnavailable.title'),
        t('imagePicker.galleryUnavailable.desc'),
      );
    } else {
      Alert.alert(t('common.error'), t('imagePicker.loadFailed'));
    }
    return [];
  }
}

/**
 * 카메라로 사진 촬영
 * 권한 없거나 취소하면 null 반환
 */
export async function pickImageFromCamera(
  t: TFunction,
  options?: {
    quality?: number;
  },
): Promise<PickImageResult | null> {
  try {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t('imagePicker.cameraPermissionRequired.title'), t('imagePicker.cameraPermissionRequired.desc'));
      return null;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: options?.quality ?? 0.8,
      allowsEditing: false,
    });

    if (result.canceled || result.assets.length === 0) return null;

    const asset = result.assets[0];
    return {
      uri: asset.uri,
      width: asset.width,
      height: asset.height,
      mimeType: asset.mimeType ?? undefined,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('No Activity') || msg.includes('activity')) {
      Alert.alert(t('imagePicker.cameraUnavailable.title'), t('imagePicker.cameraUnavailable.desc'));
    } else {
      Alert.alert(t('common.error'), t('imagePicker.cameraOpenFailed'));
    }
    return null;
  }
}
