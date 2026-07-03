import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { BackButton } from '../../components/common/BackButton';
import { pickImageFromLibrary } from '../../utils/imagePicker';
import { useChildStore } from '../../stores/childStore';
import { useMomstagramStore, PostCategory, MomstagramPost, CATEGORY_I18N_KEY } from '../../stores/momstagramStore';
import { momstagramApi, uploadApi } from '../../services/api';
import { FONT_SIZE, SPACING, RADIUS, SHADOWS } from '../../constants/theme';

const MAX_CONTENT = 500;
const CATEGORIES: PostCategory[] = ['일상', '학습', '여행', '기념일', '기타'];
const CORAL = '#FF6B6B';

export default function MomstagramPostScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{
    prefillContent?: string;
    prefillImage?: string;
  }>();

  const [content, setContent] = useState(params.prefillContent ?? '');
  const [imageUri, setImageUri] = useState<string | null>(
    params.prefillImage ?? null,
  );
  const [category, setCategory] = useState<PostCategory>('일상');
  const [isPrivate, setIsPrivate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const selectedChild = useChildStore((s) => s.selectedChild);
  const addPost = useMomstagramStore((s) => s.addPost);
  const addPrivatePost = useMomstagramStore((s) => s.addPrivatePost);

  const childAge = selectedChild
    ? t('momstagramPost.childAgeMonths', { count: selectedChild.ageInfo.months })
    : '';
  const dominantType = selectedChild?.innateData?.dominantType ?? '';

  const pickImage = async () => {
    const picked = await pickImageFromLibrary(t, { quality: 0.8 });
    if (picked) setImageUri(picked.uri);
  };

  // 게시 성공 후 폼 초기화. 화면 인스턴스가 재사용될 때 이전 글/사진/카테고리가
  // 그대로 남는 문제를 방지한다(다음에 '+'로 들어와도 빈 폼이 보이도록).
  const resetForm = () => {
    setContent('');
    setImageUri(null);
    setCategory('일상');
    setIsPrivate(false);
  };

  const handleSubmit = async () => {
    if (!content.trim()) {
      Alert.alert(t('common.notice'), t('momstagramPost.contentRequiredAlert.desc'));
      return;
    }

    if (isPrivate) {
      // Private posts are local-only
      const newPost: MomstagramPost = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        userName: t('momstagramPost.me'),
        childGender: (selectedChild?.gender ?? 'M') as 'M' | 'F',
        childAge,
        dominantType,
        imageUri,
        videoUrl: null,
        mediaType: imageUri ? 'image' : 'none',
        content: content.trim(),
        likes: 0,
        liked: false,
        comments: [],
        createdAt: new Date().toISOString(),
        category,
        isPrivate: true,
      };
      addPrivatePost(newPost);
      resetForm();
      Alert.alert(t('common.complete'), t('momstagramPost.privateSavedAlert.desc'), [
        { text: t('common.confirm'), onPress: () => router.back() },
      ]);
      return;
    }

    // Public post: call real API
    setSubmitting(true);
    try {
      // 이미지가 있으면 Firebase Storage에 먼저 업로드
      let uploadedImageUrl: string | undefined;
      if (imageUri) {
        try {
          const uploaded = await uploadApi.upload(imageUri, 'momstagram');
          uploadedImageUrl = uploaded.url;
        } catch {
          Alert.alert(t('common.error'), t('momstagramPost.imageUploadFailAlert.desc'));
          setSubmitting(false);
          return;
        }
      }

      const res = await momstagramApi.createPost({
        content: content.trim(),
        imageUrl: uploadedImageUrl,
        sourceType: 'manual',
        childAge: childAge || undefined,
        childGender: selectedChild?.gender ?? undefined,
        dominantType: dominantType || undefined,
      });

      const data = res.data;
      const apiPost = data.data ?? data.post ?? data;

      const newPost: MomstagramPost = {
        id: apiPost?.id ?? Date.now().toString(36),
        userName: apiPost?.userName ?? apiPost?.authorName ?? t('momstagramPost.me'),
        childGender: (selectedChild?.gender ?? 'M') as 'M' | 'F',
        childAge,
        dominantType,
        imageUri: apiPost?.imageUrl ?? apiPost?.thumbnailUrl ?? imageUri,
        videoUrl: apiPost?.videoUrl ?? null,
        mediaType: apiPost?.videoUrl ? 'video' : imageUri ? 'image' : 'none',
        content: content.trim(),
        likes: 0,
        liked: false,
        comments: [],
        createdAt: apiPost?.createdAt ?? new Date().toISOString(),
        category,
        isPrivate: false,
      };
      addPost(newPost);
      resetForm();
      Alert.alert(t('common.complete'), t('momstagramPost.sharedAlert.desc'), [
        { text: t('common.confirm'), onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert(t('common.error'), t('momstagramPost.uploadFailAlert.desc'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Stack.Screen options={{ title: t('momstagramPost.screenTitle'), headerShown: true, headerLeft: () => <BackButton /> }} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Child info badge */}
        {selectedChild && (
          <View style={styles.childBadgeRow}>
            <View style={styles.childBadge}>
              <Text style={styles.childBadgeText}>
                {selectedChild.gender === 'F' ? '👧' : '👦'}{' '}
                {childAge} · {dominantType}
              </Text>
            </View>
          </View>
        )}

        {/* Text input */}
        <View style={styles.inputCard}>
          <TextInput
            style={styles.textInput}
            placeholder={t('momstagramPost.contentPlaceholder')}
            placeholderTextColor="#A0A0B0"
            value={content}
            onChangeText={(text) => {
              if (text.length <= MAX_CONTENT) setContent(text);
            }}
            multiline
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>
            {content.length}/{MAX_CONTENT}
          </Text>
        </View>

        {/* Image preview or picker */}
        {imageUri ? (
          <View style={styles.imagePreviewWrap}>
            <Image
              source={{ uri: imageUri }}
              style={styles.imagePreview}
              resizeMode="cover"
            />
            <TouchableOpacity
              style={styles.removeImageBtn}
              onPress={() => setImageUri(null)}
            >
              <Text style={styles.removeImageText}>X</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.addPhotoBtn}
            onPress={pickImage}
            activeOpacity={0.7}
          >
            <Text style={styles.addPhotoIcon}>{'📷'}</Text>
            <Text style={styles.addPhotoText}>{t('momstagramPost.addPhoto')}</Text>
          </TouchableOpacity>
        )}

        {/* Category selector */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>{t('momstagramPost.categoryLabel')}</Text>
          <View style={styles.categoryRow}>
            {CATEGORIES.map((cat) => {
              const isActive = category === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryPill,
                    isActive && styles.categoryPillActive,
                  ]}
                  onPress={() => setCategory(cat)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.categoryPillText,
                      isActive && styles.categoryPillTextActive,
                    ]}
                  >
                    {t(CATEGORY_I18N_KEY[cat] ?? 'momstagram.category.other')}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Private toggle */}
        <View style={styles.privateRow}>
          <View style={styles.privateInfo}>
            <Text style={styles.privateLock}>
              {isPrivate ? '🔒' : '🔓'}
            </Text>
            <View>
              <Text style={styles.privateLabel}>{t('momstagramPost.privateOnly')}</Text>
              <Text style={styles.privateHint}>
                {isPrivate
                  ? t('momstagramPost.privateHintOn')
                  : t('momstagramPost.privateHintOff')}
              </Text>
            </View>
          </View>
          <Switch
            value={isPrivate}
            onValueChange={setIsPrivate}
            trackColor={{ false: '#E0E0E0', true: CORAL }}
            thumbColor="#FFFFFF"
          />
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[
            styles.submitBtn,
            (!content.trim() || submitting) && styles.submitBtnDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!content.trim() || submitting}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.submitBtnText}>
              {isPrivate ? t('momstagramPost.saveBtn') : t('momstagramPost.shareBtn')}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8F0' },
  content: {
    padding: SPACING.lg,
    paddingBottom: 100,
  },
  /* Child badge */
  childBadgeRow: {
    flexDirection: 'row',
    marginBottom: SPACING.md,
  },
  childBadge: {
    backgroundColor: '#E0E0FF',
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
  },
  childBadgeText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: '#6366F1',
  },
  /* Text input */
  inputCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    minHeight: 160,
    ...SHADOWS.soft,
  },
  textInput: {
    fontSize: FONT_SIZE.md,
    color: '#1E1E2E',
    lineHeight: 22,
    minHeight: 120,
  },
  charCount: {
    textAlign: 'right',
    fontSize: FONT_SIZE.xs,
    color: '#A0A0B0',
    marginTop: SPACING.xs,
  },
  /* Image preview */
  imagePreviewWrap: {
    marginBottom: SPACING.md,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  imagePreview: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: RADIUS.lg,
    backgroundColor: '#E5E5EA',
  },
  removeImageBtn: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeImageText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  /* Add photo button */
  addPhotoBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#E0E0E0',
    padding: SPACING.lg,
    alignItems: 'center',
    marginBottom: SPACING.md,
    ...SHADOWS.soft,
  },
  addPhotoIcon: { fontSize: 28, marginBottom: SPACING.xs },
  addPhotoText: {
    fontSize: FONT_SIZE.sm,
    color: '#A0A0B0',
    fontWeight: '500',
  },
  /* Category selector */
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOWS.soft,
  },
  sectionLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: '#6B6B80',
    marginBottom: SPACING.sm,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  categoryPill: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.full,
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  categoryPillActive: {
    backgroundColor: CORAL,
    borderColor: CORAL,
  },
  categoryPillText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: '#6B6B80',
  },
  categoryPillTextActive: {
    color: '#FFFFFF',
  },
  /* Private toggle */
  privateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOWS.soft,
  },
  privateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  privateLock: {
    fontSize: 20,
  },
  privateLabel: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: '#1E1E2E',
  },
  privateHint: {
    fontSize: FONT_SIZE.xs,
    color: '#A0A0B0',
    marginTop: 1,
  },
  /* Submit */
  submitBtn: {
    backgroundColor: '#6366F1',
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.sm,
    ...SHADOWS.medium,
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
  },
});
