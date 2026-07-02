/**
 * NextCheckupModal — 다음 검진 일정 입력 / 상세 표시 모달
 *
 * 사용처:
 *  - home의 "다음 검진 D-day" 카드 탭 → 상세 표시 + 수정 가능
 *  - 임신앨범 화면의 입력 섹션
 */

import React, { useState, useEffect } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  setNextCheckup,
  clearNextCheckup,
  daysUntil,
  formatDday,
  formatKoreanDate,
} from '../../services/checkup';

interface Props {
  visible: boolean;
  onClose: () => void;
  childId: string;
  /** 현재 저장된 다음 검진 ISO date (없으면 null) */
  current: string | null;
}

const COLOR = {
  bg: 'rgba(0,0,0,0.4)',
  card: '#FFFFFF',
  text: '#1C1C1E',
  textSub: '#636366',
  border: '#E5E5EA',
  accent: '#FF8C5A',
  pink: '#E91E63',
  danger: '#D32F2F',
};

export function NextCheckupModal({ visible, onClose, childId, current }: Props) {
  const { t } = useTranslation();
  const [yearText, setYearText] = useState('');
  const [monthText, setMonthText] = useState('');
  const [dayText, setDayText] = useState('');

  // 모달 열릴 때 현재 값 채움 (없으면 오늘 + 7일 디폴트)
  useEffect(() => {
    if (!visible) return;
    const seed = current ? new Date(current + 'T00:00:00') : (() => {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      return d;
    })();
    setYearText(String(seed.getFullYear()));
    setMonthText(String(seed.getMonth() + 1).padStart(2, '0'));
    setDayText(String(seed.getDate()).padStart(2, '0'));
  }, [visible, current]);

  const handleSave = async () => {
    const y = parseInt(yearText, 10);
    const m = parseInt(monthText, 10);
    const d = parseInt(dayText, 10);
    if (
      !Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d) ||
      y < 2024 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31
    ) {
      Alert.alert(t('vaccination.dateFormatErrorTitle'), t('components.nextCheckupModal.enterValidDate'));
      return;
    }
    // 실제 유효한 날짜인지 검증 (예: 2/30 거부)
    const test = new Date(y, m - 1, d);
    if (test.getFullYear() !== y || test.getMonth() !== m - 1 || test.getDate() !== d) {
      Alert.alert(t('vaccination.dateFormatErrorTitle'), t('components.nextCheckupModal.nonexistentDate'));
      return;
    }
    const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    await setNextCheckup(childId, iso);
    onClose();
  };

  const handleClear = async () => {
    Alert.alert(
      t('components.nextCheckupModal.deleteConfirmTitle'),
      t('components.nextCheckupModal.deleteConfirmMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            await clearNextCheckup(childId);
            onClose();
          },
        },
      ],
    );
  };

  // 미리보기 (현재 입력값 기준)
  const preview = (() => {
    const y = parseInt(yearText, 10);
    const m = parseInt(monthText, 10);
    const d = parseInt(dayText, 10);
    if (
      !Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d) ||
      y < 2024 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31
    ) return null;
    const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const days = daysUntil(iso);
    return { iso, days, label: formatKoreanDate(iso) };
  })();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.card}>
          <Text style={styles.title}>{t('pregnancy.nextCheckupLabel')}</Text>
          <Text style={styles.subtitle}>
            {t('components.nextCheckupModal.subtitle')}
          </Text>

          {/* 현재 저장된 값 표시 */}
          {current && (
            <View style={styles.currentBox}>
              <Text style={styles.currentLabel}>{t('components.nextCheckupModal.currentlySaved')}</Text>
              <Text style={styles.currentDate}>{formatKoreanDate(current)}</Text>
              <Text style={styles.currentDday}>{formatDday(daysUntil(current))}</Text>
            </View>
          )}

          {/* 입력 필드 */}
          <View style={styles.inputRow}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('components.nextCheckupModal.yearLabel')}</Text>
              <TextInput
                style={styles.inputField}
                value={yearText}
                onChangeText={(v) => setYearText(v.replace(/[^0-9]/g, '').slice(0, 4))}
                keyboardType="number-pad"
                maxLength={4}
                returnKeyType="next"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('components.nextCheckupModal.monthLabel')}</Text>
              <TextInput
                style={styles.inputField}
                value={monthText}
                onChangeText={(v) => setMonthText(v.replace(/[^0-9]/g, '').slice(0, 2))}
                keyboardType="number-pad"
                maxLength={2}
                returnKeyType="next"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('components.nextCheckupModal.dayLabel')}</Text>
              <TextInput
                style={styles.inputField}
                value={dayText}
                onChangeText={(v) => setDayText(v.replace(/[^0-9]/g, '').slice(0, 2))}
                keyboardType="number-pad"
                maxLength={2}
                returnKeyType="done"
              />
            </View>
          </View>

          {/* 미리보기 */}
          {preview && (
            <View style={styles.previewBox}>
              <Text style={styles.previewDate}>{preview.label}</Text>
              <Text
                style={[
                  styles.previewDday,
                  preview.days < 0 && styles.previewDdayPast,
                ]}
              >
                {preview.days < 0
                  ? t('components.nextCheckupModal.pastDate')
                  : preview.days === 0
                  ? t('components.nextCheckupModal.todayIsCheckup')
                  : t('components.nextCheckupModal.daysRemaining', { count: preview.days })}
              </Text>
            </View>
          )}

          {/* 버튼 */}
          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.btnSecondary} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.btnSecondaryText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnPrimary, !preview && styles.btnDisabled]}
              onPress={handleSave}
              disabled={!preview}
              activeOpacity={0.85}
            >
              <Text style={styles.btnPrimaryText}>{t('common.save')}</Text>
            </TouchableOpacity>
          </View>

          {current && (
            <TouchableOpacity onPress={handleClear} activeOpacity={0.7} style={{ marginTop: 8 }}>
              <Text style={styles.deleteLink}>{t('components.nextCheckupModal.deleteSchedule')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: COLOR.bg,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: '100%',
    backgroundColor: COLOR.card,
    borderRadius: 18,
    padding: 22,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: COLOR.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: COLOR.textSub,
    marginBottom: 16,
  },
  currentBox: {
    backgroundColor: '#FFF4ED',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FFE5D6',
  },
  currentLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLOR.accent,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  currentDate: {
    fontSize: 16,
    fontWeight: '800',
    color: COLOR.text,
    marginBottom: 2,
  },
  currentDday: {
    fontSize: 14,
    fontWeight: '900',
    color: COLOR.accent,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  inputGroup: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLOR.textSub,
    marginBottom: 4,
  },
  inputField: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLOR.border,
    backgroundColor: '#FAFAFA',
    fontSize: 18,
    fontWeight: '800',
    color: COLOR.text,
    textAlign: 'center',
  },
  previewBox: {
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  previewDate: {
    fontSize: 14,
    fontWeight: '700',
    color: COLOR.text,
    marginBottom: 4,
  },
  previewDday: {
    fontSize: 13,
    fontWeight: '800',
    color: COLOR.accent,
  },
  previewDdayPast: {
    color: COLOR.danger,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  btnSecondary: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
  },
  btnSecondaryText: {
    fontSize: 15,
    fontWeight: '800',
    color: COLOR.text,
  },
  btnPrimary: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: COLOR.accent,
    alignItems: 'center',
  },
  btnDisabled: {
    backgroundColor: '#FFC9A8',
  },
  btnPrimaryText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  deleteLink: {
    textAlign: 'center',
    fontSize: 13,
    color: COLOR.danger,
    fontWeight: '700',
    paddingVertical: 6,
  },
});
