import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  Image,
  Modal,
  ActivityIndicator,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import type { ImageSourcePropType, StyleProp, TextStyle } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { captureError } from '../../services/sentry';
import * as FileSystem from 'expo-file-system/legacy';
import { Stack } from 'expo-router';
import { BackButton } from '../../components/common/BackButton';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { GuideCarousel } from '../../components/common/GuideCarousel';
import { GuideButton } from '../../components/common/GuideButton';
import { MedicalCitation } from '../../components/common/MedicalCitation';
import { PREGNANCY_ALBUM_GUIDE } from '../../features/guide/pregnancyAlbumGuide';
import { shouldAutoShowGuide, markGuideSeen } from '../../features/guide/seen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useChildStore } from '../../stores/childStore';
import { pregnancyApi, coachingApi, uploadApi } from '../../services/api';
import { COLORS, FONT_SIZE, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { AdSlot } from '../../components/ads/AdSlot';
import { NextCheckupModal } from '../../components/home/NextCheckupModal';
import {
  getNextCheckup,
  daysUntil,
  formatDday,
  formatKoreanDate,
  useCheckupStore,
} from '../../services/checkup';

/* 임신 마일스톤·증상 이모지 → 우리 일러스트 매핑 (3D clay 통일) */
const PREG_EMOJI_ICON: Record<string, ImageSourcePropType> = {
  '🤰': require('../../assets/preg-test.png'),
  '💊': require('../../assets/quick-pill.png'),
  '🏥': require('../../assets/preg-stethoscope.png'),
  '📸': require('../../assets/preg-ultrasound.png'),
  '💓': require('../../assets/icon-heart.png'),
  '🔬': require('../../assets/preg-ultrasound.png'),
  '🌿': require('../../assets/preg-leaf.png'),
  '🌱': require('../../assets/preg-leaf.png'),
  '🧪': require('../../assets/preg-ultrasound.png'),
  '🎀': require('../../assets/preg-ribbon.png'),
  '🦶': require('../../assets/preg-foot.png'),
  '📋': require('../../assets/preg-ultrasound.png'),
  '🩸': require('../../assets/quick-blood.png'),
  '🧳': require('../../assets/preg-bag.png'),
  '📷': require('../../assets/icon-camera.png'),
  '👶': require('../../assets/quick-baby.png'),
  '🤢': require('../../assets/preg-mood-nausea.png'),
  '😴': require('../../assets/preg-mood-tired.png'),
  '🦴': require('../../assets/preg-mood-pain.png'),
  '🤕': require('../../assets/preg-mood-pain.png'),
  '🌙': require('../../assets/preg-mood-tired.png'),
  '🔥': require('../../assets/preg-mood-pain.png'),
  '😣': require('../../assets/preg-mood-pain.png'),
  '🦵': require('../../assets/preg-mood-pain.png'),
  '😢': require('../../assets/preg-mood-tired.png'),
  '🚽': require('../../assets/preg-mood-tired.png'),
  '😊': require('../../assets/preg-mood-good.png'),
  '🫠': require('../../assets/preg-mood-pain.png'),
  '😖': require('../../assets/preg-mood-pain.png'),
  '💩': require('../../assets/preg-mood-pain.png'),
  '📚': require('../../assets/preg-bag.png'),
  '📝': require('../../assets/child-diary.png'),
  '🎉': require('../../assets/preg-ribbon.png'),
  '🏠': require('../../assets/mascot-happy.png'),
  '⭐': require('../../assets/preg-ribbon.png'),
};

// 매핑되지 않은 emoji / 누락된 데이터 fallback — 안드로이드 일부 폰트에서 emoji 가
// 빈 박스로 렌더되는 케이스 방어. 항상 이미지가 보이도록 default 아이콘 사용.
const DEFAULT_PREG_ICON = require('../../assets/preg-leaf.png') as ImageSourcePropType;

function EmojiOrIcon({
  emoji,
  size,
  textStyle: _textStyle,
}: {
  emoji?: string;
  size: number;
  textStyle?: StyleProp<TextStyle>;
}) {
  const src = (emoji && PREG_EMOJI_ICON[emoji]) || DEFAULT_PREG_ICON;
  return (
    <Image
      source={src}
      style={{ width: size, height: size }}
      resizeMode="contain"
    />
  );
}

const DEFAULT_COVER_SOURCE = require('../../assets/album-cover.png') as number;

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

interface MomHealth {
  id: string;
  symptoms: string[];
  severity: number;
  memo?: string;
  week?: number;
  createdAt: string;
}

interface SymptomPreset {
  id: string;
  label: string;
  emoji: string;
}

interface TimelineWeek {
  week: number;
  items: {
    id: string;
    source: string;
    type: string;
    title: string;
    emoji?: string;
    content?: string;
    mediaUri?: string;
    mediaType?: string;
    createdAt: string;
  }[];
}

/* ================================================================== */
/*  Week-appropriate milestones                                        */
/* ================================================================== */

interface MilestoneOption {
  type: string;
  title: string;
  emoji: string;
  minWeek: number;
  maxWeek: number;
}

const ALL_MILESTONES: MilestoneOption[] = [
  { type: 'positive_test', title: '임신 테스트 양성', emoji: '🤰', minWeek: 1, maxWeek: 8 },
  { type: 'prenatal_vitamins', title: '엽산/영양제 복용 시작', emoji: '💊', minWeek: 1, maxWeek: 12 },
  { type: 'first_visit', title: '첫 산부인과 방문', emoji: '🏥', minWeek: 1, maxWeek: 10 },
  { type: 'first_ultrasound', title: '첫 초음파 확인', emoji: '📸', minWeek: 1, maxWeek: 12 },
  { type: 'first_heartbeat', title: '첫 심장소리 확인', emoji: '💓', minWeek: 6, maxWeek: 14 },
  { type: 'nt_test', title: 'NT 검사 (목투명대)', emoji: '🔬', minWeek: 11, maxWeek: 14 },
  { type: 'stable_period', title: '안정기 진입', emoji: '🌿', minWeek: 13, maxWeek: 16 },
  { type: 'quad_test', title: '쿼드 검사 완료', emoji: '🧪', minWeek: 15, maxWeek: 20 },
  { type: 'gender_reveal', title: '성별 확인', emoji: '🎀', minWeek: 16, maxWeek: 24 },
  { type: 'first_kick', title: '첫 태동 느낌', emoji: '🦶', minWeek: 16, maxWeek: 24 },
  { type: 'detailed_ultrasound', title: '정밀 초음파 완료', emoji: '📋', minWeek: 18, maxWeek: 24 },
  { type: 'name_decided', title: '이름/태명 결정', emoji: '📝', minWeek: 12, maxWeek: 40 },
  { type: 'gct_test', title: '임신성 당뇨 검사', emoji: '🩸', minWeek: 24, maxWeek: 28 },
  { type: 'nursery_start', title: '아기방 준비 시작', emoji: '🏠', minWeek: 24, maxWeek: 36 },
  { type: 'birth_class', title: '출산 준비 교실', emoji: '📚', minWeek: 28, maxWeek: 36 },
  { type: 'gbs_test', title: 'GBS 검사', emoji: '🔬', minWeek: 35, maxWeek: 37 },
  { type: 'hospital_bag', title: '출산가방 준비 완료', emoji: '🧳', minWeek: 32, maxWeek: 40 },
  { type: 'maternity_photo', title: '만삭 사진 촬영', emoji: '📷', minWeek: 32, maxWeek: 40 },
  { type: 'baby_shower', title: '베이비 샤워', emoji: '🎉', minWeek: 28, maxWeek: 38 },
  { type: 'd_day', title: '출산!', emoji: '👶', minWeek: 36, maxWeek: 42 },
];

function getMilestonesForWeek(week: number): MilestoneOption[] {
  return ALL_MILESTONES.filter((m) => week >= m.minWeek && week <= m.maxWeek);
}

/* ================================================================== */
/*  Week-appropriate questions                                         */
/* ================================================================== */

function getWeeklyQuestion(name: string, week: number, t: TFunction): { emoji: string; text: string } {
  if (week <= 6) return { emoji: '🌱', text: t('pregnancy.weeklyQuestion.week6', { name }) };
  if (week <= 10) return { emoji: '💓', text: t('pregnancy.weeklyQuestion.week10', { name }) };
  if (week <= 13) return { emoji: '🔬', text: t('pregnancy.weeklyQuestion.week13', { name }) };
  if (week <= 16) return { emoji: '🌿', text: t('pregnancy.weeklyQuestion.week16', { name }) };
  if (week <= 20) return { emoji: '🎀', text: t('pregnancy.weeklyQuestion.week20', { name }) };
  if (week <= 24) return { emoji: '🦶', text: t('pregnancy.weeklyQuestion.week24', { name }) };
  if (week <= 28) return { emoji: '📋', text: t('pregnancy.weeklyQuestion.week28', { name }) };
  if (week <= 32) return { emoji: '📚', text: t('pregnancy.weeklyQuestion.week32') };
  if (week <= 36) return { emoji: '🧳', text: t('pregnancy.weeklyQuestion.week36', { name }) };
  if (week <= 39) return { emoji: '🤰', text: t('pregnancy.weeklyQuestion.week39', { name }) };
  return { emoji: '👶', text: t('pregnancy.weeklyQuestion.week40plus', { name }) };
}

/* ================================================================== */
/*  Mom symptom presets (fallback if API fails)                        */
/* ================================================================== */

const FALLBACK_SYMPTOMS: SymptomPreset[] = [
  { id: 'morning_sickness', label: '입덧', emoji: '🤢' },
  { id: 'fatigue', label: '피로감', emoji: '😴' },
  { id: 'back_pain', label: '허리/골반 통증', emoji: '🦴' },
  { id: 'swelling', label: '부종', emoji: '🦶' },
  { id: 'headache', label: '두통', emoji: '🤕' },
  { id: 'insomnia', label: '불면', emoji: '🌙' },
  { id: 'heartburn', label: '속쓰림', emoji: '🔥' },
  { id: 'constipation', label: '변비', emoji: '😣' },
  { id: 'cramp', label: '다리 쥐남', emoji: '🦵' },
  { id: 'mood_swing', label: '감정 기복', emoji: '😢' },
  { id: 'frequent_urination', label: '빈뇨', emoji: '🚽' },
  { id: 'good', label: '컨디션 좋음', emoji: '😊' },
];

/* ================================================================== */
/*  PDF helpers (album.tsx와 동일 패턴)                                */
/* ================================================================== */

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function detectImageMime(b64: string): string {
  const h = b64.slice(0, 16);
  if (h.startsWith('/9j/')) return 'image/jpeg';
  if (h.startsWith('iVBORw0KG')) return 'image/png';
  if (h.startsWith('R0lGOD')) return 'image/gif';
  if (h.startsWith('UklGR')) return 'image/webp';
  return 'image/jpeg';
}

async function pregUriToDataUri(uri: string): Promise<string> {
  try {
    if (uri.startsWith('http://') || uri.startsWith('https://')) {
      const cacheUri =
        FileSystem.cacheDirectory +
        'preg_img_' +
        Math.random().toString(36).slice(2) +
        '.bin';
      const dl = await FileSystem.downloadAsync(uri, cacheUri);
      const b64 = await FileSystem.readAsStringAsync(dl.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return `data:${detectImageMime(b64)};base64,${b64}`;
    } else {
      const b64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return `data:${detectImageMime(b64)};base64,${b64}`;
    }
  } catch {
    return uri;
  }
}

interface PregAlbumPhoto {
  uri: string;
  date: string;
  title: string;
  memo?: string;
  /** 마일스톤 이모지 (PDF 에서 아이콘 배지로 렌더) */
  milestoneEmoji?: string;
  /** 마일스톤 타입 — 색상 매핑용 */
  milestoneType?: string;
}

function generatePregnancyAlbumHTML(
  photos: PregAlbumPhoto[],
  title: string,
  childName: string,
  dateFrom: string,
  dateTo: string,
  coverUri: string | null,
  t: TFunction,
): string {
  const sorted = [...photos].sort((a, b) => a.date.localeCompare(b.date));

  const monthsMap = new Map<string, PregAlbumPhoto[]>();
  for (const p of sorted) {
    const ym = p.date.slice(0, 7);
    if (!monthsMap.has(ym)) monthsMap.set(ym, []);
    monthsMap.get(ym)!.push(p);
  }
  const months = Array.from(monthsMap.entries());

  const totalPhotoPages = months.reduce(
    (acc, [, ps]) => acc + Math.ceil(ps.length / 4),
    0,
  );

  const cornerDeco =
    `<div class="page-corner tl">&#10084;</div>` +
    `<div class="page-corner tr">&#127800;</div>` +
    `<div class="page-corner bl">&#127801;</div>` +
    `<div class="page-corner br">&#10024;</div>`;

  const effectiveCoverUri = coverUri;

  const coverHTML = effectiveCoverUri
    ? `<div class="cover cover-img">` +
      `<img src="${effectiveCoverUri}" alt="" width="1123" height="794" class="cover-bg-img" />` +
      `<div class="cover-name-natural">${escapeHtml(childName)}</div>` +
      `<div class="cover-period-natural">${escapeHtml(dateFrom)} ~ ${escapeHtml(dateTo)}</div>` +
      `</div>`
    : `<div class="cover cover-gradient">` +
      `<div class="cover-star">&#10084;</div>` +
      `<div class="cover-line"></div>` +
      `<div class="cover-title">${escapeHtml(title)}</div>` +
      `<div class="cover-period-alt">${escapeHtml(dateFrom)} ~ ${escapeHtml(dateTo)}</div>` +
      `<div class="cover-line"></div>` +
      `<div class="cover-count">${escapeHtml(t('pregnancy.pdf.coverCount', { count: sorted.length }))}</div>` +
      `</div>`;

  let pageCounter = 0;
  const allPagesHTML = months
    .map(([ym, ps]) => {
      const [y, m] = ym.split('-');
      const monthNum = parseInt(m, 10);

      const dividerHTML =
        `<div class="divider-page">` +
        cornerDeco +
        `<div class="divider-inner">` +
        `<div class="divider-deco">&#10047;</div>` +
        `<div class="divider-year">${y}</div>` +
        `<div class="divider-month">${monthNum}<span class="divider-month-unit">${escapeHtml(t('pregnancy.pdf.monthUnit'))}</span></div>` +
        `<div class="divider-rule"></div>` +
        `<div class="divider-caption">&#10084; ${escapeHtml(t('pregnancy.pdf.dividerCaption', { count: ps.length }))} &#10084;</div>` +
        `</div></div>`;

      const photoPagesHTML: string[] = [];
      for (let i = 0; i < ps.length; i += 4) {
        const chunk = ps.slice(i, i + 4);
        pageCounter += 1;
        const cellsHTML = chunk
          .map((photo) => {
            // 마일스톤 아이콘 배지 — 이모지를 컬러 원형 배지로 표시 (PNG 없이 시각적 구분)
            const emoji = photo.milestoneEmoji ?? '';
            const badgeHTML = emoji
              ? `<div class="ms-icon-badge">${emoji}</div>`
              : `<div class="ms-icon-badge ms-icon-default">&#10084;</div>`;
            const titleHTML = photo.title
              ? `<div class="ms-row">${badgeHTML}<span class="ms-label">${escapeHtml(photo.title)}</span></div>`
              : '';
            const memoHTML = photo.memo
              ? `<div class="photo-memo">${escapeHtml(photo.memo)}</div>`
              : '';
            // 사진 변환 실패 시 placeholder 박스 — PDF 는 항상 생성, 정보는 모두 보존
            const imageBlock = photo.uri
              ? `<div class="photo-img-wrap">` +
                `<img class="photo-img-bg" src="${photo.uri}" alt="" />` +
                `<img class="photo-img" src="${photo.uri}" alt="" />` +
                `</div>`
              : `<div class="photo-img-wrap photo-img-placeholder">` +
                `<div class="placeholder-icon">📷</div>` +
                `<div class="placeholder-text">${escapeHtml(t('pregnancy.pdf.imageLoadFailed'))}</div>` +
                `</div>`;
            return (
              `<div class="photo-cell">` +
              imageBlock +
              `<div class="photo-caption">` +
              `<div class="photo-date">${escapeHtml(photo.date)}</div>` +
              titleHTML +
              memoHTML +
              `</div></div>`
            );
          })
          .join('');
        const emptyCount = 4 - chunk.length;
        const emptyCells = Array(emptyCount)
          .fill('<div class="photo-cell photo-cell-empty"></div>')
          .join('');
        photoPagesHTML.push(
          `<div class="photo-page">` +
            cornerDeco +
            `<div class="page-header">${escapeHtml(t('pregnancy.pdf.pageHeaderMonth', { month: monthNum }))} &middot; ${pageCounter} / ${totalPhotoPages}</div>` +
            `<div class="photo-grid">${cellsHTML}${emptyCells}</div>` +
            `</div>`,
        );
      }
      return dividerHTML + photoPagesHTML.join('');
    })
    .join('');

  const endingHTML =
    `<div class="ending-page">` +
    cornerDeco +
    `<div class="ending-heart">&#10084;</div>` +
    `<div class="ending-msg">${escapeHtml(t('pregnancy.pdf.endingMessage', { name: childName })).replace(/\n/g, '<br/>')}</div>` +
    `<div class="ending-rule"></div>` +
    `<div class="ending-sub">${escapeHtml(t('pregnancy.pdf.endingSub')).replace(/\n/g, '<br/>')}</div>` +
    `<div class="ending-period">${escapeHtml(dateFrom)} ~ ${escapeHtml(dateTo)}</div>` +
    `</div>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Jua&family=Gaegu:wght@700&family=Do+Hyeon&family=Single+Day&family=Black+Han+Sans&display=swap" rel="stylesheet">
  <style>
    @page { size: A4 landscape; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Jua', 'Do Hyeon', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; font-weight: 400; }
    html, body { background-color: #FFF0F5; }
    .cover { width: 297mm; height: 210mm; page-break-after: always; overflow: hidden; position: relative; background-color: #FFF0F5; }
    .cover-img { display: block; background-color: #FFF0F5; }
    .cover-bg-img { display: block; width: 297mm; height: 210mm; object-fit: cover; -o-object-fit: cover; }
    .cover-name-natural { position: absolute; right: 7mm; width: 130mm; top: 23%; text-align: center; font-family: 'Single Day', 'Gaegu', cursive; font-size: 33px; color: #3A2018; letter-spacing: 3px; }
    .cover-period-natural { position: absolute; right: 5mm; width: 130mm; top: 62%; text-align: center; font-family: 'Gaegu', cursive; font-size: 18px; color: #6B4030; letter-spacing: 1px; }
    .cover-gradient { background: linear-gradient(135deg, #FCE4EC 0%, #F8BBD0 50%, #FFF0F5 100%); display: flex; flex-direction: column; align-items: center; justify-content: center; }
    .cover-star { font-size: 64px; margin-bottom: 20px; }
    .cover-line { width: 70px; height: 3px; background: #E91E63; margin: 16px auto; border-radius: 2px; }
    .cover-title { font-family: 'Single Day', 'Gaegu', cursive; font-size: 52px; color: #4A1529; text-align: center; padding: 0 30mm; line-height: 1.3; }
    .cover-period-alt { font-family: 'Gaegu', cursive; font-size: 22px; color: #8B3050; margin-top: 10px; }
    .cover-count { font-family: 'Gaegu', cursive; font-size: 18px; color: #C2185B; margin-top: 10px; }
    .page-corner { position: absolute; font-size: 22px; opacity: 0.55; z-index: 3; pointer-events: none; }
    .page-corner.tl { top: 6mm; left: 7mm; }
    .page-corner.tr { top: 6mm; right: 7mm; }
    .page-corner.bl { bottom: 6mm; left: 7mm; }
    .page-corner.br { bottom: 6mm; right: 7mm; }
    .divider-page { width: 297mm; height: 210mm; page-break-after: always; position: relative; display: flex; align-items: center; justify-content: center; background-color: #FFF0F5; background-image: linear-gradient(135deg, #FCE4EC 0%, #FFF0F5 40%, #F8BBD0 100%); overflow: hidden; }
    .divider-inner { text-align: center; }
    .divider-deco { font-size: 34px; color: #E91E63; margin-bottom: 8mm; }
    .divider-year { font-family: 'Gaegu', cursive; font-size: 32px; color: #8B3050; letter-spacing: 6px; margin-bottom: 4mm; }
    .divider-month { font-family: 'Black Han Sans', 'Do Hyeon', sans-serif; font-size: 180px; color: #C2185B; line-height: 1; letter-spacing: -4px; }
    .divider-month-unit { font-family: 'Jua', sans-serif; font-size: 56px; color: #E91E63; margin-left: 8px; }
    .divider-rule { width: 90mm; height: 2px; background: linear-gradient(90deg, transparent, #E91E63, transparent); margin: 10mm auto 6mm; }
    .divider-caption { font-family: 'Gaegu', cursive; font-size: 22px; color: #8B3050; }
    .photo-page { width: 297mm; height: 210mm; padding: 14mm 14mm 12mm; page-break-after: always; display: flex; flex-direction: column; background-color: #FFF0F5; background-image: linear-gradient(135deg, #FCE4EC 0%, #FFF0F5 30%, #FFF5F8 60%, #FCE4EC 100%); overflow: hidden; position: relative; }
    .page-header { font-family: 'Gaegu', cursive; font-size: 15px; color: #C2185B; text-align: right; margin-bottom: 5mm; flex-shrink: 0; letter-spacing: 2px; }
    .photo-grid { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 7mm; flex: 1; min-height: 0; }
    .photo-cell { background: #FFFFFF; padding: 3mm 3mm 2mm 3mm; box-shadow: 0 3px 10px rgba(180,60,90,0.18), 0 0 0 0.3mm #FCE4EC; display: grid; grid-template-rows: 1fr auto; gap: 2mm; min-height: 0; overflow: hidden; border-radius: 2px; position: relative; }
    .photo-grid > .photo-cell:nth-child(1) { transform: rotate(-0.8deg); }
    .photo-grid > .photo-cell:nth-child(2) { transform: rotate(0.7deg); }
    .photo-grid > .photo-cell:nth-child(3) { transform: rotate(0.6deg); }
    .photo-grid > .photo-cell:nth-child(4) { transform: rotate(-0.7deg); }
    .photo-cell::before { content: ''; position: absolute; top: -2mm; left: 50%; transform: translateX(-50%) rotate(-3deg); width: 42mm; height: 7mm; background: linear-gradient(135deg, rgba(255,182,193,0.7), rgba(255,105,135,0.5)); box-shadow: 0 1px 2px rgba(0,0,0,0.08); z-index: 2; pointer-events: none; }
    .photo-cell-empty { background: transparent !important; box-shadow: none !important; padding: 0 !important; border: none !important; transform: none !important; }
    .photo-cell-empty::before { display: none !important; }
    .photo-img-wrap { width: 100%; min-height: 0; background: #F9EEF2; overflow: hidden; position: relative; border-radius: 1px; }
    .photo-img-bg { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; filter: blur(14px) brightness(0.92); transform: scale(1.1); opacity: 0.55; display: block; }
    .photo-img { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: contain; display: block; z-index: 1; }
    .photo-caption { padding: 0 1mm; display: flex; flex-direction: column; gap: 2mm; min-height: 0; max-height: 22mm; overflow: hidden; }
    .photo-date { font-family: 'Jua', sans-serif; font-size: 13px; color: #9E7080; letter-spacing: 0.5px; }
    .ms-row { display: flex; align-items: center; gap: 6px; min-height: 0; }
    .ms-label { font-family: 'Do Hyeon', 'Jua', sans-serif; font-size: 15px; color: #C2185B; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
    .ms-icon-badge { width: 22px; height: 22px; border-radius: 11px; background: #FFE3F1; display: inline-flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; line-height: 1; }
    .ms-icon-default { color: #FF6BA9; }
    .photo-memo { font-family: 'Single Day', 'Gaegu', 'Jua', cursive; font-size: 18px; color: #3A1525; line-height: 1.25; text-shadow: 0.4px 0 0 currentColor, -0.4px 0 0 currentColor, 0 0.4px 0 currentColor; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
    .ending-page { width: 297mm; height: 210mm; page-break-after: always; position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; background-color: #FFF0F5; background-image: linear-gradient(135deg, #FCE4EC 0%, #FFF0F5 40%, #F8BBD0 100%); overflow: hidden; }
    .ending-heart { font-size: 88px; margin-bottom: 10mm; }
    .ending-msg { font-family: 'Single Day', 'Gaegu', cursive; font-size: 64px; color: #C2185B; text-align: center; line-height: 1.4; text-shadow: 0.5px 0 0 currentColor, -0.5px 0 0 currentColor; }
    .ending-rule { width: 90mm; height: 2px; background: linear-gradient(90deg, transparent, #E91E63, transparent); margin: 8mm auto; }
    .ending-sub { font-family: 'Gaegu', 'Jua', cursive; font-size: 24px; color: #8B3050; text-align: center; line-height: 1.6; }
    .ending-period { font-family: 'Gaegu', cursive; font-size: 16px; color: #9E7080; margin-top: 5mm; }
  </style>
</head>
<body>
${coverHTML}
${allPagesHTML}
${endingHTML}
</body>
</html>`;
}

/* ================================================================== */
/*  NextCheckupSection — 다음 검진 일정 (AsyncStorage 기반)            */
/*  PDF 앨범 출력엔 포함 안 됨 (PDF는 albumPhotos만 봄)                 */
/* ================================================================== */

function NextCheckupSection({ childId }: { childId: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [iso, setIso] = useState<string | null>(null);
  const ver = useCheckupStore((s) => s.version);

  useEffect(() => {
    let cancelled = false;
    if (!childId) {
      setIso(null);
      return;
    }
    (async () => {
      const v = await getNextCheckup(childId);
      if (!cancelled) setIso(v);
    })();
    return () => { cancelled = true; };
  }, [childId, ver]);

  const days = iso ? daysUntil(iso) : null;
  const dday = days != null ? formatDday(days) : null;

  return (
    <>
      <TouchableOpacity
        style={checkupStyles.row}
        onPress={() => setOpen(true)}
        activeOpacity={0.85}
      >
        <EmojiOrIcon emoji={'🏥'} size={26} textStyle={checkupStyles.icon} />
        <View style={{ flex: 1 }}>
          <Text style={checkupStyles.label}>{t('pregnancy.nextCheckupLabel')}</Text>
          {iso ? (
            <Text style={checkupStyles.value}>
              {formatKoreanDate(iso)}
              <Text style={checkupStyles.dday}>{`  ${dday}`}</Text>
            </Text>
          ) : (
            <Text style={checkupStyles.placeholder}>{t('pregnancy.tapToRegisterHint')}</Text>
          )}
        </View>
        <Text style={checkupStyles.arrow}>{'>'}</Text>
      </TouchableOpacity>

      <NextCheckupModal
        visible={open}
        onClose={() => setOpen(false)}
        childId={childId}
        current={iso}
      />
    </>
  );
}

const checkupStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF4ED',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#FFE5D6',
    gap: 12,
  },
  icon: { fontSize: 22 },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FF8C5A',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  dday: {
    color: '#FF8C5A',
    fontWeight: '700',
  },
  placeholder: {
    fontSize: 13,
    color: '#636366',
    fontWeight: '600',
  },
  arrow: {
    fontSize: 18,
    color: '#ABABAB',
    fontWeight: '700',
  },
});

/* ================================================================== */
/*  Main Screen                                                        */
/* ================================================================== */

export default function PregnancyScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const child = useChildStore((s) => s.selectedChild);
  const childId = child?.id ?? '';
  const currentWeek = child?.pregnancyWeeks ?? 0;
  const childName = child?.name ?? t('pregnancy.defaultChildName');

  const [refreshing, setRefreshing] = useState(false);

  // 사용 가이드 (첫 진입 1회 자동표시 + ? 버튼 재열람)
  const [guideVisible, setGuideVisible] = useState(false);
  useEffect(() => {
    shouldAutoShowGuide('pregnancy_album').then((sh) => { if (sh) setGuideVisible(true); });
  }, []);
  const closeGuide = () => { setGuideVisible(false); markGuideSeen('pregnancy_album'); };

  // Timeline
  const [timeline, setTimeline] = useState<TimelineWeek[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [timelineError, setTimelineError] = useState(false);

  // Record creation modal
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [doctorNote, setDoctorNote] = useState('');
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'photo' | 'video'>('photo');
  const [selectedMilestones, setSelectedMilestones] = useState<string[]>([]);

  // Mom health fields
  const [symptomPresets, setSymptomPresets] = useState<SymptomPreset[]>(FALLBACK_SYMPTOMS);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [severity, setSeverity] = useState(3);
  const [healthMemo, setHealthMemo] = useState('');

  // Health history
  const [healthHistory, setHealthHistory] = useState<MomHealth[]>([]);

  // === 인라인 compose (성장앨범 BabyAlbum과 동일한 UX — 한 번 저장 = 한 카드) ===
  const [composePhoto, setComposePhoto] = useState<string | null>(null);
  const [composeMemo, setComposeMemo] = useState('');
  const [composeMilestoneChip, setComposeMilestoneChip] = useState<
    { id: string; label: string; emoji: string } | null
  >(null);
  const [composeSymptomChip, setComposeSymptomChip] = useState<
    { id: string; label: string; emoji: string } | null
  >(null);
  const [shareToFamily, setShareToFamily] = useState(false);

  // 임신앨범 PDF 생성 폼
  const [albumTitle, setAlbumTitle] = useState('');
  const [albumDateFrom, setAlbumDateFrom] = useState('');
  const [albumDateTo, setAlbumDateTo] = useState('');
  const [albumCoverUri, setAlbumCoverUri] = useState<string | null>(null);
  const [showAlbumForm, setShowAlbumForm] = useState(false);
  const [albumGenerating, setAlbumGenerating] = useState(false);

  // 기록 수정 모달
  const [editingItem, setEditingItem] = useState<{
    id: string;
    source: string;
    title: string;
    content?: string;
    emoji?: string;
    mediaUri?: string; // 현재 이미지 URI
  } | null>(null);
  const [editMemo, setEditMemo] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editNewImage, setEditNewImage] = useState<string | null>(null);

  // AI 일기 (성장앨범과 동일)
  const [diaryText, setDiaryText] = useState<string | null>(null);
  const [diaryDate, setDiaryDate] = useState<string | null>(null);
  const [diaryLoading, setDiaryLoading] = useState(false);

  // 인라인 compose: 사진 picker
  const composePickPhoto = useCallback(async () => {
    try {
      const ImagePicker = await import('expo-image-picker');
      // Photo Picker 사용 — 미디어 권한 요청 불필요 (Google Play 정책 준수)
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.85,
        allowsEditing: true,
        aspect: [4, 3],
      });
      if (!result.canceled && result.assets[0]) {
        setComposePhoto(result.assets[0].uri);
      }
    } catch {
      Alert.alert(t('common.error'), t('pregnancy.photoLoadFailed'));
    }
  }, [t]);

  const generateDiary = useCallback(async () => {
    if (!childId) return;
    setDiaryLoading(true);
    try {
      const res = await coachingApi.dailyDiary(childId);
      const data = res.data?.data as { diary?: string; date?: string } | undefined;
      if (data?.diary) {
        setDiaryText(data.diary);
        setDiaryDate(data.date ?? new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10));
      } else {
        Alert.alert(t('common.notice'), t('pregnancy.diaryNoRecordToday'));
      }
    } catch {
      Alert.alert(t('common.error'), t('pregnancy.diaryGenerateFailed'));
    } finally {
      setDiaryLoading(false);
    }
  }, [childId, t]);

  /* ── 앨범 표지 이미지 선택 ── */
  const pickCoverImage = useCallback(async () => {
    try {
      const ImagePicker = await import('expo-image-picker');
      // Photo Picker 사용 — 미디어 권한 요청 불필요 (Google Play 정책 준수)
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.85,
        allowsEditing: true,
        aspect: [3, 2],
      });
      if (!result.canceled && result.assets[0]) {
        setAlbumCoverUri(result.assets[0].uri);
      }
    } catch {
      Alert.alert(t('common.error'), t('pregnancy.photoLoadFailed'));
    }
  }, [t]);

  /* ── 임신앨범 PDF 생성 ── */
  const handleGeneratePregnancyAlbum = useCallback(async () => {
    if (!albumDateFrom || !albumDateTo) return;
    setAlbumGenerating(true);
    try {
      const fromYM = albumDateFrom.slice(0, 7);
      const toYM = albumDateTo.slice(0, 7);

      // 사진 있는 항목만 필터링 (source !== 'development')
      const filtered = timeline
        .flatMap((wg) =>
          wg.items.filter(
            (it) =>
              it.source !== 'development' &&
              !!it.mediaUri &&
              it.mediaType !== 'video',
          ),
        )
        .filter((it) => {
          const ym = it.createdAt.slice(0, 7);
          return ym >= fromYM && ym <= toYM;
        })
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

      if (filtered.length === 0) {
        Alert.alert(t('pregnancy.noPhotos'), t('pregnancy.noPhotosInPeriod'));
        return;
      }

      const title =
        albumTitle.trim() ||
        t('pregnancy.albumDefaultTitleWithRange', { name: childName, from: albumDateFrom, to: albumDateTo });

      // 이미지 → base64 변환. 변환 실패 시 PDF 에 빈 이미지로 들어가지 않도록 skip.
      // 옛 글의 file:// 임시 경로는 시간 지나면 invalid (expo-image-picker 임시 파일 삭제) →
      // 변환 실패하는 케이스가 다수.
      // 이미지 변환 — 실패 시 빈 uri 로 placeholder 처리(PDF 는 항상 생성).
      // 사진을 못 불러와도 제목/날짜/메모는 PDF 에 남기고, 사진 영역은 안내 박스로 표시.
      let failCount = 0;
      const photosForPdf: PregAlbumPhoto[] = await Promise.all(
        filtered.map(async (it): Promise<PregAlbumPhoto> => {
          const converted = await pregUriToDataUri(it.mediaUri!);
          const ok = converted.startsWith('data:');
          if (!ok) failCount += 1;
          // 마일스톤 정보 추출 — 저장된 milestoneEmoji 우선, 없으면 milestoneType 으로 lookup
          const itAny = it as unknown as { milestoneEmoji?: string; milestoneType?: string };
          let emoji = itAny.milestoneEmoji;
          if (!emoji && itAny.milestoneType) {
            const ms = ALL_MILESTONES.find((m) => m.type === itAny.milestoneType);
            if (ms) emoji = ms.emoji;
          }
          return {
            uri: ok ? converted : '',
            date: it.createdAt.slice(0, 10),
            title: it.title,
            memo: it.content,
            milestoneEmoji: emoji,
            milestoneType: itAny.milestoneType,
          };
        }),
      );

      let coverDataUri: string | null = null;
      if (albumCoverUri) {
        const raw = await pregUriToDataUri(albumCoverUri);
        if (raw.startsWith('data:')) coverDataUri = raw;
      } else {
        // 사용자가 표지를 바꾸지 않은 경우 기본 표지(album-cover.png) 사용
        try {
          const { Asset } = await import('expo-asset');
          const asset = await Asset.fromModule(DEFAULT_COVER_SOURCE).downloadAsync();
          if (asset.localUri) {
            const raw = await pregUriToDataUri(asset.localUri);
            if (raw.startsWith('data:')) coverDataUri = raw;
          }
        } catch { /* 변환 실패 시 gradient 표지로 fallback */ }
      }

      const html = generatePregnancyAlbumHTML(
        photosForPdf,
        title,
        childName,
        albumDateFrom,
        albumDateTo,
        coverDataUri,
        t,
      );
      const printPromise = Print.printToFileAsync({ html, base64: false });
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(t('pregnancy.pdfGenerateTimeout'))),
          90_000,
        ),
      );
      const { uri } = await Promise.race([printPromise, timeoutPromise]);

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: t('pregnancy.albumSaveDialogTitle'),
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert(t('pregnancy.saveComplete'), t('pregnancy.albumPdfGenerated', { uri }));
      }
      if (failCount > 0) {
        Alert.alert(
          t('pregnancy.somePhotosMissing'),
          t('pregnancy.somePhotosMissingBody', { total: filtered.length, failCount }),
        );
      }
      setShowAlbumForm(false);
      setAlbumTitle('');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert(t('common.error'), t('pregnancy.albumGenerateFailed', { msg }));
    } finally {
      setAlbumGenerating(false);
    }
  }, [albumDateFrom, albumDateTo, albumTitle, albumCoverUri, timeline, childName, t]);

  /* ── Load data ── */
  const loadTimeline = useCallback(async () => {
    if (!childId) return;
    setLoadingTimeline(true);
    setTimelineError(false);
    try {
      const res = await pregnancyApi.getTimeline(childId);
      setTimeline(res.data.data ?? []);
    } catch (e) {
      // 로드 실패를 빈 화면으로 위장하지 않고 명시 + 재시도 제공
      captureError(e, { ctx: 'pregnancy/loadTimeline', childId });
      setTimelineError(true);
    }
    setLoadingTimeline(false);
  }, [childId]);

  const loadHealth = useCallback(async () => {
    if (!childId) return;
    try {
      const [presetsRes, historyRes] = await Promise.all([
        pregnancyApi.getSymptomPresets(),
        pregnancyApi.getMomHealth(childId),
      ]);
      const presets = presetsRes.data.data;
      if (Array.isArray(presets) && presets.length > 0) setSymptomPresets(presets);
      setHealthHistory(historyRes.data.data ?? []);
    } catch { /* silent — fallback presets already set */ }
  }, [childId]);

  // 인라인 compose: 한 번 저장 = 한 카드 (성장앨범과 동일)
  const handleSaveUnified = useCallback(async () => {
    if (!childId) return;
    if (!composePhoto && !composeMemo.trim() && !composeMilestoneChip && !composeSymptomChip) {
      Alert.alert(t('common.notice'), t('pregnancy.composeEmptyInput'));
      return;
    }
    setSaving(true);
    try {
      // 사진은 반드시 Firebase Storage 에 업로드 후 https URL 로 저장 — 영구 보존 보장.
      // file:// 로컬 URI 폴백 절대 안 함 (시간 지나면 OS 임시 캐시 정리로 invalid → PDF·피드 깨짐).
      // 업로드 실패 시 retry 3 회 → 그래도 실패하면 사용자에게 명확한 안내 + 글 저장 보류.
      let uploadedUri: string | undefined;
      if (composePhoto) {
        let lastErr: unknown = null;
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            const uploaded = await uploadApi.upload(composePhoto, 'pregnancy');
            uploadedUri = uploaded.url;
            lastErr = null;
            break;
          } catch (err) {
            lastErr = err;
            if (attempt < 3) {
              // 지수 백오프 — 1초, 2초
              await new Promise((r) => setTimeout(r, attempt * 1000));
            }
          }
        }
        if (!uploadedUri) {
          // 3 회 모두 실패 → 글 저장 거부. file:// 폴백 시 시간 지나면 사진 사라짐 → 출시 차단.
          captureError(lastErr instanceof Error ? lastErr : new Error('upload failed'), {
            ctx: 'pregnancy/upload-failed-3x',
            childId,
          });
          Alert.alert(
            t('pregnancy.photoUploadFailed'),
            t('pregnancy.photoUploadFailedBody'),
          );
          setSaving(false);
          return;
        }
      }

      // 마일스톤 우선, 없으면 엄마기분, 없으면 doctor_note — 항상 1개만 저장
      if (composeMilestoneChip) {
        const ms = ALL_MILESTONES.find((m) => m.type === composeMilestoneChip.id);
        const symptomNote = composeSymptomChip ? `[엄마기분: ${composeSymptomChip.label}]` : '';
        const content = [composeMemo.trim(), symptomNote].filter(Boolean).join('\n') || undefined;
        await pregnancyApi.createRecord({
          childId,
          type: 'milestone',
          milestoneType: composeMilestoneChip.id,
          milestoneEmoji: ms?.emoji ?? composeMilestoneChip.emoji,
          title: ms?.title ?? composeMilestoneChip.label,
          content,
          mediaUri: uploadedUri,
          mediaType: uploadedUri ? 'photo' : undefined,
          week: currentWeek,
          shareToFamily,
        });
      } else if (composeSymptomChip) {
        await pregnancyApi.createRecord({
          childId,
          type: 'doctor_note',
          milestoneEmoji: composeSymptomChip.emoji,
          title: composeSymptomChip.label,
          content: composeMemo.trim() || undefined,
          mediaUri: uploadedUri,
          mediaType: uploadedUri ? 'photo' : undefined,
          week: currentWeek,
          shareToFamily,
        });
      } else {
        await pregnancyApi.createRecord({
          childId,
          type: 'doctor_note',
          title: uploadedUri ? '초음파/영상' : '진료 기록',
          content: composeMemo.trim() || undefined,
          mediaUri: uploadedUri,
          mediaType: uploadedUri ? 'photo' : undefined,
          week: currentWeek,
          shareToFamily,
        });
      }
      setComposePhoto(null);
      setComposeMemo('');
      setComposeMilestoneChip(null);
      setComposeSymptomChip(null);
      setShareToFamily(false);
      await Promise.all([loadTimeline(), loadHealth()]);
    } catch {
      Alert.alert(t('common.error'), t('pregnancy.saveFailed'));
    } finally {
      setSaving(false);
    }
  }, [childId, composePhoto, composeMemo, composeMilestoneChip, composeSymptomChip, currentWeek, loadTimeline, loadHealth, shareToFamily, t]);

  useEffect(() => {
    loadTimeline();
    loadHealth();
  }, [loadTimeline, loadHealth]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadTimeline(), loadHealth()]);
    setRefreshing(false);
  };

  // 사용자 기록(development 자동항목 제외)만 — 빈 상태 판정/피드의 공통 기준
  const userTimelineItems = timeline
    .flatMap((wg) => wg.items.filter((it) => it.source !== 'development'))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  /* ── Image picker (camera or gallery) ── */
  const launchPicker = async (mode: 'camera' | 'gallery') => {
    try {
      const ImagePicker = await import('expo-image-picker');
      if (mode === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(t('pregnancy.permissionNeeded'), t('pregnancy.cameraPermissionRequest'));
          return;
        }
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images', 'videos'],
          quality: 0.8,
        });
        if (!result.canceled && result.assets[0]) {
          const asset = result.assets[0];
          setMediaUri(asset.uri);
          setMediaType(asset.type === 'video' ? 'video' : 'photo');
        }
      } else {
        // Photo Picker 사용 — 미디어 권한 요청 불필요 (Google Play 정책 준수)
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images', 'videos'],
          quality: 0.8,
          allowsEditing: false,
        });
        if (!result.canceled && result.assets[0]) {
          const asset = result.assets[0];
          setMediaUri(asset.uri);
          setMediaType(asset.type === 'video' ? 'video' : 'photo');
        }
      }
    } catch {
      Alert.alert(t('common.error'), t('pregnancy.mediaLoadFailed'));
    }
  };

  const pickImage = () => {
    Alert.alert(t('pregnancy.addPhotoVideo'), t('pregnancy.howToAdd'), [
      { text: t('pregnancy.takePhoto'), onPress: () => launchPicker('camera') },
      { text: t('pregnancy.chooseFromAlbum'), onPress: () => launchPicker('gallery') },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  /* ── Save unified record ── */
  const handleSave = async () => {
    if (!childId) return;

    const hasDoctorNote = doctorNote.trim().length > 0;
    const hasMedia = !!mediaUri;
    const hasMilestones = selectedMilestones.length > 0;
    const hasHealth = selectedSymptoms.length > 0 || healthMemo.trim().length > 0;

    if (!hasDoctorNote && !hasMedia && !hasMilestones && !hasHealth) {
      Alert.alert(t('common.notice'), t('pregnancy.atLeastOneItem'));
      return;
    }

    setSaving(true);
    try {
      const promises: Promise<unknown>[] = [];

      // 1. Doctor note record
      if (hasDoctorNote || hasMedia) {
        promises.push(
          pregnancyApi.createRecord({
            childId,
            type: 'doctor_note',
            title: hasDoctorNote ? '진료 기록' : '초음파/영상',
            content: doctorNote.trim() || undefined,
            mediaUri: mediaUri ?? undefined,
            mediaType: hasMedia ? mediaType : undefined,
            week: currentWeek,
          }),
        );
      }

      // 2. Milestones
      for (const msType of selectedMilestones) {
        const ms = ALL_MILESTONES.find((m) => m.type === msType);
        if (ms) {
          promises.push(
            pregnancyApi.createRecord({
              childId,
              type: 'milestone',
              milestoneType: ms.type,
              title: ms.title,
              week: currentWeek,
            }),
          );
        }
      }

      // 3. Mom health
      if (hasHealth) {
        promises.push(
          pregnancyApi.saveMomHealth({
            childId,
            symptoms: selectedSymptoms,
            severity,
            memo: healthMemo.trim() || undefined,
          }),
        );
      }

      await Promise.all(promises);

      // Reset form
      setDoctorNote('');
      setMediaUri(null);
      setSelectedMilestones([]);
      setSelectedSymptoms([]);
      setSeverity(3);
      setHealthMemo('');
      setShowModal(false);

      loadTimeline();
      loadHealth();
    } catch {
      Alert.alert(t('common.error'), t('pregnancy.recordSaveFailed'));
    }
    setSaving(false);
  };

  /* ── 수정 저장 ── */
  const handleEditSave = useCallback(async () => {
    if (!editingItem) return;
    setEditSaving(true);
    try {
      let newUri: string | undefined;
      if (editNewImage) {
        const { uploadApi } = await import('../../services/api');
        const uploaded = await uploadApi.upload(editNewImage, 'pregnancy');
        newUri = uploaded.url;
        setEditNewImage(null);
      }
      await pregnancyApi.updateRecord(editingItem.id, {
        content: editMemo.trim() || undefined,
        uri: newUri,
      });
      setEditingItem(null);
      loadTimeline();
    } catch {
      Alert.alert(t('common.error'), t('pregnancy.editFailed'));
    } finally {
      setEditSaving(false);
    }
  }, [editingItem, editMemo, editNewImage, loadTimeline, t]);

  const pickEditImage = useCallback(async () => {
    try {
      const ImagePicker = await import('expo-image-picker');
      // Photo Picker 사용 — 미디어 권한 요청 불필요 (Google Play 정책 준수)
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85, allowsEditing: true, aspect: [4, 3] });
      if (!result.canceled && result.assets[0]) setEditNewImage(result.assets[0].uri);
    } catch { Alert.alert(t('common.error'), t('pregnancy.photoLoadFailed')); }
  }, [t]);

  /* ── 길게 누르기 → 수정/삭제 ── */
  const handleLongPress = (item: { id: string; source: string; title: string; content?: string; emoji?: string; mediaUri?: string }) => {
    if (item.id.startsWith('dev-')) return;
    const canEdit = item.source !== 'health';
    const buttons: import('react-native').AlertButton[] = [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            if (item.source === 'health') {
              await pregnancyApi.deleteMomHealth(item.id);
            } else {
              await pregnancyApi.deleteRecord(item.id);
            }
            loadTimeline();
          } catch {
            Alert.alert(t('common.error'), t('pregnancy.deleteFailed'));
          }
        },
      },
    ];
    if (canEdit) {
      buttons.unshift({
        text: t('common.edit'),
        onPress: () => {
          setEditNewImage(null);
          setEditingItem(item);
          setEditMemo(item.content ?? '');
        },
      });
    }
    Alert.alert(t('pregnancy.recordManage'), item.title, buttons);
  };

  const toggleSymptom = (sid: string) => {
    setSelectedSymptoms((prev) =>
      prev.includes(sid) ? prev.filter((s) => s !== sid) : [...prev, sid],
    );
  };

  const toggleMilestone = (msType: string) => {
    setSelectedMilestones((prev) =>
      prev.includes(msType) ? prev.filter((m) => m !== msType) : [...prev, msType],
    );
  };

  if (!child?.isPregnant) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: t('pregnancy.screenTitle') }} />
        <View style={styles.emptyCenter}>
          <Text style={styles.emptyText}>{t('pregnancy.selectPregnantChild')}</Text>
        </View>
      </View>
    );
  }

  const weekQuestion = getWeeklyQuestion(childName, currentWeek, t);
  const availableMilestones = getMilestonesForWeek(currentWeek);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScreenHeader title={t('pregnancy.screenTitle')} right={<GuideButton onPress={() => setGuideVisible(true)} color="#E91E63" />} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 부제목 (제목은 ScreenHeader로 이동) ── */}
        <Text style={styles.albumChildLabel}>{t('pregnancy.childAlbumLabel', { name: childName })}</Text>

        {/* ── 현재 임신 주차 배지 (성장앨범 currentBadge와 동일) ── */}
        {currentWeek > 0 && (
          <View style={styles.currentBadge}>
            <EmojiOrIcon emoji={'🤰'} size={18} />
            <Text style={styles.currentBadgeText}>{t('pregnancy.currentWeekBadge', { week: currentWeek })}</Text>
          </View>
        )}

        {/* ── 다음 검진 일정 (PDF 앨범 출력엔 미포함, 홈에 D-day로 표시) ── */}
        <NextCheckupSection childId={childId} />

        {/* ── 주수별 질문 카드 (한 줄 컴팩트) ── */}
        <View style={styles.questionCardRow}>
          <EmojiOrIcon emoji={weekQuestion.emoji} size={22} textStyle={styles.questionEmojiSmall} />
          <Text style={styles.questionTextRow} numberOfLines={1}>{weekQuestion.text}</Text>
        </View>

        {/* ── 인라인 compose card (성장앨범 BabyAlbum과 동일 UX) ── */}
        <View style={styles.composeCard}>
          {composePhoto ? (
            <View>
              <Image source={{ uri: composePhoto }} style={styles.composePhoto} resizeMode="cover" />
              <TouchableOpacity style={styles.composePhotoChange} onPress={composePickPhoto} activeOpacity={0.7}>
                <Text style={styles.composePhotoChangeText}>{t('common.change')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.composePhotoPlaceholder} onPress={composePickPhoto} activeOpacity={0.7}>
              <EmojiOrIcon emoji={'📷'} size={32} textStyle={styles.composePlaceholderEmoji} />
              <Text style={styles.composePlaceholderText}>{t('pregnancy.addPhotoPrompt')}</Text>
            </TouchableOpacity>
          )}

          {/* 마일스톤 칩 (한 줄) */}
          <Text style={styles.composeChipGroupLabel}>{t('pregnancy.milestoneLabel')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.composeChipScroll}>
            {availableMilestones.map((ms) => {
              const isActive = composeMilestoneChip?.id === ms.type;
              return (
                <TouchableOpacity
                  key={`ms-${ms.type}`}
                  style={[styles.composeChip, isActive && styles.composeChipActive, { borderColor: '#FF8C5A' }]}
                  onPress={() =>
                    setComposeMilestoneChip(
                      isActive ? null : { id: ms.type, label: ms.title, emoji: ms.emoji },
                    )
                  }
                  activeOpacity={0.75}
                >
                  <EmojiOrIcon emoji={ms.emoji} size={18} textStyle={styles.composeChipEmoji} />
                  <Text style={[styles.composeChipText, isActive && styles.composeChipTextActive]}>{ms.title}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* 엄마 기분 칩 (한 줄) */}
          <Text style={styles.composeChipGroupLabel}>{t('pregnancy.momMoodLabel')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.composeChipScroll}>
            {symptomPresets.map((s) => {
              const isActive = composeSymptomChip?.id === s.id;
              return (
                <TouchableOpacity
                  key={`sym-${s.id}`}
                  style={[styles.composeChip, isActive && styles.composeChipActive, { borderColor: '#E91E63' }]}
                  onPress={() =>
                    setComposeSymptomChip(
                      isActive ? null : { id: s.id, label: s.label, emoji: s.emoji },
                    )
                  }
                  activeOpacity={0.75}
                >
                  <EmojiOrIcon emoji={s.emoji} size={18} textStyle={styles.composeChipEmoji} />
                  <Text style={[styles.composeChipText, isActive && styles.composeChipTextActive]}>{s.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* 메모 입력 */}
          <TextInput
            style={styles.composeInput}
            placeholder={t('pregnancy.composeMemoPlaceholder')}
            placeholderTextColor={COLORS.textLight}
            value={composeMemo}
            onChangeText={setComposeMemo}
            multiline
          />

          {/* 가족피드 공유 토글 (성장앨범과 동일) */}
          <TouchableOpacity
            style={styles.composeShareRow}
            onPress={() => setShareToFamily((v) => !v)}
            activeOpacity={0.7}
          >
            <View style={[styles.composeShareCheck, shareToFamily && styles.composeShareCheckActive]}>
              {shareToFamily && <Text style={styles.composeShareCheckMark}>✓</Text>}
            </View>
            <Text style={styles.composeShareText}>{t('pregnancy.shareToFamilyFeed')}</Text>
          </TouchableOpacity>

          {/* 저장 버튼 */}
          <TouchableOpacity
            style={[styles.composeSaveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSaveUnified}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.composeSaveBtnText}>{t('common.save')}</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* ── AI 오늘 일기 (성장앨범과 동일) ── */}
        <TouchableOpacity
          style={styles.aiDiaryBtn}
          onPress={generateDiary}
          activeOpacity={0.7}
          disabled={diaryLoading}
        >
          {diaryLoading ? (
            <ActivityIndicator color={COLORS.primary} size="small" />
          ) : (
            <>
              <EmojiOrIcon emoji={'📝'} size={18} textStyle={styles.aiDiaryBtnEmoji} />
              <Text style={styles.aiDiaryBtnText}>{t('pregnancy.aiTodayDiary')}</Text>
            </>
          )}
        </TouchableOpacity>

        {/* AI 일기 결과 */}
        {diaryText && (
          <View style={styles.diaryCard}>
            <View style={styles.diaryHeader}>
              <View style={styles.diaryHeaderRow}>
                <EmojiOrIcon emoji={'📝'} size={16} />
                <Text style={styles.diaryHeaderText}>{t('pregnancy.aiDiaryHeader', { date: diaryDate })}</Text>
              </View>
              <TouchableOpacity onPress={() => setDiaryText(null)}>
                <Text style={styles.diaryClose}>{'✕'}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.diaryBody}>{diaryText}</Text>
          </View>
        )}

        {loadingTimeline && <ActivityIndicator style={{ marginTop: 20 }} color={COLORS.primary} />}

        {/* ── 성장앨범과 동일한 평면 피드 ── */}
        {(() => {
          const flatItems = userTimelineItems;
          if (flatItems.length === 0) return null;
          return (
            <>
              <Text style={styles.feedCount}>{t('pregnancy.feedCount', { count: flatItems.length })}</Text>
              {flatItems.map((item) => {
                const stripColor = item.type === 'milestone' ? '#FF8C5A' : item.source === 'health' ? '#E91E63' : '#FF8C5A';
                // 기존 기록 emoji null 보완: 증상 이름으로 역추적
                const effectiveEmoji =
                  item.emoji ??
                  symptomPresets.find((s) => s.label === item.title)?.emoji;
                // 마일스톤+엄마기분 동시 저장 시 content에 "[엄마기분: X]" 형태로 포함됨 → 파싱
                const moodMatch = item.content?.match(/\[엄마기분: (.+?)\]/);
                const moodLabel = moodMatch?.[1];
                const moodEmoji = moodLabel
                  ? symptomPresets.find((s) => s.label === moodLabel)?.emoji
                  : undefined;
                const memoText = item.content
                  ?.replace(/\n?\[엄마기분: .+?\]/g, '')
                  .trim();
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.feedCard}
                    onLongPress={() => handleLongPress(item)}
                    activeOpacity={0.85}
                  >
                    {item.mediaUri ? (
                      <Image source={{ uri: item.mediaUri }} style={styles.feedImage} resizeMode="cover" />
                    ) : null}
                    <View style={[styles.feedStrip, { backgroundColor: stripColor }]} />
                    <View style={styles.feedInfo}>
                      {item.createdAt ? (
                        <Text style={styles.feedDate}>{new Date(item.createdAt).toLocaleDateString('ko-KR')}</Text>
                      ) : null}
                      <View style={[styles.feedBadge, { borderColor: stripColor + '66' }]}>
                        <View style={[styles.feedBadgeCircle, { backgroundColor: stripColor + '22' }]}>
                          <EmojiOrIcon emoji={effectiveEmoji} size={20} textStyle={{ fontSize: 16 }} />
                        </View>
                        <Text style={[styles.feedBadgeText, { color: stripColor }]}>{item.title}</Text>
                      </View>
                      {memoText ? (
                        <Text style={styles.feedMemo}>{memoText}</Text>
                      ) : null}
                      {moodLabel ? (
                        <View style={[styles.feedBadge, { borderColor: '#E91E6366', marginTop: 4 }]}>
                          <View style={[styles.feedBadgeCircle, { backgroundColor: '#E91E6322' }]}>
                            <EmojiOrIcon emoji={moodEmoji} size={20} textStyle={{ fontSize: 16 }} />
                          </View>
                          <Text style={[styles.feedBadgeText, { color: '#C2185B' }]}>{moodLabel}</Text>
                        </View>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </>
          );
        })()}

        {!loadingTimeline && userTimelineItems.length === 0 && (
          <View style={styles.emptyCenter}>
            <EmojiOrIcon emoji={timelineError ? '⚠️' : '📝'} size={48} textStyle={styles.emptyIcon} />
            <Text style={styles.emptyText}>
              {timelineError ? t('pregnancy.loadRecordsFailed') : t('pregnancy.leaveFirstRecord')}
            </Text>
            <Text style={styles.emptySubText}>
              {timelineError ? t('pregnancy.checkNetworkRetry') : t('pregnancy.emptyStateDesc')}
            </Text>
            {timelineError && (
              <TouchableOpacity
                style={{ marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12, backgroundColor: '#E91E63' }}
                onPress={loadTimeline}
              >
                <Text style={{ color: '#FFF', fontWeight: '700' }}>{t('common.retry')}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── 임신앨범 만들기 (성장앨범과 동일 구조) ── */}
        <View style={styles.albumSection}>
          <View style={styles.albumSectionHeader}>
            <Text style={styles.albumSectionTitle}>{t('pregnancy.createAlbumTitle')}</Text>
            <TouchableOpacity
              onPress={() => {
                setShowAlbumForm((v) => {
                  if (!v) {
                    // 폼 열릴 때 기본값 자동 세팅
                    const now = new Date();
                    const toYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                    // 타임라인에서 유저 업로드 기록 중 가장 이른 달
                    const userItems = timeline
                      .flatMap((wg) => wg.items.filter((it) => it.source !== 'development'))
                      .map((it) => it.createdAt.slice(0, 7))
                      .sort();
                    const fromYM = userItems[0] ?? toYM;
                    if (!albumDateFrom) setAlbumDateFrom(fromYM);
                    if (!albumDateTo) setAlbumDateTo(toYM);
                    if (!albumTitle) setAlbumTitle(t('pregnancy.albumDefaultTitle', { name: childName }));
                  }
                  return !v;
                });
              }}
              style={styles.albumNewBtn}
              activeOpacity={0.8}
            >
              <Text style={styles.albumNewBtnText}>{showAlbumForm ? t('common.close') : t('pregnancy.newAlbumBtn')}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.albumSectionDesc}>
            {t('pregnancy.albumSectionDesc')}
          </Text>

          {showAlbumForm && (
            <View style={styles.albumForm}>
              <Text style={styles.albumFormLabel}>{t('pregnancy.albumTitleLabel')}</Text>
              <TextInput
                style={styles.albumFormInput}
                placeholder={t('pregnancy.albumDefaultTitle', { name: childName })}
                value={albumTitle}
                onChangeText={setAlbumTitle}
                maxLength={30}
                placeholderTextColor={COLORS.textLight}
              />
              <View style={styles.albumDateRow}>
                <View style={styles.albumDateField}>
                  <Text style={styles.albumFormLabel}>{t('pregnancy.startMonthLabel')}</Text>
                  <TextInput
                    style={styles.albumFormInput}
                    placeholder="2024-01"
                    value={albumDateFrom}
                    onChangeText={setAlbumDateFrom}
                    maxLength={7}
                    keyboardType="numbers-and-punctuation"
                    placeholderTextColor={COLORS.textLight}
                  />
                </View>
                <Text style={styles.albumDateSep}>{'~'}</Text>
                <View style={styles.albumDateField}>
                  <Text style={styles.albumFormLabel}>{t('pregnancy.endMonthLabel')}</Text>
                  <TextInput
                    style={styles.albumFormInput}
                    placeholder="2024-12"
                    value={albumDateTo}
                    onChangeText={setAlbumDateTo}
                    maxLength={7}
                    keyboardType="numbers-and-punctuation"
                    placeholderTextColor={COLORS.textLight}
                  />
                </View>
              </View>
              <Text style={styles.albumFormHint}>
                {t('pregnancy.albumFormHint')}
              </Text>

              <Text style={styles.albumFormLabel}>{t('pregnancy.coverImageLabel')}</Text>
              <TouchableOpacity
                style={styles.albumCoverPicker}
                onPress={pickCoverImage}
                activeOpacity={0.8}
              >
                {albumCoverUri ? (
                  <>
                    <Image
                      source={{ uri: albumCoverUri }}
                      style={styles.albumCoverPreview}
                      resizeMode="cover"
                    />
                    <TouchableOpacity
                      style={styles.albumCoverClear}
                      onPress={() => setAlbumCoverUri(null)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.albumCoverClearText}>{'✕'}</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <Image
                      source={DEFAULT_COVER_SOURCE}
                      style={styles.albumCoverPreview}
                      resizeMode="cover"
                    />
                    <View style={styles.albumCoverDefaultOverlay}>
                      <Text style={styles.albumCoverDefaultText}>{t('pregnancy.defaultCoverHint')}</Text>
                    </View>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.albumGenerateBtn, albumGenerating && styles.albumGenerateBtnDisabled]}
                onPress={handleGeneratePregnancyAlbum}
                disabled={albumGenerating || !albumDateFrom || !albumDateTo}
                activeOpacity={0.8}
              >
                {albumGenerating
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.albumGenerateBtnText}>{t('pregnancy.startGenerateAlbum')}</Text>
                }
              </TouchableOpacity>
            </View>
          )}
        </View>

        <MedicalCitation
          sources={[
            { label: t('pregnancy.citationChildcarePortal'), url: 'https://www.childcare.go.kr' },
            { label: t('pregnancy.citationKsog'), url: 'https://www.ksog.org' },
          ]}
        />
        <View style={{ height: 40 }} />
      </ScrollView>
      <AdSlot />

      {/* ── 기록 수정 모달 ── */}
      <Modal
        visible={!!editingItem}
        animationType="slide"
        transparent
        onRequestClose={() => setEditingItem(null)}
      >
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { paddingBottom: 24 }]}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setEditingItem(null)} style={styles.modalBackBtn}>
                  <Text style={styles.modalBackText}>{t('pregnancy.backCancel')}</Text>
                </TouchableOpacity>
                <Text style={styles.modalTitle}>{t('pregnancy.editRecordTitle')}</Text>
                <View style={{ width: 50 }} />
              </View>
              {editingItem && (
                <Text style={{ fontSize: FONT_SIZE.sm, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 8 }}>
                  {editingItem.title}
                </Text>
              )}
              {/* 현재 이미지 / 새 이미지 미리보기 */}
              {(editNewImage ?? editingItem?.mediaUri) ? (
                <Image
                  source={{ uri: editNewImage ?? editingItem!.mediaUri }}
                  style={{ width: '100%', height: 160, borderRadius: RADIUS.md, marginBottom: 8 }}
                  resizeMode="cover"
                />
              ) : null}
              <TouchableOpacity
                style={{ alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: COLORS.surfaceLight, borderRadius: RADIUS.md, marginBottom: 10 }}
                onPress={pickEditImage}
              >
                <Text style={{ fontSize: FONT_SIZE.sm, color: COLORS.primary, fontWeight: '700' }}>
                  {(editNewImage ?? editingItem?.mediaUri) ? t('pregnancy.changePhoto') : t('pregnancy.addPhoto')}
                </Text>
              </TouchableOpacity>
              <TextInput
                style={[styles.formInput, { minHeight: 100, textAlignVertical: 'top' }]}
                placeholder={t('pregnancy.memoInputPlaceholder')}
                placeholderTextColor={COLORS.textLight}
                value={editMemo}
                onChangeText={setEditMemo}
                multiline
                autoFocus
              />
              <TouchableOpacity
                style={[styles.composeSaveBtn, editSaving && { opacity: 0.6 }]}
                onPress={handleEditSave}
                disabled={editSaving}
                activeOpacity={0.85}
              >
                {editSaving
                  ? <ActivityIndicator color="#FFF" />
                  : <Text style={styles.composeSaveBtnText}>{t('common.save')}</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ════════════════════════════════════════════════ */}
      {/*  Unified New Record Modal                        */}
      {/* ════════════════════════════════════════════════ */}
      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {/* Modal header with back button */}
                <View style={styles.modalHeader}>
                  <TouchableOpacity
                    onPress={() => {
                      setShowModal(false);
                      setDoctorNote('');
                      setMediaUri(null);
                      setSelectedMilestones([]);
                      setSelectedSymptoms([]);
                      setSeverity(3);
                      setHealthMemo('');
                    }}
                    style={styles.modalBackBtn}
                  >
                    <Text style={styles.modalBackText}>{t('pregnancy.backToBack')}</Text>
                  </TouchableOpacity>
                  <Text style={styles.modalTitle}>{t('pregnancy.weekRecordTitle', { week: currentWeek })}</Text>
                  <View style={{ width: 50 }} />
                </View>

                {/* ── Section 1: Doctor Notes ── */}
                <View style={styles.formSection}>
                  <View style={styles.formLabelRow}>
                    <EmojiOrIcon emoji={'🏥'} size={18} />
                    <Text style={styles.formLabel}>{t('pregnancy.doctorNoteLabel')}</Text>
                  </View>
                  <TextInput
                    style={[styles.formInput, { minHeight: 80, textAlignVertical: 'top' }]}
                    placeholder={t('pregnancy.doctorNotePlaceholder')}
                    placeholderTextColor={COLORS.textLight}
                    value={doctorNote}
                    onChangeText={setDoctorNote}
                    multiline
                  />
                </View>

                {/* ── Section 2: Media Upload ── */}
                <View style={styles.formSection}>
                  <View style={styles.formLabelRow}>
                    <EmojiOrIcon emoji={'📸'} size={18} />
                    <Text style={styles.formLabel}>{t('pregnancy.ultrasoundVideoLabel')}</Text>
                  </View>
                  <TouchableOpacity style={styles.mediaPickerBtn} onPress={pickImage} activeOpacity={0.7}>
                    {mediaUri ? (
                      <Image source={{ uri: mediaUri }} style={styles.mediaPreview} resizeMode="cover" />
                    ) : (
                      <View style={styles.mediaPlaceholder}>
                        <Text style={styles.mediaPlaceholderIcon}>{'+'}</Text>
                        <Text style={styles.mediaPlaceholderText}>{t('pregnancy.addPhotoVideoShort')}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  {mediaUri && (
                    <TouchableOpacity onPress={() => setMediaUri(null)} style={styles.mediaRemoveBtn}>
                      <Text style={styles.mediaRemoveText}>{t('common.delete')}</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* ── Section 3: Milestones ── */}
                {availableMilestones.length > 0 && (
                  <View style={styles.formSection}>
                    <View style={styles.formLabelRow}>
                      <Text style={styles.formLabel}>{'★'} {t('pregnancy.thisWeekMilestone')}</Text>
                    </View>
                    <View style={styles.chipGrid}>
                      {availableMilestones.map((ms) => {
                        const selected = selectedMilestones.includes(ms.type);
                        return (
                          <TouchableOpacity
                            key={ms.type}
                            style={[styles.chip, selected && styles.chipActive]}
                            onPress={() => toggleMilestone(ms.type)}
                          >
                            <EmojiOrIcon emoji={ms.emoji} size={18} textStyle={styles.chipEmoji} />
                            <Text style={[styles.chipLabel, selected && styles.chipLabelActive]}>
                              {ms.title}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* ── Section 4: Mom Health ── */}
                <View style={styles.formSection}>
                  <View style={styles.formLabelRow}>
                    <EmojiOrIcon emoji={'🤰'} size={18} />
                    <Text style={styles.formLabel}>{t('pregnancy.momStatusLabel')}</Text>
                  </View>
                  <View style={styles.chipGrid}>
                    {symptomPresets.map((preset) => {
                      const selected = selectedSymptoms.includes(preset.id);
                      return (
                        <TouchableOpacity
                          key={preset.id}
                          style={[styles.chip, selected && styles.chipHealthActive]}
                          onPress={() => toggleSymptom(preset.id)}
                        >
                          <EmojiOrIcon emoji={preset.emoji} size={18} textStyle={styles.chipEmoji} />
                          <Text style={[styles.chipLabel, selected && styles.chipLabelHealthActive]}>
                            {preset.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {selectedSymptoms.length > 0 && (
                    <>
                      <Text style={styles.subLabel}>{t('pregnancy.severityLabel')}</Text>
                      <View style={styles.severityRow}>
                        {[1, 2, 3, 4, 5].map((level) => (
                          <TouchableOpacity
                            key={level}
                            style={[styles.severityBtn, severity === level && styles.severityBtnActive]}
                            onPress={() => setSeverity(level)}
                          >
                            <Text style={styles.severityEmoji}>
                              {level <= 2 ? '😊' : level === 3 ? '😐' : level === 4 ? '😣' : '😭'}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </>
                  )}

                  <TextInput
                    style={[styles.formInput, { minHeight: 60, textAlignVertical: 'top' }]}
                    placeholder={t('pregnancy.freeInputPlaceholder')}
                    placeholderTextColor={COLORS.textLight}
                    value={healthMemo}
                    onChangeText={setHealthMemo}
                    multiline
                  />
                </View>

                {/* ── Buttons ── */}
                <View style={styles.modalBtns}>
                  <TouchableOpacity
                    style={styles.modalCancelBtn}
                    onPress={() => {
                      setShowModal(false);
                      setDoctorNote('');
                      setMediaUri(null);
                      setSelectedMilestones([]);
                      setSelectedSymptoms([]);
                      setSeverity(3);
                      setHealthMemo('');
                    }}
                  >
                    <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalSaveBtn, saving && styles.saveBtnDisabled]}
                    onPress={handleSave}
                    disabled={saving}
                  >
                    <Text style={styles.modalSaveText}>
                      {saving ? t('pregnancy.saving') : t('common.save')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <GuideCarousel visible={guideVisible} pages={PREGNANCY_ALBUM_GUIDE} onClose={closeGuide} onComplete={closeGuide} accent="#E91E63" />
    </View>
  );
}

/* ================================================================== */
/*  Styles                                                             */
/* ================================================================== */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { padding: SPACING.md, paddingBottom: 100 },

  /* Header */
  header: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    backgroundColor: COLORS.background,
  },
  headerTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.text,
  },

  /* Weekly question */
  /* === 성장앨범과 동일한 시각 요소 === */
  albumTitle: {
    fontSize: FONT_SIZE.xl ?? 24,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  albumChildLabel: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  aiDiaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.full,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.soft,
  },
  aiDiaryBtnEmoji: { fontSize: 16 },
  aiDiaryBtnText: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: COLORS.text },
  diaryCard: {
    backgroundColor: '#FFFBEC',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: '#FFE0A0',
  },
  diaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  diaryHeaderText: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: COLORS.text },
  diaryClose: { fontSize: 18, color: COLORS.textSecondary, padding: 4 },
  diaryBody: { fontSize: FONT_SIZE.sm, color: COLORS.text, lineHeight: 22, fontWeight: '600' },

  /* === Inline compose card (성장앨범 BabyAlbum과 동일) === */
  composeCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.soft,
  },
  composePhoto: {
    width: '100%',
    height: 200,
    borderRadius: RADIUS.md,
    backgroundColor: '#F2F2F7',
  },
  composePhotoChange: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
  },
  composePhotoChangeText: { color: '#FFF', fontSize: FONT_SIZE.xs, fontWeight: '700' },
  composePhotoPlaceholder: {
    height: 140,
    borderRadius: RADIUS.md,
    backgroundColor: '#FAFAFA',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.border,
  },
  composePlaceholderEmoji: { fontSize: 32, marginBottom: 4 },
  composePlaceholderText: { fontSize: FONT_SIZE.sm, color: COLORS.textLight, fontWeight: '600' },
  composeChipGroupLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  composeChipScroll: { marginBottom: 4 },
  composeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    backgroundColor: '#FFFFFF',
    marginRight: 8,
    gap: 4,
  },
  composeChipActive: {
    backgroundColor: '#FFF0E6',
  },
  composeChipEmoji: { fontSize: 14 },
  composeChipText: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.text },
  composeChipTextActive: { fontWeight: '600' },
  composeInput: {
    minHeight: 60,
    padding: SPACING.sm,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    backgroundColor: '#FAFAFA',
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    textAlignVertical: 'top',
  },
  composeShareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: SPACING.sm,
  },
  composeShareCheck: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  composeShareCheckActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  composeShareCheckMark: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  composeShareText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  composeSaveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  composeSaveBtnText: { color: '#FFF', fontSize: FONT_SIZE.md, fontWeight: '600' },

  feedCount: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginBottom: SPACING.sm, fontWeight: '700' },
  feedCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    marginBottom: SPACING.md,
    ...SHADOWS.soft,
  },
  feedImage: { width: '100%', height: 240 },
  feedStrip: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 },
  feedInfo: { padding: SPACING.md, paddingLeft: SPACING.md + 2 },
  feedDate: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginBottom: 6, fontWeight: '700' },
  feedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  feedBadgeCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  feedBadgeText: { fontSize: FONT_SIZE.sm, fontWeight: '700' },
  feedMemo: {
    fontSize: FONT_SIZE.sm,
    color: '#7A5C40',
    lineHeight: 22,
    fontFamily: 'serif',
    fontStyle: 'italic',
    fontWeight: 'bold',
    marginTop: 4,
  },

  albumSection: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginTop: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  albumSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  albumSectionTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  albumNewBtn: {
    backgroundColor: '#FFE0E6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  albumNewBtnText: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: '#C2185B' },
  albumSectionDesc: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: SPACING.sm,
  },
  albumForm: {
    marginTop: SPACING.sm,
    gap: 0,
  },
  albumFormLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 4,
    marginTop: SPACING.sm,
  },
  albumFormInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    backgroundColor: COLORS.background,
    marginBottom: 4,
  },
  albumDateRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  albumDateField: { flex: 1 },
  albumDateSep: {
    fontSize: 18,
    color: COLORS.textSecondary,
    marginBottom: 14,
    alignSelf: 'center',
  },
  albumFormHint: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textLight,
    marginBottom: SPACING.sm,
    fontWeight: '600',
  },
  albumCoverPicker: {
    width: '100%',
    height: 100,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.md,
    position: 'relative',
  },
  albumCoverPreview: {
    width: '100%',
    height: '100%',
  },
  albumCoverEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  albumCoverEmptyText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textLight,
    fontWeight: '600',
  },
  albumCoverClear: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  albumCoverClearText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  albumCoverDefaultOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingVertical: 5,
    alignItems: 'center',
  },
  albumCoverDefaultText: { color: '#FFF', fontSize: FONT_SIZE.xs, fontWeight: '700' },
  albumGenerateBtn: {
    backgroundColor: '#C2185B',
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  albumGenerateBtnDisabled: { opacity: 0.5 },
  albumGenerateBtnText: {
    color: '#fff',
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
  },

  questionCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF0F5',
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: '#FFD6E7',
  },
  questionEmojiSmall: { fontSize: 18 },
  questionTextRow: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: '#C2185B',
  },
  questionCard: {
    backgroundColor: '#FFF0F5',
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFD6E7',
  },
  questionEmoji: { fontSize: 36, marginBottom: SPACING.sm },
  questionText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: '#C2185B',
    textAlign: 'center',
    lineHeight: 24,
  },

  /* Add button */
  addBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  addBtnText: { color: '#FFF', fontSize: FONT_SIZE.md, fontWeight: '700' },

  /* Timeline — 성장앨범(album.tsx pStyles)과 동일 스타일 */
  currentBadge: {
    backgroundColor: '#FCE4EC',
    borderRadius: RADIUS.full,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignSelf: 'center',
    marginBottom: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  currentBadgeText: { fontSize: FONT_SIZE.md, fontWeight: '700', color: '#C2185B' },
  weekGroup: { marginBottom: SPACING.lg },
  weekHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
  weekBadge: {
    backgroundColor: '#E91E63',
    borderRadius: RADIUS.full,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  weekBadgeCurrent: { backgroundColor: '#C2185B' },
  weekBadgeText: { color: '#FFF', fontSize: FONT_SIZE.sm, fontWeight: '700' },
  weekLine: { flex: 1, height: 1, backgroundColor: COLORS.border, marginLeft: SPACING.sm },

  timelineCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    marginLeft: 20,
    ...SHADOWS.soft,
  },
  timelineCardDev: { backgroundColor: '#FFF3E0', borderLeftWidth: 3, borderLeftColor: '#FF9800' },
  timelineCardHealth: { backgroundColor: '#FCE4EC', borderLeftWidth: 3, borderLeftColor: '#E91E63' },
  timelineEmoji: { fontSize: 24, marginRight: SPACING.sm },
  timelineEmojiWrap: { marginRight: SPACING.sm },
  timelineBody: { flex: 1 },
  timelineTitle: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text },
  timelineContent: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 4, lineHeight: 20, fontWeight: '600' },
  timelineDate: { fontSize: FONT_SIZE.xs, color: COLORS.textLight, marginTop: 4, fontWeight: '600' },
  timelineImage: { width: '100%', height: 160, borderRadius: RADIUS.sm, marginTop: SPACING.sm, backgroundColor: COLORS.surfaceLight },

  /* Section card */
  sectionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.soft,
  },
  sectionTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.sm },

  /* History */
  historyItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  historyLeft: { flex: 1 },
  historySymptoms: { fontSize: FONT_SIZE.md, fontWeight: '500', color: COLORS.text },
  historyDate: { fontSize: FONT_SIZE.xs, color: COLORS.textLight, marginTop: 2 },
  severityDot: { width: 12, height: 12, borderRadius: 6, marginLeft: SPACING.sm },

  /* Empty */
  emptyCenter: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: SPACING.md },
  emptyText: { fontSize: FONT_SIZE.lg, fontWeight: '600', color: COLORS.text },
  emptySubText: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 4, textAlign: 'center' },

  /* Modal */
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: SPACING.lg, maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  modalBackBtn: { paddingVertical: 4 },
  modalBackText: { fontSize: FONT_SIZE.md, color: COLORS.primary, fontWeight: '600' },
  modalTitle: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.text },

  /* Form sections */
  formSection: {
    marginBottom: SPACING.lg,
  },
  formLabel: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  formLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  diaryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  formInput: {
    backgroundColor: '#F8F5F2', borderRadius: RADIUS.md,
    padding: SPACING.md, fontSize: FONT_SIZE.md, color: COLORS.text,
    borderWidth: 1, borderColor: COLORS.border,
  },

  /* Media picker */
  mediaPickerBtn: {
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  mediaPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    backgroundColor: '#F2F2F7',
  },
  mediaPlaceholderIcon: { fontSize: 32, color: COLORS.textLight, marginBottom: 4 },
  mediaPlaceholderText: { fontSize: FONT_SIZE.sm, color: COLORS.textLight },
  mediaPreview: { width: '100%', height: 200 },
  mediaRemoveBtn: { alignSelf: 'flex-end', marginTop: 4 },
  mediaRemoveText: { fontSize: FONT_SIZE.sm, color: COLORS.error, fontWeight: '600' },

  /* Chip grid */
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F5F0EB', borderRadius: RADIUS.full,
    paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1.5, borderColor: 'transparent',
  },
  chipActive: { backgroundColor: '#FFF0E6', borderColor: COLORS.primary },
  chipHealthActive: { backgroundColor: '#FCE4EC', borderColor: '#E91E63' },
  chipEmoji: { fontSize: 16 },
  chipLabel: { fontSize: FONT_SIZE.sm, color: COLORS.text },
  chipLabelActive: { color: COLORS.primary, fontWeight: '600' },
  chipLabelHealthActive: { color: '#E91E63', fontWeight: '600' },

  /* Severity */
  severityRow: { flexDirection: 'row', gap: 8, marginBottom: SPACING.md, justifyContent: 'center' },
  severityBtn: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F5F0EB', borderWidth: 2, borderColor: 'transparent',
  },
  severityBtnActive: { borderColor: '#E91E63', backgroundColor: '#FCE4EC' },
  severityEmoji: { fontSize: 22 },

  /* Modal buttons */
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: SPACING.sm, marginBottom: SPACING.lg },
  modalCancelBtn: { flex: 1, padding: SPACING.md, borderRadius: RADIUS.md, alignItems: 'center', backgroundColor: '#F5F0EB' },
  modalCancelText: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary, fontWeight: '600' },
  modalSaveBtn: { flex: 1, padding: SPACING.md, borderRadius: RADIUS.md, alignItems: 'center', backgroundColor: COLORS.primary },
  modalSaveText: { fontSize: FONT_SIZE.md, color: '#FFF', fontWeight: '700' },
  saveBtnDisabled: { opacity: 0.5 },
});
