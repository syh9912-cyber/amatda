import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  Switch,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';
import { Stack } from 'expo-router';
import { pickImageFromLibrary } from '../../utils/imagePicker';
import { useChildStore } from '../../stores/childStore';
import { AdSlot } from '../../components/ads/AdSlot';
import { momstagramApi, coachingApi, pregnancyApi, uploadApi, albumApi, API_URL } from '../../services/api';
import { readCache, writeCache } from '../../utils/simpleCache';
import { uploadGrowthPhoto } from '../../services/imageUpload';
import { useMomstagramStore } from '../../stores/momstagramStore';
import { COLORS, FONT_SIZE, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { PhotoViewer } from '../../components/album/PhotoViewer';
// milestoneImages kept for future PDF/export use — not used in UI rendering

/* ------------------------------------------------------------------ */
/* Milestone category images                                           */
/* ------------------------------------------------------------------ */

type MilestoneCategory = 'body' | 'talk' | 'brain' | 'heart' | 'hand' | 'star' | 'food' | 'eye';

/** 카테고리별 배경 색상 — 이미지 파일 불필요, OTA 안전 */
const CATEGORY_COLORS: Record<MilestoneCategory, string> = {
  body:  '#FF8C5A', // 신체 – 주황
  talk:  '#4A90D9', // 언어 – 파랑
  brain: '#9B59B6', // 인지 – 보라
  heart: '#E8567A', // 정서 – 핑크
  hand:  '#27AE60', // 손조작 – 초록
  star:  '#F5A623', // 특별 – 금색
  food:  '#E67E22', // 식습관 – 호박
  eye:   '#16A085', // 감각 – 청록
};

/* ------------------------------------------------------------------ */
/* Milestones by age range (expanded!)                                 */
/* ------------------------------------------------------------------ */

interface MilestoneItem {
  label: string;
  emoji: string;
  cat: MilestoneCategory;
}

// ─── 마일스톤 프리셋 ─────────────────────────────────────────────
// 주의: label 값은 assets/milestones-sm/ 파일명과 정확히 일치해야 이미지가 표시됨
// 파일명 규칙: {월령prefix}-{label(공백→_)} .png
const MILESTONE_PRESETS: Record<string, MilestoneItem[]> = {
  '0개월': [
    { label: '첫 울음', emoji: '👶', cat: 'body' },
    { label: '빛에 반응', emoji: '💡', cat: 'eye' },
    { label: '큰 소리에 깜짝', emoji: '👂', cat: 'eye' },
    { label: '손 꽉 쥐기', emoji: '✊', cat: 'body' },
    { label: '엄마 목소리 인식', emoji: '🤱', cat: 'heart' },
    { label: '수유 시작', emoji: '🍼', cat: 'food' },
    { label: '얼굴 가까이 응시', emoji: '👀', cat: 'eye' },
    { label: '제대 탈락', emoji: '🏥', cat: 'body' },
  ],
  '1개월': [
    { label: '엎드려 고개 들기', emoji: '💪', cat: 'body' },
    { label: '초점 맞추기', emoji: '👁', cat: 'eye' },
    { label: '물체 따라보기', emoji: '👀', cat: 'brain' },
    { label: '소리 반응', emoji: '👂', cat: 'eye' },
    { label: '수유 리듬', emoji: '🍼', cat: 'food' },
    { label: '울음 의사표현', emoji: '😢', cat: 'talk' },
    { label: '손발 움직임', emoji: '🦶', cat: 'body' },
    { label: '안아주면 안정', emoji: '🤗', cat: 'heart' },
  ],
  '2개월': [
    { label: '사회적 미소', emoji: '😊', cat: 'heart' },
    { label: '옹알이 시작', emoji: '🗣', cat: 'talk' },
    { label: '180도 따라보기', emoji: '👀', cat: 'eye' },
    { label: '손을 입에', emoji: '🤚', cat: 'hand' },
    { label: '엎드려 가슴 들기', emoji: '💪', cat: 'body' },
    { label: '소리에 조용해지기', emoji: '🤫', cat: 'brain' },
    { label: '얼굴 보고 웃기', emoji: '😄', cat: 'heart' },
    { label: '밤 수면 길어짐', emoji: '😴', cat: 'brain' },
  ],
  '3개월': [
    { label: '목 가누기', emoji: '🦒', cat: 'body' },
    { label: '소리내어 웃기', emoji: '😂', cat: 'heart' },
    { label: '손에 쥐어주면 잡기', emoji: '✊', cat: 'hand' },
    { label: '팔로 지탱', emoji: '🤸', cat: 'body' },
    { label: '옹알이 다양해짐', emoji: '🗣', cat: 'talk' },
    { label: '손 쳐다보기', emoji: '🖐', cat: 'brain' },
    { label: '거울 속 얼굴', emoji: '🪞', cat: 'brain' },
    { label: '수유량 안정', emoji: '🍼', cat: 'food' },
  ],
  '4개월': [
    { label: '뒤집기 시도', emoji: '🔄', cat: 'body' },
    { label: '장난감 손 뻗어 잡기', emoji: '🧸', cat: 'hand' },
    { label: '모음 발성', emoji: '🗣', cat: 'talk' },
    { label: '거울 보고 웃기', emoji: '🪞', cat: 'heart' },
    { label: '양손으로 잡기', emoji: '🤲', cat: 'hand' },
    { label: '받쳐주면 앉기', emoji: '🪑', cat: 'body' },
    { label: '표정 모방', emoji: '🎭', cat: 'brain' },
    { label: '울음 구분', emoji: '😢', cat: 'talk' },
  ],
  '5개월': [
    { label: '뒤집기 성공', emoji: '🔄', cat: 'body' },
    { label: '발 잡기', emoji: '🦶', cat: 'body' },
    { label: '입으로 탐색', emoji: '👄', cat: 'eye' },
    { label: '낯가림 시작', emoji: '🫣', cat: 'heart' },
    { label: '장난감 옮기기', emoji: '🤲', cat: 'hand' },
    { label: '이유식 시작', emoji: '🥄', cat: 'food' },
    { label: '까꿍 반응', emoji: '🙈', cat: 'brain' },
    { label: '소리 모방', emoji: '😂', cat: 'talk' },
  ],
  '6개월': [
    { label: '이유식 잘 먹기', emoji: '🥄', cat: 'food' },
    { label: '혼자 앉기', emoji: '🪑', cat: 'body' },
    { label: '다다다 옹알이', emoji: '🗣', cat: 'talk' },
    { label: '물건 두드리기', emoji: '🔔', cat: 'hand' },
    { label: '거울놀이 좋아함', emoji: '🪞', cat: 'heart' },
    { label: '소리 방향 찾기', emoji: '👂', cat: 'eye' },
    { label: '손 뻗어 잡기', emoji: '🤲', cat: 'hand' },
    { label: '첫 이 나기', emoji: '🦷', cat: 'body' },
  ],
  '7개월': [
    { label: '혼자 앉기 안정', emoji: '🧒', cat: 'body' },
    { label: '배밀이 시작', emoji: '🐛', cat: 'body' },
    { label: '까꿍 놀이 즐기기', emoji: '🙈', cat: 'brain' },
    { label: '이름 부르면 반응', emoji: '👶', cat: 'brain' },
    { label: '엄마에게 팔 벌리기', emoji: '🤗', cat: 'heart' },
    { label: '이유식 중기', emoji: '🥄', cat: 'food' },
    { label: '집게 잡기 시도', emoji: '✌', cat: 'hand' },
    { label: '물건 떨어뜨리기 놀이', emoji: '🎲', cat: 'brain' },
  ],
  '8개월': [
    { label: '기어가기 시작', emoji: '🐛', cat: 'body' },
    { label: '잡고 서기', emoji: '🧒', cat: 'body' },
    { label: '분리불안 시작', emoji: '😢', cat: 'heart' },
    { label: '바이바이 흉내', emoji: '👋', cat: 'talk' },
    { label: '소리 따라하기', emoji: '🗣', cat: 'talk' },
    { label: '두 물건 부딪치기', emoji: '🔔', cat: 'hand' },
    { label: '숨긴 물건 찾기', emoji: '🔍', cat: 'brain' },
    { label: '핑거푸드 집어먹기', emoji: '🍗', cat: 'food' },
  ],
  '9개월': [
    { label: '가구 잡고 이동', emoji: '🪑', cat: 'body' },
    { label: '손가락으로 가리키기', emoji: '☝', cat: 'brain' },
    { label: '박수치기', emoji: '👏', cat: 'heart' },
    { label: '집게 잡기 성공', emoji: '✌', cat: 'hand' },
    { label: '간단한 몸짓 모방', emoji: '🙌', cat: 'brain' },
    { label: '안 돼 이해하기', emoji: '🚫', cat: 'brain' },
    { label: '이유식 후기', emoji: '🥄', cat: 'food' },
    { label: '컵 잡고 마시기 시도', emoji: '🥤', cat: 'food' },
  ],
  '10개월': [
    { label: '잡고 서서 움직이기', emoji: '🧒', cat: 'body' },
    { label: '엄마 아빠 뜻있게 말하기', emoji: '🗣', cat: 'talk' },
    { label: '손 흔들어 인사', emoji: '👋', cat: 'talk' },
    { label: '까꿍 놀이 주도', emoji: '🙈', cat: 'brain' },
    { label: '간단한 지시 이해', emoji: '🧠', cat: 'brain' },
    { label: '숟가락 잡기 시도', emoji: '🥄', cat: 'hand' },
    { label: '뚜껑 열기 시도', emoji: '🔓', cat: 'hand' },
    { label: '음악에 몸 흔들기', emoji: '🎵', cat: 'heart' },
  ],
  '11개월': [
    { label: '혼자 서기 시도', emoji: '🧒', cat: 'body' },
    { label: '첫 단어 시도', emoji: '🗣', cat: 'talk' },
    { label: '또래에게 관심', emoji: '👫', cat: 'heart' },
    { label: '간식 스스로 먹기', emoji: '🍪', cat: 'food' },
    { label: '블록 2 3개 쌓기', emoji: '🧱', cat: 'hand' },
    { label: '물건 넣고 빼기', emoji: '📦', cat: 'brain' },
    { label: '책장 넘기기', emoji: '📚', cat: 'brain' },
    { label: '전화 놀이', emoji: '📱', cat: 'talk' },
  ],
  '12개월': [
    { label: '첫 걸음', emoji: '👟', cat: 'body' },
    { label: '의미있는 단어 2 3개', emoji: '🗣', cat: 'talk' },
    { label: '엄마아빠에게 애정표현', emoji: '❤', cat: 'heart' },
    { label: '컵으로 마시기', emoji: '🥤', cat: 'food' },
    { label: '크레용 쥐기', emoji: '✏', cat: 'hand' },
    { label: '숨은 물건 찾기', emoji: '🔍', cat: 'brain' },
    { label: '공 굴리기', emoji: '⚽', cat: 'body' },
    { label: '완료식 시작', emoji: '🍚', cat: 'food' },
  ],
  '13개월': [
    { label: '걷기 점점 안정', emoji: '👟', cat: 'body' },
    { label: '원하는 것 가리키기', emoji: '☝', cat: 'brain' },
    { label: '숟가락 혼자 시도', emoji: '🥄', cat: 'hand' },
    { label: '블록 3개 쌓기', emoji: '🧱', cat: 'hand' },
    { label: '인형에 밥 주기', emoji: '🧸', cat: 'star' },
    { label: '동물 소리 흉내', emoji: '🐄', cat: 'talk' },
    { label: '신발 벗기 시도', emoji: '👟', cat: 'hand' },
    { label: '밥 거부 편식 시작', emoji: '🙅', cat: 'food' },
  ],
  '14개월': [
    { label: '계단 기어오르기', emoji: '🪜', cat: 'body' },
    { label: '뒤로 걷기', emoji: '👟', cat: 'body' },
    { label: '신체 부위 가리키기', emoji: '👆', cat: 'brain' },
    { label: '의미있는 단어 5개', emoji: '🗣', cat: 'talk' },
    { label: '컵 혼자 사용', emoji: '🥤', cat: 'food' },
    { label: '그리기 끼적', emoji: '✏', cat: 'star' },
    { label: '소유욕 표현', emoji: '😤', cat: 'heart' },
    { label: '리듬에 맞춰 흔들기', emoji: '🎵', cat: 'heart' },
  ],
  '15개월': [
    { label: '안정적으로 걷기', emoji: '👟', cat: 'body' },
    { label: '공 차기 시도', emoji: '⚽', cat: 'body' },
    { label: '낙서하기', emoji: '✏', cat: 'star' },
    { label: '10개 이상 단어 이해', emoji: '🧠', cat: 'brain' },
    { label: '동물 이름 말하기', emoji: '🐄', cat: 'talk' },
    { label: '책 넘기기', emoji: '📚', cat: 'brain' },
    { label: '또래 옆에서 놀기', emoji: '👫', cat: 'heart' },
    { label: '컵에 물 따르기 흉내', emoji: '🥤', cat: 'food' },
  ],
  '16개월': [
    { label: '빠르게 걷기', emoji: '👟', cat: 'body' },
    { label: '두 단어 조합 시도', emoji: '🗣', cat: 'talk' },
    { label: '신체 부위 3 4개', emoji: '👆', cat: 'brain' },
    { label: '숟가락으로 혼자 먹기', emoji: '🥄', cat: 'hand' },
    { label: '블록 4개 쌓기', emoji: '🧱', cat: 'hand' },
    { label: '간단한 심부름', emoji: '📦', cat: 'brain' },
    { label: '양말 벗기', emoji: '🧦', cat: 'hand' },
    { label: '그림책 좋아하기', emoji: '📚', cat: 'brain' },
  ],
  '17개월': [
    { label: '계단 한 손 잡고 오르기', emoji: '🪜', cat: 'body' },
    { label: '50개 이상 단어 이해', emoji: '🧠', cat: 'brain' },
    { label: '동물 소리 5가지', emoji: '🐄', cat: 'talk' },
    { label: '세로선 그리기', emoji: '✏', cat: 'star' },
    { label: '인형 안아주기', emoji: '🧸', cat: 'heart' },
    { label: '포크 사용 시도', emoji: '🍴', cat: 'hand' },
    { label: '뚜껑 열고 닫기', emoji: '🔓', cat: 'hand' },
    { label: '숨바꼭질 좋아하기', emoji: '🙈', cat: 'star' },
  ],
  '18개월': [
    { label: '달리기 시작', emoji: '🏃', cat: 'body' },
    { label: '두 단어 문장', emoji: '🗣', cat: 'talk' },
    { label: '자기 이름 반응', emoji: '👶', cat: 'brain' },
    { label: '블록 5 6개 쌓기', emoji: '🧱', cat: 'hand' },
    { label: '옷 벗기 시도', emoji: '👕', cat: 'hand' },
    { label: '분류하기 크기 색', emoji: '🔲', cat: 'brain' },
    { label: '그림에 이름 붙이기', emoji: '🖼', cat: 'brain' },
    { label: '또래와 나란히 놀이', emoji: '👫', cat: 'heart' },
  ],
  '19개월': [
    { label: '점프 시도', emoji: '⬆', cat: 'body' },
    { label: '단어 20개 사용', emoji: '🗣', cat: 'talk' },
    { label: '색깔 1 2개 인식', emoji: '🔴', cat: 'brain' },
    { label: '숫자 따라 말하기', emoji: '🔢', cat: 'brain' },
    { label: '감정 표현 시작', emoji: '😊', cat: 'heart' },
    { label: '노래 따라 흥얼', emoji: '🎵', cat: 'star' },
    { label: '지퍼 올리기 시도', emoji: '🤐', cat: 'hand' },
    { label: '혼자 먹기 안정', emoji: '🍴', cat: 'food' },
  ],
  '20개월': [
    { label: '빠르게 달리기', emoji: '🏃', cat: 'body' },
    { label: '공 던지기', emoji: '⚽', cat: 'body' },
    { label: '두 단어 문장 자주', emoji: '🗣', cat: 'talk' },
    { label: '친구에게 관심', emoji: '👫', cat: 'heart' },
    { label: '상상 놀이 시작', emoji: '🎭', cat: 'star' },
    { label: '간단한 퍼즐', emoji: '🧩', cat: 'brain' },
    { label: '블록 6개 쌓기', emoji: '🧱', cat: 'hand' },
    { label: '양치 시도', emoji: '🪥', cat: 'hand' },
  ],
  '21개월': [
    { label: '계단 오르내리기', emoji: '🪜', cat: 'body' },
    { label: '50 단어 사용', emoji: '🗣', cat: 'talk' },
    { label: '이름 말하기', emoji: '👶', cat: 'talk' },
    { label: '크다 작다 이해', emoji: '📐', cat: 'brain' },
    { label: '동그라미 그리기 시도', emoji: '⭕', cat: 'star' },
    { label: '신발 신기 시도', emoji: '👟', cat: 'hand' },
    { label: '차례 기다리기 시도', emoji: '⏳', cat: 'heart' },
    { label: '밥 먹기 싫다 표현', emoji: '🙅', cat: 'food' },
  ],
  '22개월': [
    { label: '두 발 모아 점프', emoji: '⬆', cat: 'body' },
    { label: '세 단어 문장 시도', emoji: '🗣', cat: 'talk' },
    { label: '노래 따라부르기', emoji: '🎵', cat: 'star' },
    { label: '색깔 2 3개 구분', emoji: '🔴', cat: 'brain' },
    { label: '블록으로 기차 만들기', emoji: '🚂', cat: 'star' },
    { label: '포크 사용 안정', emoji: '🍴', cat: 'hand' },
    { label: '옷 벗기 혼자', emoji: '👕', cat: 'hand' },
    { label: '소유욕 강해짐', emoji: '😤', cat: 'heart' },
  ],
  '23개월': [
    { label: '한 발로 서기 시도', emoji: '🦶', cat: 'body' },
    { label: '왜 질문 시작', emoji: '❓', cat: 'brain' },
    { label: '역할 놀이 소꿉', emoji: '🎭', cat: 'star' },
    { label: '4 5조각 퍼즐', emoji: '🧩', cat: 'brain' },
    { label: '간단한 지시 2단계', emoji: '🧠', cat: 'brain' },
    { label: '지퍼 올리기 성공', emoji: '🤐', cat: 'hand' },
    { label: '컵 혼자 따르기', emoji: '🥤', cat: 'food' },
    { label: '친구와 장난감 나누기 시도', emoji: '🤝', cat: 'heart' },
  ],
  '24개월': [
    { label: '두 세 단어 문장 자유', emoji: '🗣', cat: 'talk' },
    { label: '동그라미 그리기', emoji: '⭕', cat: 'star' },
    { label: '세발자전거 관심', emoji: '🚲', cat: 'body' },
    { label: '숫자 1 5 따라 세기', emoji: '🔢', cat: 'brain' },
    { label: '감정 이름 말하기', emoji: '😊', cat: 'heart' },
    { label: '옷 입기 시도', emoji: '👕', cat: 'hand' },
    { label: '혼자 식사 완성', emoji: '🍴', cat: 'food' },
    { label: '화장실 관심', emoji: '🚽', cat: 'hand' },
  ],
  '25~27개월': [
    { label: '100 단어 사용', emoji: '🗣', cat: 'talk' },
    { label: '가위 잡기 시도', emoji: '✂', cat: 'hand' },
    { label: '높은 곳 오르기', emoji: '🧗', cat: 'body' },
    { label: '밥 잘 안 먹는 시기', emoji: '🙅', cat: 'food' },
    { label: '색칠하기 시도', emoji: '🎨', cat: 'star' },
    { label: '숫자 1 3 세기', emoji: '🔢', cat: 'brain' },
    { label: '친구와 놀기', emoji: '👫', cat: 'heart' },
    { label: '화장실 가기 연습', emoji: '🚽', cat: 'hand' },
  ],
  '28~30개월': [
    { label: '규칙 이해 시작', emoji: '📋', cat: 'brain' },
    { label: '왜 질문 폭발', emoji: '❓', cat: 'brain' },
    { label: '역할 놀이 다양화', emoji: '🎭', cat: 'star' },
    { label: '이야기 이해하기', emoji: '📚', cat: 'brain' },
    { label: '이름 쓰기 흉내', emoji: '✏', cat: 'star' },
    { label: '나누기 양보하기', emoji: '🤝', cat: 'heart' },
    { label: '옷 입기 시도', emoji: '👕', cat: 'hand' },
    { label: '한 발로 잠깐 서기', emoji: '🦶', cat: 'body' },
  ],
  '31~33개월': [
    { label: '계단 번갈아 오르기', emoji: '🪜', cat: 'body' },
    { label: '긴 문장 말하기', emoji: '🗣', cat: 'talk' },
    { label: '노래 전체 부르기', emoji: '🎵', cat: 'star' },
    { label: '숫자 1 5 세기', emoji: '🔢', cat: 'brain' },
    { label: '감정 조절 연습', emoji: '😊', cat: 'heart' },
    { label: '단추 끼우기 시도', emoji: '🔘', cat: 'hand' },
    { label: '음식 골고루 시도', emoji: '🍽', cat: 'food' },
    { label: '화장실 혼자 가기 시도', emoji: '🚽', cat: 'hand' },
  ],
  '34~36개월': [
    { label: '세발자전거 타기', emoji: '🚲', cat: 'body' },
    { label: '대화 가능', emoji: '💬', cat: 'talk' },
    { label: '그림으로 표현', emoji: '🎨', cat: 'star' },
    { label: '색깔 5가지 구분', emoji: '🌈', cat: 'brain' },
    { label: '친구 사귀기', emoji: '🤝', cat: 'heart' },
    { label: '가위로 자르기', emoji: '✂', cat: 'hand' },
    { label: '규칙 게임 참여', emoji: '🎲', cat: 'brain' },
    { label: '혼자 옷 입기', emoji: '👕', cat: 'hand' },
  ],
  '4세': [
    { label: '가위바위보', emoji: '✊', cat: 'brain' },
    { label: '수 세기 10이상', emoji: '🔢', cat: 'brain' },
    { label: '한 발로 5초 서기', emoji: '🦶', cat: 'body' },
    { label: '줄넘기 시도', emoji: '🤾', cat: 'body' },
    { label: '이름 쓰기', emoji: '✏', cat: 'star' },
    { label: '이야기 만들기', emoji: '📚', cat: 'star' },
    { label: '차례 지키기', emoji: '⏳', cat: 'heart' },
    { label: '시간 개념 아침 저녁', emoji: '⏰', cat: 'brain' },
  ],
  '5세': [
    { label: '자전거 보조바퀴', emoji: '🚴', cat: 'body' },
    { label: '한글 관심 읽기', emoji: '📝', cat: 'talk' },
    { label: '동화 이해 전달', emoji: '📖', cat: 'brain' },
    { label: '규칙 게임 즐기기', emoji: '🎲', cat: 'star' },
    { label: '혼자 옷 입기 완성', emoji: '👕', cat: 'hand' },
    { label: '친구 관계 형성', emoji: '🤝', cat: 'heart' },
    { label: '그림 상세하게 그리기', emoji: '🎨', cat: 'star' },
    { label: '숫자 20까지 세기', emoji: '🔢', cat: 'brain' },
  ],
  '6세 이상': [
    { label: '자전거 두발', emoji: '🚴', cat: 'body' },
    { label: '읽기 쓰기 시작', emoji: '📝', cat: 'talk' },
    { label: '긴 문장 말하기', emoji: '💬', cat: 'talk' },
    { label: '덧셈 뺄셈 시작', emoji: '🔢', cat: 'brain' },
    { label: '줄넘기 연속', emoji: '🤾', cat: 'body' },
    { label: '규칙 지키기', emoji: '📋', cat: 'heart' },
    { label: '요리 도와주기', emoji: '🧑‍🍳', cat: 'hand' },
    { label: '혼자 준비하기', emoji: '🎒', cat: 'hand' },
  ],
};

/** 마일스톤 레이블로 카테고리 역방향 조회 (피드 카드 컬러에 사용) */
function getMilestoneCategory(label: string): MilestoneCategory | null {
  for (const presets of Object.values(MILESTONE_PRESETS)) {
    const found = presets.find((m) => m.label === label);
    if (found) return found.cat;
  }
  return null;
}

function getMonthKey(months: number): string {
  if (months <= 24) return `${months}개월`;
  if (months <= 27) return '25~27개월';
  if (months <= 30) return '28~30개월';
  if (months <= 33) return '31~33개월';
  if (months <= 36) return '34~36개월';
  if (months <= 48) return '4세';
  if (months <= 60) return '5세';
  return '6세 이상';
}

function getMonthLabel(months: number): string {
  if (months <= 24) return `${months}개월`;
  if (months <= 36) return `${months}개월`;
  if (months <= 48) return `4세 (${months}개월)`;
  if (months <= 60) return `5세 (${months}개월)`;
  return `6세+ (${months}개월)`;
}

interface MilestonePhoto {
  id?: string;
  uri: string;
  date: string;
  milestone?: string;
  milestoneEmoji?: string;
  milestoneColor?: string;  // 카테고리 색상 (#RRGGBB) — PDF 배지 + 피드 배지에 사용
  memo?: string;
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;  // YYYY-MM-DD (백엔드 쿼리와 동일 포맷)
}

/* ------------------------------------------------------------------ */
/* Album HTML generation (expo-print / 기기 내 PDF 생성)               */
/* ------------------------------------------------------------------ */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * 원격 URL(Firebase Storage 등) → base64 data URI 변환
 * expo-print WebView는 외부 URL 이미지를 스냅샷 전에 로드하지 못하므로
 * base64로 embed해야 PDF에서 이미지가 정상 표시됨
 */
/**
 * base64 매직바이트로 실제 이미지 MIME 감지.
 * HTTPS 다운로드 파일은 확장자를 믿을 수 없으므로(Firebase Storage는 PNG/WebP도 같은 URL 구조)
 * base64 앞부분을 보고 정확한 타입을 결정한다.
 */
function detectImageMimeFromBase64(b64: string): string {
  const head = b64.slice(0, 16);
  if (head.startsWith('/9j/')) return 'image/jpeg';
  if (head.startsWith('iVBORw0KG')) return 'image/png';
  if (head.startsWith('R0lGOD')) return 'image/gif';
  if (head.startsWith('UklGR')) return 'image/webp';
  if (head.startsWith('PHN2Zy') || head.startsWith('PD94bW')) return 'image/svg+xml';
  return 'image/jpeg'; // fallback
}

async function uriToDataUri(uri: string): Promise<string> {
  const short = uri.length > 100 ? uri.slice(0, 100) + '…' : uri;
  try {
    if (uri.startsWith('http://') || uri.startsWith('https://')) {
      // 원격 URL: 로컬 캐시로 다운로드 후 base64 변환
      const cacheUri =
        FileSystem.cacheDirectory +
        'album_img_' +
        Math.random().toString(36).slice(2) +
        '.bin';
      console.log('[uriToDataUri] ⬇ downloading', short);
      const dl = await FileSystem.downloadAsync(uri, cacheUri);
      console.log('[uriToDataUri] ✓ downloaded', {
        status: dl.status,
        localUri: dl.uri,
      });
      const b64 = await FileSystem.readAsStringAsync(dl.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const mime = detectImageMimeFromBase64(b64);
      console.log(`[uriToDataUri] ✓ base64 len=${b64.length} mime=${mime}`, short);
      return `data:${mime};base64,${b64}`;
    } else {
      // 로컬 파일 (갤러리 커버 이미지, 번들 에셋 등)
      const b64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const mime = detectImageMimeFromBase64(b64);
      console.log(`[uriToDataUri] ✓ local b64 len=${b64.length} mime=${mime}`, short);
      return `data:${mime};base64,${b64}`;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[uriToDataUri] ✗ FAILED', { uri: short, err: msg });
    return uri; // 실패 시 원본 URI 유지 — 호출 측에서 fallback 감지용
  }
}

/**
 * 기본 표지 이미지(album-cover.png) → base64 data URI (PDF 삽입용)
 * Image.resolveAssetSource로 번들 URI 획득 → uriToDataUri로 base64 변환
 */
async function getDefaultCoverDataUri(): Promise<string | null> {
  if (_defaultCoverB64 && _defaultCoverB64.startsWith('data:')) return _defaultCoverB64;
  try {
    const asset = Asset.fromModule(DEFAULT_COVER_SOURCE);
    await asset.downloadAsync();
    const localUri = asset.localUri || asset.uri;
    if (!localUri) return null;
    const converted = await uriToDataUri(localUri);
    if (!converted.startsWith('data:')) {
      console.warn('[album] default cover conversion failed:', localUri.slice(0, 80));
      return null;
    }
    _defaultCoverB64 = converted;
    return _defaultCoverB64;
  } catch (e) {
    console.warn('[album] getDefaultCoverDataUri error', e);
    return null;
  }
}

/** 마일스톤 레이블 → 백엔드 PNG API URL */
function milestoneImgUrl(label: string): string {
  const apiBase = API_URL.replace(/\/api\/?$/, '');
  return `${apiBase}/api/album/milestone-image?label=${encodeURIComponent(label)}`;
}

/**
 * 마일스톤 이미지 상태 모듈 캐시
 * 같은 레이블을 여러 카드에서 재사용할 때 중복 요청 방지 + X박스 방지
 */
const _imgCache = new Map<string, 'loaded' | 'error'>();

/** 기본 표지 이미지 (album-cover.png) */
const DEFAULT_COVER_SOURCE = require('../../assets/album-cover.png') as number;
/** PDF 생성 시 base64 재변환 방지용 캐시 */
let _defaultCoverB64: string | null = null;

/**
 * 앱 UI용 마일스톤 배지 이미지
 * - 이모지를 기본으로 즉시 표시 (X박스 없음)
 * - 이미지 로드 성공 후에만 일러스트로 교체
 * - 실패 시 이모지 유지
 */
function MilestoneBadgeIcon({
  label, emoji, color,
}: { label: string; emoji: string; color: string }) {
  const cached = _imgCache.get(label);
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>(cached ?? 'loading');

  const onLoad = useCallback(() => {
    _imgCache.set(label, 'loaded');
    setStatus('loaded');
  }, [label]);

  const onError = useCallback(() => {
    _imgCache.set(label, 'error');
    setStatus('error');
  }, [label]);

  // 실패 시에만 이모지 폴백
  if (status === 'error') {
    return (
      <LinearGradient
        colors={[color, color + 'CC']}
        style={styles.feedBadgeCircle}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Text style={styles.feedBadgeEmojiInner}>{emoji}</Text>
      </LinearGradient>
    );
  }

  // loading/loaded: 실제 이미지 렌더 + 로딩 중엔 이모지 오버레이로 X박스 방지
  return (
    <View style={styles.feedBadgeImg}>
      <Image
        source={{ uri: milestoneImgUrl(label) }}
        style={styles.feedBadgeImg}
        contentFit="contain"
        onLoad={onLoad}
        onError={onError}
      />
      {status === 'loading' && (
        <LinearGradient
          colors={[color, color + 'CC']}
          style={[styles.feedBadgeCircle, { position: 'absolute', top: 0, left: 0 }]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.feedBadgeEmojiInner}>{emoji}</Text>
        </LinearGradient>
      )}
    </View>
  );
}

/**
 * @param coverImageUri  표지로 사용할 이미지 URI (제공 시 텍스트 없이 이미지만 표시)
 *                       null이면 기본 그라데이션 표지 사용
 */
function generateAlbumHTML(
  albumPhotos: MilestonePhoto[],
  title: string,
  childName: string,
  dateFrom: string,
  dateTo: string,
  coverImageUri: string | null = null,
  milestoneDataUriMap: Record<string, string> = {},
): string {
  const sorted = [...albumPhotos].sort((a, b) => a.date.localeCompare(b.date));

  // 월별 그룹핑
  const monthsMap = new Map<string, MilestonePhoto[]>();
  for (const p of sorted) {
    const ym = p.date.slice(0, 7);
    if (!monthsMap.has(ym)) monthsMap.set(ym, []);
    monthsMap.get(ym)!.push(p);
  }
  const months = Array.from(monthsMap.entries());

  // 페이지 번호 계산용 (전체 사진 페이지 수)
  const totalPhotoPages = months.reduce(
    (acc, [, ps]) => acc + Math.ceil(ps.length / 4),
    0,
  );

  // ─── 귀퉁이 장식 (모든 페이지 공통) ─────────────────
  const cornerDeco =
    `<div class="page-corner tl">&#128155;</div>` + // 💛
    `<div class="page-corner tr">&#11088;</div>` + // ⭐
    `<div class="page-corner bl">&#127800;</div>` + // 🌸
    `<div class="page-corner br">&#10024;</div>`;   // ✨

  // 표지 이미지가 명시되지 않았으면 첫 사진을 자동 표지로 사용
  const effectiveCoverUri = coverImageUri ?? (sorted[0]?.uri ?? null);

  // ─── 표지 (이미지 위에 아이 이름 + 날짜 오버레이) ─────
  const coverHTML = effectiveCoverUri
    ? `<div class="cover cover-img">` +
      `<img src="${effectiveCoverUri}" alt="" width="1123" height="794" class="cover-bg-img" />` +
      `<div class="cover-overlay">` +
      `<div class="cover-label">Our Precious</div>` +
      `<div class="cover-name">${escapeHtml(childName)}</div>` +
      `<div class="cover-ornament">&#10047;</div>` + // ✿
      `<div class="cover-period">` +
      `${escapeHtml(dateFrom)}<br/>~ ${escapeHtml(dateTo)}` +
      `</div>` +
      `<div class="cover-sign">&#128155; Family Album</div>` +
      `</div>` +
      `</div>`
    : `<div class="cover cover-gradient">` +
      `<div class="cover-star">&#128247;</div>` +
      `<div class="cover-line"></div>` +
      `<div class="cover-title">${escapeHtml(title)}</div>` +
      `<div class="cover-period-alt">${escapeHtml(dateFrom)} ~ ${escapeHtml(dateTo)}</div>` +
      `<div class="cover-line"></div>` +
      `<div class="cover-count">${sorted.length}&#51109;&#51032; &#49548;&#51473;&#54620; &#49688;&#44036;</div>` +
      `</div>`;

  // ─── 월별 섹션 (디바이더 + 사진 페이지) ───────────────────────
  let pageCounter = 0;
  const allPagesHTML = months
    .map(([ym, photos]) => {
      const [y, m] = ym.split('-');
      const monthNum = parseInt(m, 10);
      const yearText = `${y}`;
      const monthText = `${monthNum}`;

      // 월 디바이더 페이지
      const dividerHTML =
        `<div class="divider-page">` +
        cornerDeco +
        `<div class="divider-inner">` +
        `<div class="divider-deco">&#10047;</div>` +
        `<div class="divider-year">${yearText}</div>` +
        `<div class="divider-month">${monthText}<span class="divider-month-unit">월</span></div>` +
        `<div class="divider-rule"></div>` +
        `<div class="divider-caption">&#128155; 소중한 순간 ${photos.length}장 &#128155;</div>` +
        `</div>` +
        `</div>`;

      // 사진 페이지들 (4장씩)
      const photoPagesHTML: string[] = [];
      for (let i = 0; i < photos.length; i += 4) {
        const chunk = photos.slice(i, i + 4);
        pageCounter += 1;
        const cellsHTML = chunk
          .map((photo) => {
            const mColor = photo.milestoneColor ?? '#FF8C5A';
            const msDataUri = photo.milestone
              ? milestoneDataUriMap[photo.milestone]
              : undefined;

            // 마일스톤 스탬프 (폴라로이드 우상단, 회전된 원형 배지)
            // 이모지 대신 기질 색상 + 별 심볼로 안정적 렌더링
            const msStampHTML = photo.milestone
              ? `<div class="ms-stamp" style="border-color:${mColor};background:${mColor};">` +
                `<span class="ms-stamp-text">&#9733;</span>` + // ★
                `</div>`
              : '';

            const milestoneHTML = photo.milestone
              ? `<div class="ms-row">` +
                (msDataUri
                  ? `<div class="ms-img-wrap">` +
                    `<img class="ms-img" src="${msDataUri}" alt="" />` +
                    `</div>`
                  : `<div class="ms-img-wrap">` +
                    `<div class="ms-fallback" style="background:${mColor};display:flex;">` +
                    `<span>${photo.milestoneEmoji ?? '&#127919;'}</span></div>` +
                    `</div>`) +
                `<span class="ms-label" style="color:${mColor};">${escapeHtml(photo.milestone)}</span>` +
                `</div>`
              : '';

            const memoHTML = photo.memo
              ? `<div class="photo-memo">${escapeHtml(photo.memo)}</div>`
              : '';

            return (
              `<div class="photo-cell">` +
              `<div class="photo-img-wrap">` +
              `<img class="photo-img-bg" src="${photo.uri}" alt="" />` +
              `<img class="photo-img" src="${photo.uri}" alt="" />` +
              msStampHTML +
              `</div>` +
              `<div class="photo-caption">` +
              `<div class="photo-date">${escapeHtml(photo.date)}</div>` +
              milestoneHTML +
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
              `<div class="page-header">${monthNum}월 &middot; ${pageCounter} / ${totalPhotoPages}</div>` +
              `<div class="photo-grid">${cellsHTML}${emptyCells}</div>` +
              `</div>`,
          );
        }

      return dividerHTML + photoPagesHTML.join('');
    })
    .join('');

  // ─── 엔딩 감사 페이지 ────────────────────────────────────────
  const endingHTML =
    `<div class="ending-page">` +
    cornerDeco +
    `<div class="ending-heart">&#128155;</div>` + // 💛
    `<div class="ending-msg">사랑해,<br/>소중한 ${escapeHtml(childName)}</div>` +
    `<div class="ending-rule"></div>` +
    `<div class="ending-sub">너의 모든 순간이<br/>우리의 기적이야</div>` +
    `<div class="ending-period">${escapeHtml(dateFrom)} ~ ${escapeHtml(dateTo)}</div>` +
    `</div>`;

  const pagesHTML = allPagesHTML + endingHTML;

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
    body {
      font-family: 'Jua', 'Do Hyeon', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif;
      font-weight: 400;
    }
    /* 공통 화사한 파스텔 배경 (linear-gradient — expo-print Android WebView 호환) */
    html, body { background-color: #FFF6E8; }
    /* ── 표지 공통 (A4 가로: 297 x 210) ── */
    .cover { width: 297mm; height: 210mm; page-break-after: always; overflow: hidden; position: relative; background-color: #FFF6E8; }
    /* 이미지 표지: 단순 img + overlay 구조 (PDF 뷰어 호환성 최대화) */
    .cover-img { display: block; background-color: #FFF6E8; }
    .cover-bg-img {
      display: block;
      width: 297mm;
      height: 210mm;
      object-fit: cover;
      -o-object-fit: cover;
    }
    /* 사진 위에 부드러운 어두움을 더해 텍스트 가독성 향상 — 단일 linear-gradient (Android WebView 호환) */
    .cover-vignette {
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 100%;
      background: linear-gradient(180deg, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.45) 100%);
      z-index: 1;
      pointer-events: none;
    }
    .cover-overlay {
      position: absolute;
      bottom: 14mm; left: 50%;
      transform: translateX(-50%);
      width: 78%;
      text-align: center;
      padding: 10mm 12mm;
      z-index: 2;
      background: rgba(255, 248, 235, 0.92);
      border-radius: 8px;
      border: 1.5px solid rgba(200, 155, 122, 0.45);
      box-shadow: 0 6px 24px rgba(0, 0, 0, 0.25);
    }
    .cover-label {
      font-family: 'Gaegu', 'Jua', cursive;
      font-size: 22px;
      color: #8B6F55;
      letter-spacing: 6px;
      margin-bottom: 6mm;
      text-transform: uppercase;
    }
    .cover-name {
      font-family: 'Single Day', 'Gaegu', cursive;
      font-size: 96px;
      color: #4A3526;
      line-height: 1.05;
      text-shadow: 0.6px 0 0 currentColor, -0.6px 0 0 currentColor;
      margin-bottom: 5mm;
    }
    .cover-ornament {
      font-size: 20px;
      color: #C89B7A;
      margin: 2mm 0 3mm;
    }
    .cover-period {
      font-family: 'Gaegu', 'Jua', cursive;
      font-size: 15px;
      color: #6B5340;
      line-height: 1.4;
      margin-bottom: 3mm;
    }
    .cover-sign {
      font-family: 'Gaegu', 'Jua', cursive;
      font-size: 13px;
      color: #A07858;
      letter-spacing: 1.5px;
    }
    /* 기본 그라데이션 표지 (fallback) */
    .cover-gradient {
      background:
        radial-gradient(circle at 20% 20%, #FFE3EC 0%, transparent 45%),
        radial-gradient(circle at 80% 30%, #D5F0FF 0%, transparent 45%),
        radial-gradient(circle at 50% 90%, #FFF4C4 0%, transparent 50%),
        #FFFBF0;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
    }
    .cover-star { font-size: 64px; margin-bottom: 20px; }
    .cover-line { width: 70px; height: 3px; background: #F4B6C2; margin: 16px auto; border-radius: 2px; }
    .cover-title {
      font-family: 'Single Day', 'Gaegu', cursive;
      font-size: 52px; color: #4A3526; text-align: center;
      padding: 0 30mm; line-height: 1.3;
    }
    .cover-period-alt { font-family: 'Gaegu', cursive; font-size: 22px; color: #8B6F55; margin-top: 10px; }
    .cover-count { font-family: 'Gaegu', cursive; font-size: 18px; color: #A07858; margin-top: 10px; }
    /* ── 페이지 귀퉁이 장식 ── */
    .page-corner {
      position: absolute;
      font-size: 22px;
      opacity: 0.55;
      z-index: 3;
      pointer-events: none;
    }
    .page-corner.tl { top: 6mm; left: 7mm; }
    .page-corner.tr { top: 6mm; right: 7mm; }
    .page-corner.bl { bottom: 6mm; left: 7mm; }
    .page-corner.br { bottom: 6mm; right: 7mm; }
    /* ── 월 디바이더 페이지 ── */
    .divider-page {
      width: 297mm; height: 210mm;
      page-break-after: always;
      position: relative;
      display: flex; align-items: center; justify-content: center;
      background-color: #FFF6E8;
      background-image: linear-gradient(135deg, #FFE3EC 0%, #FFF6E8 30%, #E8F5FF 60%, #F0F9E8 100%);
      overflow: hidden;
    }
    .divider-inner {
      text-align: center;
    }
    .divider-deco {
      font-size: 34px; color: #E8A5B8; margin-bottom: 8mm;
    }
    .divider-year {
      font-family: 'Gaegu', cursive;
      font-size: 32px; color: #8B6F55; letter-spacing: 6px;
      margin-bottom: 4mm;
    }
    .divider-month {
      font-family: 'Black Han Sans', 'Do Hyeon', sans-serif;
      font-size: 180px; color: #4A3526;
      line-height: 1;
      letter-spacing: -4px;
    }
    .divider-month-unit {
      font-family: 'Jua', sans-serif;
      font-size: 56px; color: #C89B7A;
      margin-left: 8px;
    }
    .divider-rule {
      width: 90mm; height: 2px;
      background: linear-gradient(90deg, transparent, #E8A5B8, transparent);
      margin: 10mm auto 6mm;
    }
    .divider-caption {
      font-family: 'Gaegu', cursive;
      font-size: 22px; color: #8B6F55;
    }
    /* ── 내지 (A4 가로, 화사한 파스텔 배경) ── */
    .photo-page {
      width: 297mm; height: 210mm; padding: 14mm 14mm 12mm;
      page-break-after: always; display: flex; flex-direction: column;
      background-color: #FFF6E8;
      background-image: linear-gradient(135deg, #FFE3EC 0%, #FFF6E8 30%, #E8F5FF 60%, #F0F9E8 100%);
      overflow: hidden;
      position: relative;
    }
    .page-header {
      font-family: 'Gaegu', cursive;
      font-size: 15px; color: #8B6F55; text-align: right; margin-bottom: 5mm;
      flex-shrink: 0;
      letter-spacing: 2px;
    }
    .photo-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      grid-template-rows: 1fr 1fr;
      gap: 7mm; flex: 1;
      min-height: 0; /* 내부 셀이 넘치지 않게 */
    }
    /* 폴라로이드 느낌 카드 — grid로 사이즈 제어 */
    .photo-cell {
      background: #FFFFFF;
      padding: 3mm 3mm 2mm 3mm;
      box-shadow: 0 3px 10px rgba(80,60,30,0.22), 0 0 0 0.3mm #F0E5D0;
      display: grid;
      grid-template-rows: 1fr auto; /* 사진은 나머지, 캡션은 내용만큼 */
      gap: 2mm;
      min-height: 0; /* CRITICAL: grid 자식 overflow 방지 */
      overflow: hidden;
      border-radius: 2px;
      position: relative;
    }
    /* 폴라로이드 감성: 각 셀 미세 기울기 */
    .photo-grid > .photo-cell:nth-child(1) { transform: rotate(-0.8deg); }
    .photo-grid > .photo-cell:nth-child(2) { transform: rotate(0.7deg); }
    .photo-grid > .photo-cell:nth-child(3) { transform: rotate(0.6deg); }
    .photo-grid > .photo-cell:nth-child(4) { transform: rotate(-0.7deg); }
    /* 워시테이프 장식 (각 폴라로이드 상단 중앙) */
    .photo-cell::before {
      content: '';
      position: absolute;
      top: -2mm; left: 50%;
      transform: translateX(-50%) rotate(-3deg);
      width: 42mm; height: 7mm;
      background: linear-gradient(135deg, rgba(255,200,140,0.65), rgba(255,170,120,0.55));
      box-shadow: 0 1px 2px rgba(0,0,0,0.08);
      z-index: 2;
      pointer-events: none;
    }
    /* 빈 셀 — 투명 처리 (부자연스러운 점선 제거) */
    .photo-cell-empty {
      background: transparent !important;
      box-shadow: none !important;
      padding: 0 !important;
      border: none !important;
      transform: none !important;
    }
    .photo-cell-empty::before { display: none !important; }
    .photo-img-wrap {
      width: 100%;
      min-height: 0; /* grid 자식 overflow 방지 */
      background: #F5EEE0;
      overflow: hidden;
      position: relative;
      border-radius: 1px;
    }
    /* 블러 배경 (크롭 방지용 letterbox 채움) */
    .photo-img-bg {
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 100%;
      object-fit: cover;
      filter: blur(14px) brightness(0.92);
      transform: scale(1.1);
      opacity: 0.55;
      display: block;
    }
    /* 전경 이미지 (짤림 없이 전체 표시) */
    .photo-img {
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 100%;
      object-fit: contain;
      display: block;
      z-index: 1;
    }
    /* 마일스톤 스탬프 (폴라로이드 우상단 원형 배지) */
    .ms-stamp {
      position: absolute;
      top: 5mm; right: 4mm;
      width: 13mm; height: 13mm;
      border-radius: 50%;
      border: 2px solid rgba(255,255,255,0.9);
      display: flex; align-items: center; justify-content: center;
      transform: rotate(-12deg);
      z-index: 3;
      box-shadow: 0 2px 5px rgba(0,0,0,0.25);
    }
    .ms-stamp-text {
      font-size: 22px;
      color: #FFFFFF;
      line-height: 1;
    }
    .photo-caption {
      padding: 0 1mm;
      display: flex; flex-direction: column;
      gap: 2mm;
      min-height: 0;
      max-height: 22mm; /* 캡션이 사진 영역 침범 방지 */
      overflow: hidden;
    }
    .photo-date {
      font-family: 'Jua', sans-serif;
      font-size: 13px; color: #636366;
      letter-spacing: 0.5px;
    }
    /* 마일스톤 행 */
    .ms-row { display: flex; align-items: center; gap: 6px; min-height: 0; }
    .ms-img-wrap { width: 32px; height: 32px; flex-shrink: 0; position: relative; }
    .ms-img { width: 32px; height: 32px; border-radius: 7px; object-fit: contain; background: #FAF6EE; }
    .ms-fallback {
      width: 32px; height: 32px; border-radius: 7px;
      align-items: center; justify-content: center; font-size: 18px;
      position: absolute; top: 0; left: 0;
    }
    .ms-label {
      font-family: 'Do Hyeon', 'Jua', sans-serif;
      font-size: 15px;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;
    }
    /* 유저 메모 — 두껍고 귀여운 손글씨 (Single Day + text-shadow 굵기 강화) */
    .photo-memo {
      font-family: 'Single Day', 'Gaegu', 'Jua', cursive;
      font-size: 18px;
      color: #3A2A15;
      line-height: 1.25;
      text-shadow: 0.4px 0 0 currentColor, -0.4px 0 0 currentColor, 0 0.4px 0 currentColor;
      overflow: hidden; text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }
    /* ── 엔딩 감사 페이지 ── */
    .ending-page {
      width: 297mm; height: 210mm;
      page-break-after: always;
      position: relative;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      background-color: #FFF6E8;
      background-image: linear-gradient(135deg, #FFE3EC 0%, #FFF6E8 30%, #E8F5FF 60%, #F0F9E8 100%);
      overflow: hidden;
    }
    .ending-heart {
      font-size: 88px;
      margin-bottom: 10mm;
    }
    .ending-msg {
      font-family: 'Single Day', 'Gaegu', cursive;
      font-size: 64px;
      color: #4A3526;
      text-align: center;
      line-height: 1.25;
      text-shadow: 0.6px 0 0 currentColor, -0.6px 0 0 currentColor;
    }
    .ending-rule {
      width: 60mm; height: 2px;
      background: linear-gradient(90deg, transparent, #E8A5B8, transparent);
      margin: 10mm auto;
    }
    .ending-sub {
      font-family: 'Gaegu', cursive;
      font-size: 24px;
      color: #8B6F55;
      text-align: center;
      line-height: 1.5;
      margin-bottom: 8mm;
    }
    .ending-period {
      font-family: 'Gaegu', cursive;
      font-size: 16px;
      color: #A07858;
      letter-spacing: 2px;
    }
  </style>
</head>
<body>
  ${coverHTML}
  ${pagesHTML}
</body>
</html>`;
}

/* ------------------------------------------------------------------ */
/* Pregnancy Timeline (for pregnant users)                             */
/* ------------------------------------------------------------------ */

interface PregnancyTimelineWeek {
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

function PregnancyTimeline() {
  const child = useChildStore((s) => s.selectedChild);
  const childId = child?.id ?? '';
  const currentWeek = child?.pregnancyWeeks ?? 0;
  const [timeline, setTimeline] = useState<PregnancyTimelineWeek[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  /* AI Diary */
  const [diaryText, setDiaryText] = useState<string | null>(null);
  const [diaryLoading, setDiaryLoading] = useState(false);
  const [diaryDate, setDiaryDate] = useState<string | null>(null);

  const loadTimeline = useCallback(async () => {
    if (!childId) return;
    try {
      const res = await pregnancyApi.getTimeline(childId);
      setTimeline(res.data.data ?? []);
    } catch { /* silent */ }
  }, [childId]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadTimeline();
      setLoading(false);
    })();
  }, [loadTimeline]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTimeline();
    setRefreshing(false);
  };

  const handleDelete = (id: string) => {
    if (id.startsWith('dev-')) return;
    Alert.alert('삭제', '이 기록을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive',
        onPress: async () => {
          try {
            await pregnancyApi.deleteRecord(id);
            loadTimeline();
          } catch { Alert.alert('오류', '삭제에 실패했습니다'); }
        },
      },
    ]);
  };

  /* -- AI Diary -- */
  const generateDiary = useCallback(async () => {
    if (!childId) return;
    setDiaryLoading(true);
    try {
      const res = await coachingApi.dailyDiary(childId);
      const data = res.data?.data as { diary?: string; date?: string } | undefined;
      if (data?.diary) {
        setDiaryText(data.diary);
        setDiaryDate(data.date ?? new Date().toISOString().slice(0, 10));
      } else {
        Alert.alert('알림', '오늘의 기록이 아직 없어서 일기를 생성할 수 없어요.');
      }
    } catch {
      Alert.alert('오류', 'AI 일기 생성에 실패했습니다.');
    } finally {
      setDiaryLoading(false);
    }
  }, [childId]);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: `${child?.name ?? '아가'} 임신 성장앨범`, headerShown: true }} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.childLabel}>{child?.name ?? '아가'}의 임신 성장앨범</Text>

        {/* Current week badge */}
        {currentWeek > 0 && (
          <View style={pStyles.currentBadge}>
            <Text style={pStyles.currentBadgeText}>{'🤰'} 현재 임신 {currentWeek}주차</Text>
          </View>
        )}

        {/* AI Diary compact button */}
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
              <Text style={styles.aiDiaryBtnEmoji}>{'📝'}</Text>
              <Text style={styles.aiDiaryBtnText}>AI 오늘 일기</Text>
            </>
          )}
        </TouchableOpacity>

        {/* AI Diary Result */}
        {diaryText && (
          <View style={styles.diaryCard}>
            <View style={styles.diaryHeader}>
              <Text style={styles.diaryHeaderText}>{'📝'} AI 일기 - {diaryDate}</Text>
              <TouchableOpacity onPress={() => setDiaryText(null)}>
                <Text style={styles.diaryClose}>{'✕'}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.diaryBody}>{diaryText}</Text>
          </View>
        )}

        {loading && <ActivityIndicator style={{ marginTop: 20 }} color={COLORS.primary} />}

        {/* Timeline weeks */}
        {timeline.map((weekGroup) => (
          <View key={weekGroup.week} style={pStyles.weekGroup}>
            <View style={pStyles.weekHeaderRow}>
              <View style={[pStyles.weekBadge, weekGroup.week === currentWeek && pStyles.weekBadgeCurrent]}>
                <Text style={pStyles.weekBadgeText}>임신 {weekGroup.week}주차</Text>
              </View>
              <View style={pStyles.weekLine} />
            </View>

            {weekGroup.items.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  pStyles.card,
                  item.source === 'development' && pStyles.cardDev,
                  item.source === 'health' && pStyles.cardHealth,
                ]}
                onLongPress={() => handleDelete(item.id)}
                activeOpacity={0.7}
              >
                <Text style={pStyles.cardEmoji}>{item.emoji || '📌'}</Text>
                <View style={pStyles.cardBody}>
                  <Text style={pStyles.cardTitle}>{item.title}</Text>
                  {item.content ? <Text style={pStyles.cardContent} numberOfLines={3}>{item.content}</Text> : null}
                  {item.mediaUri ? (
                    <Image source={{ uri: item.mediaUri }} style={pStyles.cardImage} contentFit="cover" />
                  ) : null}
                  {item.createdAt ? (
                    <Text style={pStyles.cardDate}>{new Date(item.createdAt).toLocaleDateString('ko-KR')}</Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ))}

        {!loading && timeline.length === 0 && (
          <View style={{ alignItems: 'center', paddingVertical: 60 }}>
            <Text style={{ fontSize: 48, marginBottom: 12 }}>{'📝'}</Text>
            <Text style={{ fontSize: FONT_SIZE.lg, fontWeight: '600', color: COLORS.text }}>아직 기록이 없어요</Text>
            <Text style={{ fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 4, textAlign: 'center' }}>
              임신 기록에서 초음파, 마일스톤, 엄마 상태를 기록하면{'\n'}성장앨범에 자동으로 나타나요
            </Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const pStyles = StyleSheet.create({
  currentBadge: {
    backgroundColor: '#FCE4EC', borderRadius: RADIUS.full,
    paddingHorizontal: 16, paddingVertical: 8, alignSelf: 'center', marginBottom: SPACING.md,
  },
  currentBadgeText: { fontSize: FONT_SIZE.md, fontWeight: '700', color: '#C2185B' },
  weekGroup: { marginBottom: SPACING.lg },
  weekHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
  weekBadge: {
    backgroundColor: '#E91E63', borderRadius: RADIUS.full,
    paddingHorizontal: 12, paddingVertical: 4,
  },
  weekBadgeCurrent: { backgroundColor: '#C2185B' },
  weekBadgeText: { color: '#FFF', fontSize: FONT_SIZE.sm, fontWeight: '700' },
  weekLine: { flex: 1, height: 1, backgroundColor: COLORS.border, marginLeft: SPACING.sm },
  card: {
    flexDirection: 'row', backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
    padding: SPACING.md, marginBottom: SPACING.sm, marginLeft: 20, ...SHADOWS.soft,
  },
  cardDev: { backgroundColor: '#FFF3E0', borderLeftWidth: 3, borderLeftColor: '#FF9800' },
  cardHealth: { backgroundColor: '#FCE4EC', borderLeftWidth: 3, borderLeftColor: '#E91E63' },
  cardEmoji: { fontSize: 24, marginRight: SPACING.sm },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text },
  cardContent: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 4, lineHeight: 20, fontWeight: '600' },
  cardDate: { fontSize: FONT_SIZE.xs, color: COLORS.textLight, marginTop: 4, fontWeight: '600' },
  cardImage: { width: '100%', height: 160, borderRadius: RADIUS.sm, marginTop: SPACING.sm, backgroundColor: COLORS.surfaceLight },
});

/* ------------------------------------------------------------------ */
/* Baby Album (original)                                               */
/* ------------------------------------------------------------------ */

export default function AlbumScreen() {
  const selectedChild = useChildStore((s) => s.selectedChild);

  // Pregnant users see pregnancy timeline
  if (selectedChild?.isPregnant) {
    return <PregnancyTimeline />;
  }

  return <BabyAlbum />;
}


function BabyAlbum() {
  const [photos, setPhotos] = useState<MilestonePhoto[]>([]);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [pendingUri, setPendingUri] = useState<string | null>(null);
  const [selectedMilestone, setSelectedMilestone] = useState<MilestoneItem | null>(null);
  const [memo, setMemo] = useState('');
  const [shareToMomstagram, setShareToMomstagram] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const selectedChild = useChildStore((s) => s.selectedChild);
  const addPost = useMomstagramStore((s) => s.addPost);

  // ─── 앨범 생성 상태 ─────────────────────────────────────────
  const [albumGenerating, setAlbumGenerating] = useState(false);
  const [albumDateFrom, setAlbumDateFrom] = useState('');   // "YYYY-MM"
  const [albumDateTo, setAlbumDateTo] = useState('');       // "YYYY-MM"
  const [albumTitle, setAlbumTitle] = useState('');
  const [albumCoverUri, setAlbumCoverUri] = useState<string | null>(null); // 표지 이미지
  const [showAlbumForm, setShowAlbumForm] = useState(false);

  /* AI Diary */
  const [diaryText, setDiaryText] = useState<string | null>(null);
  const [diaryLoading, setDiaryLoading] = useState(false);
  const [diaryDate, setDiaryDate] = useState<string | null>(null);

  const childMonths = selectedChild?.birthDate
    ? Math.floor((Date.now() - new Date(selectedChild.birthDate).getTime()) / (1000 * 60 * 60 * 24 * 30.44))
    : 12;
  const [viewMonth, setViewMonth] = useState(childMonths);
  const monthKey = getMonthKey(viewMonth);
  const monthLabel = getMonthLabel(viewMonth);
  const presets = MILESTONE_PRESETS[monthKey] ?? MILESTONE_PRESETS['12개월'];

  // 사진 + 앨범 목록 로드 (cache-first SWR)
  const loadPhotos = useCallback(async () => {
    if (!selectedChild) return;
    const cacheKey = `album_photos_${selectedChild.id}`;

    // 1단계: 캐시 즉시 표시
    const cached = await readCache<MilestonePhoto[]>(cacheKey);
    if (cached && Array.isArray(cached)) {
      setPhotos(cached);
    }

    // 2단계: 백그라운드 새로고침
    try {
      const res = await albumApi.list(selectedChild.id);
      const data = res.data?.data;
      if (Array.isArray(data)) {
        const mapped: MilestonePhoto[] = data.map((p: Record<string, unknown>) => ({
          id: p.id as string,
          uri: p.uri as string,
          date: (p.date as string) ?? '',
          milestone: (p.milestone as string) ?? undefined,
          milestoneEmoji: (p.milestoneEmoji as string) ?? undefined,
          milestoneColor: (p.milestoneColor as string) ?? undefined,
          memo: (p.memo as string) ?? undefined,
        }));
        setPhotos(mapped);
        void writeCache(cacheKey, mapped);
      }
    } catch { /* 새로고침 실패 시 캐시 유지 */ }
  }, [selectedChild]);

  useEffect(() => {
    loadPhotos();
  }, [loadPhotos]);

  // 앨범 생성 기간 기본값: 아이 출생월~현재 (최대 12개월)
  useEffect(() => {
    if (!selectedChild?.birthDate) return;
    const birth = new Date(selectedChild.birthDate);
    const now = new Date();
    const from = new Date(Math.max(birth.getTime(), new Date(now.getFullYear(), now.getMonth() - 11, 1).getTime()));
    setAlbumDateFrom(`${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}`);
    setAlbumDateTo(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  }, [selectedChild]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPhotos();
    setRefreshing(false);
  };

  const pickImage = useCallback(async () => {
    // allowsEditing: true → 선택 후 바로 crop UI 표시 (동일 비율 강제)
    // aspect: [4, 3] → PDF 앨범 셀 비율에 맞게 통일
    const picked = await pickImageFromLibrary({ quality: 0.9, allowsEditing: true, aspect: [4, 3] });
    if (picked) setPendingUri(picked.uri);
  }, []);

  const pickCoverImage = useCallback(async () => {
    // 표지 이미지는 A4 세로 비율(3:4)로 crop
    const picked = await pickImageFromLibrary({ quality: 1.0, allowsEditing: true, aspect: [3, 4] });
    if (picked) setAlbumCoverUri(picked.uri);
  }, []);

  /* -- AI Diary -- */
  const generateDiary = useCallback(async () => {
    if (!selectedChild) return;
    setDiaryLoading(true);
    try {
      const res = await coachingApi.dailyDiary(selectedChild.id);
      const data = res.data?.data as { diary?: string; date?: string } | undefined;
      if (data?.diary) {
        setDiaryText(data.diary);
        setDiaryDate(data.date ?? new Date().toISOString().slice(0, 10));
      }
    } catch {
      Alert.alert('오류', 'AI 일기 생성에 실패했습니다.');
    } finally {
      setDiaryLoading(false);
    }
  }, [selectedChild]);

  /* -- Save entry (thumb 400px + print 1800px 두 버전 저장) -- */
  const saveEntry = useCallback(async () => {
    if (!pendingUri || !selectedChild) return;
    setSaving(true);

    // 1. 두 버전으로 리사이즈 후 Firebase Storage 업로드
    //    thumb(400px): 앱 표시용, print(1800px): A4 앨범 인쇄용
    let thumbUrl = pendingUri;
    let printUrl = pendingUri;
    try {
      const uploaded = await uploadGrowthPhoto(pendingUri, selectedChild.id);
      thumbUrl = uploaded.thumbUrl;
      printUrl = uploaded.printUrl;
    } catch {
      // 업로드 실패 시 단일 버전으로 재시도
      try {
        const fallback = await uploadApi.upload(pendingUri, 'album');
        thumbUrl = fallback.url;
        printUrl = fallback.url;
        Alert.alert('알림', '일반 화질로 저장됐어요. 인쇄용 앨범 생성 시 화질이 낮을 수 있어요.');
      } catch {
        // 완전 실패 시 로컬 URI 유지 + 사용자 안내
        Alert.alert('저장 알림', '사진을 서버에 업로드하지 못했어요. 앨범 PDF 생성 시 이 사진은 포함되지 않을 수 있어요.');
      }
    }

    const dateStr = formatDate(new Date());
    const newPhoto: MilestonePhoto = {
      uri: thumbUrl,
      date: dateStr,
      milestone: selectedMilestone?.label,
      milestoneEmoji: selectedMilestone?.emoji,
      milestoneColor: selectedMilestone ? CATEGORY_COLORS[selectedMilestone.cat] : undefined,
      memo: memo.trim() || undefined,
    };

    // 2. Firestore에 영구 저장 (thumbUrl + printUrl 모두 저장)
    try {
      const res = await albumApi.save({
        childId: selectedChild.id,
        uri: thumbUrl,
        printUrl,
        milestone: selectedMilestone?.label,
        milestoneEmoji: selectedMilestone?.emoji,
        milestoneColor: selectedMilestone ? CATEGORY_COLORS[selectedMilestone.cat] : undefined,
        memo: memo.trim() || undefined,
        date: dateStr,
      });
      const saved = res.data?.data;
      if (saved?.id) newPhoto.id = saved.id as string;
    } catch {
      // Firestore 저장 실패해도 로컬에 표시
    }

    setPhotos((prev) => [newPhoto, ...prev]);
    setPendingUri(null);
    setSelectedMilestone(null);
    setMemo('');
    setShareToMomstagram(false);
    setSaving(false);

    // 가족피드에도 공유
    if (shareToMomstagram && selectedChild) {
      const milestoneText = selectedMilestone
        ? `${selectedMilestone.emoji} ${selectedMilestone.label}`
        : '성장 기록';
      const content = memo.trim()
        ? `${milestoneText}\n${memo.trim()}`
        : `${milestoneText} - ${selectedChild.name}의 성장앨범`;
      const childAge = selectedChild.ageInfo?.months
        ? `${selectedChild.ageInfo.months}개월`
        : '';
      try {
        let cloudUrl: string | undefined;
        try {
          const uploaded = await uploadApi.upload(pendingUri, 'momstagram');
          cloudUrl = uploaded.url;
        } catch { /* 업로드 실패 시 로컬 URI 폴백 */ }
        const res = await momstagramApi.createPost({
          content,
          imageUrl: cloudUrl ?? pendingUri,
          sourceType: 'album',
          childAge: childAge || undefined,
          childGender: selectedChild.gender ?? undefined,
          dominantType: selectedChild.innateData?.dominantType ?? undefined,
          milestone: selectedMilestone?.label,
          milestoneEmoji: selectedMilestone?.emoji,
        });
        const data = res.data;
        const apiPost = data.data ?? data.post ?? data;
        addPost({
          id: apiPost?.id ?? Date.now().toString(36),
          userName: apiPost?.userName ?? '나',
          childGender: (selectedChild.gender ?? 'M') as 'M' | 'F',
          childAge,
          dominantType: selectedChild.innateData?.dominantType ?? '',
          imageUri: apiPost?.imageUrl ?? pendingUri,
          videoUrl: null,
          mediaType: 'image',
          content,
          milestone: selectedMilestone?.label,
          milestoneEmoji: selectedMilestone?.emoji,
          likes: 0,
          liked: false,
          comments: [],
          createdAt: apiPost?.createdAt ?? new Date().toISOString(),
          isPrivate: false,
        });
        Alert.alert('공유 완료', '가족피드에도 게시되었습니다.');
      } catch {
        Alert.alert('알림', '성장앨범은 저장되었지만 가족피드 공유에 실패했습니다.');
      }
    }
  }, [pendingUri, selectedMilestone, memo, shareToMomstagram, selectedChild, addPost]);

  // ─── 앨범 생성 핸들러 (expo-print 기기 내 생성) ─────────────
  const handleGenerateAlbum = useCallback(async () => {
    if (!selectedChild || !albumDateFrom || !albumDateTo) return;
    setAlbumGenerating(true);
    try {
      // 날짜 범위 필터 (photo.date: YYYY-MM-DD, 범위: YYYY-MM)
      const fromYM = albumDateFrom.slice(0, 7);
      const toYM   = albumDateTo.slice(0, 7);
      const filtered = photos
        .filter((p) => {
          const ym = p.date.slice(0, 7);
          return ym >= fromYM && ym <= toYM;
        })
        .sort((a, b) => a.date.localeCompare(b.date));

      if (filtered.length === 0) {
        Alert.alert('사진 없음', '선택한 기간에 사진이 없어요.\n먼저 사진을 추가해주세요.');
        return;
      }

      const title =
        albumTitle.trim() ||
        `${selectedChild.name} 성장앨범 ${albumDateFrom}~${albumDateTo}`;

      // expo-print WebView는 외부 URL을 PDF 스냅샷 전에 로드 못함 → base64 embed
      console.log('[album] 🔁 변환 시작: 총', filtered.length, '장');
      let convertFailCount = 0;
      const photosForPdf = await Promise.all(
        filtered.map(async (p, idx) => {
          const converted = await uriToDataUri(p.uri);
          const ok = converted.startsWith('data:');
          if (!ok) convertFailCount += 1;
          console.log(`[album] 사진 ${idx + 1}/${filtered.length} ${ok ? '✓' : '✗'} (${p.date})`);
          return { ...p, uri: converted };
        })
      );
      console.log(`[album] 📊 변환 결과: 성공 ${filtered.length - convertFailCount} / 실패 ${convertFailCount}`);

      const rawCoverDataUri = albumCoverUri
        ? await uriToDataUri(albumCoverUri)
        : await getDefaultCoverDataUri();
      const coverDataUri = rawCoverDataUri && rawCoverDataUri.startsWith('data:') ? rawCoverDataUri : null;
      console.log('[album] 표지:', coverDataUri ? '✓ data URI' : '✗ fallback/null');

      // 마일스톤 아이콘 HTTPS URL → base64 data URI 변환 (중복 제거)
      const uniqueMilestones = Array.from(
        new Set(filtered.map((p) => p.milestone).filter((m): m is string => !!m))
      );
      console.log('[album] 마일스톤 종류:', uniqueMilestones.length, uniqueMilestones);
      const milestoneDataUriMap: Record<string, string> = {};
      await Promise.all(
        uniqueMilestones.map(async (label) => {
          const url = milestoneImgUrl(label);
          const dataUri = await uriToDataUri(url);
          if (dataUri.startsWith('data:')) {
            milestoneDataUriMap[label] = dataUri;
          } else {
            console.warn('[album] 마일스톤 변환 실패:', label);
          }
        })
      );
      console.log('[album] 마일스톤 변환 성공:', Object.keys(milestoneDataUriMap).length, '/', uniqueMilestones.length);

      const html = generateAlbumHTML(photosForPdf, title, selectedChild.name, albumDateFrom, albumDateTo, coverDataUri, milestoneDataUriMap);
      const { uri } = await Print.printToFileAsync({ html, base64: false });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: '앨범 저장',
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('저장 완료', `앨범 PDF가 생성됐어요.\n${uri}`);
      }
      if (convertFailCount > 0) {
        Alert.alert(
          '일부 사진 변환 실패',
          `${filtered.length}장 중 ${convertFailCount}장이 PDF에 제대로 포함되지 않았을 수 있어요.\nMetro 콘솔 로그를 공유해주세요.`
        );
      }
      setShowAlbumForm(false);
      setAlbumTitle('');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert('오류', `앨범 생성에 실패했습니다.\n${msg}`);
    } finally {
      setAlbumGenerating(false);
    }
  }, [selectedChild, albumDateFrom, albumDateTo, albumTitle, albumCoverUri, photos]);

  /* -- Delete entry -- */
  const deleteEntry = useCallback((idx: number) => {
    const photo = photos[idx];
    Alert.alert('삭제', '이 기록을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive',
        onPress: async () => {
          if (photo.id) {
            try {
              await albumApi.remove(photo.id);
            } catch { /* 서버 삭제 실패해도 로컬 제거 */ }
          }
          setPhotos((prev) => prev.filter((_, i) => i !== idx));
        },
      },
    ]);
  }, [photos]);

  const viewerPhoto = viewerIndex !== null ? photos[viewerIndex] : null;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: '성장앨범', headerShown: true }} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {selectedChild && (
          <Text style={styles.childLabel}>
            {selectedChild.name}의 성장앨범
          </Text>
        )}

        {/* ============================================ */}
        {/* Inline compose section                       */}
        {/* ============================================ */}
        <View style={styles.composeCard}>
          {/* Photo picker / preview */}
          {pendingUri ? (
            <View>
              <Image source={{ uri: pendingUri }} style={styles.composePhoto} contentFit="cover" />
              <TouchableOpacity style={styles.composePhotoChange} onPress={pickImage} activeOpacity={0.7}>
                <Text style={styles.composePhotoChangeText}>변경</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.composePhotoPlaceholder} onPress={pickImage} activeOpacity={0.7}>
              <Text style={styles.composePlaceholderEmoji}>{'📷'}</Text>
              <Text style={styles.composePlaceholderText}>사진을 추가하세요</Text>
            </TouchableOpacity>
          )}

          {/* Compact month navigation */}
          <View style={styles.monthNav}>
            <TouchableOpacity
              onPress={() => setViewMonth((v) => Math.max(0, v - 1))}
              disabled={viewMonth <= 0}
              activeOpacity={0.6}
            >
              <Text style={[styles.monthNavArrow, viewMonth <= 0 && { opacity: 0.3 }]}>{'◀'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setViewMonth(childMonths)} activeOpacity={0.7}>
              <Text style={styles.monthNavLabel}>{monthLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setViewMonth((v) => v + 1)} activeOpacity={0.6}>
              <Text style={styles.monthNavArrow}>{'▶'}</Text>
            </TouchableOpacity>
          </View>

          {/* Milestone chips (horizontal scroll) */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.composeChipScroll}>
            {presets.map((ms) => {
              const isActive = selectedMilestone?.label === ms.label;
              const catColor = CATEGORY_COLORS[ms.cat] ?? COLORS.primary;
              return (
                <TouchableOpacity
                  key={ms.label}
                  style={styles.composeChipWrap}
                  onPress={() => setSelectedMilestone(isActive ? null : ms)}
                  activeOpacity={0.75}
                >
                  <LinearGradient
                    colors={isActive
                      ? [catColor, catColor + 'CC']
                      : [catColor + '35', catColor + '20']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[
                      styles.composeChip,
                      { borderColor: catColor },
                      isActive && styles.composeChipActive,
                    ]}
                  >
                    <Text style={styles.composeChipEmoji}>{ms.emoji}</Text>
                    <Text style={[
                      styles.composeChipText,
                      isActive && styles.composeChipTextActive,
                    ]}>
                      {ms.label}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Memo input */}
          <TextInput
            style={styles.composeInput}
            placeholder="하고싶은 이야기를 적으세요..."
            placeholderTextColor={COLORS.textLight}
            value={memo}
            onChangeText={setMemo}
            multiline
          />

          {/* Bottom: share toggle + save */}
          <View style={styles.composeBottom}>
            <TouchableOpacity
              style={styles.composeShareRow}
              onPress={() => setShareToMomstagram((v) => !v)}
              activeOpacity={0.7}
            >
              <Switch
                value={shareToMomstagram}
                onValueChange={setShareToMomstagram}
                trackColor={{ false: '#E0E0E0', true: COLORS.primary }}
                thumbColor="#FFFFFF"
                style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
              />
              <Text style={styles.composeShareLabel}>가족피드 공유</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.composeSaveBtn, !pendingUri && { opacity: 0.4 }]}
              onPress={saveEntry}
              disabled={!pendingUri || saving}
              activeOpacity={0.7}
            >
              {saving ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Text style={styles.composeSaveBtnText}>기록하기</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* AI Diary compact button */}
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
              <Text style={styles.aiDiaryBtnEmoji}>{'📝'}</Text>
              <Text style={styles.aiDiaryBtnText}>AI 오늘 일기</Text>
            </>
          )}
        </TouchableOpacity>

        {/* AI Diary Result */}
        {diaryText && (
          <View style={styles.diaryCard}>
            <View style={styles.diaryHeader}>
              <Text style={styles.diaryHeaderText}>{'📝'} AI 일기 - {diaryDate}</Text>
              <TouchableOpacity onPress={() => setDiaryText(null)}>
                <Text style={styles.diaryClose}>{'✕'}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.diaryBody}>{diaryText}</Text>
          </View>
        )}

        {/* ============================================ */}
        {/* Instagram-style feed                         */}
        {/* ============================================ */}
        {photos.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Image
              source={require('../../assets/empty-album.png')}
              style={styles.emptyImage}
              contentFit="contain"
            />
            <Text style={styles.emptyText}>아직 사진이 없습니다</Text>
            <Text style={styles.emptyHint}>위에서 사진을 추가해보세요</Text>
          </View>
        ) : (
          <>
            <Text style={styles.feedCount}>{photos.length}장의 기록</Text>

            {photos.map((photo, idx) => {
              const feedCat = photo.milestone ? getMilestoneCategory(photo.milestone) : null;
              const feedColor = feedCat
                ? CATEGORY_COLORS[feedCat]
                : (photo.milestoneColor || COLORS.primary);
              return (
                <TouchableOpacity
                  key={photo.id ?? idx}
                  style={styles.feedCard}
                  onPress={() => setViewerIndex(idx)}
                  onLongPress={() => deleteEntry(idx)}
                  activeOpacity={0.85}
                >
                  <Image source={{ uri: photo.uri }} style={styles.feedImage} contentFit="cover" />
                  {/* 카테고리 컬러 좌측 스트립 */}
                  {photo.milestone && (
                    <View style={[styles.feedStrip, { backgroundColor: feedColor }]} />
                  )}
                  <View style={styles.feedInfo}>
                    <Text style={styles.feedDate}>{photo.date}</Text>
                    {photo.milestone && (
                      <View style={[styles.feedBadge, { borderColor: feedColor + '66' }]}>
                        <MilestoneBadgeIcon
                          label={photo.milestone}
                          emoji={photo.milestoneEmoji ?? '🎯'}
                          color={feedColor}
                        />
                        <Text style={[styles.feedBadgeText, { color: feedColor }]}>{photo.milestone}</Text>
                      </View>
                    )}
                    {photo.memo && <Text style={styles.feedMemo}>{photo.memo}</Text>}
                  </View>
                </TouchableOpacity>
              );
            })}
          </>
        )}

        {/* ====================================================== */}
        {/* 성장 앨범 PDF 생성 섹션                                  */}
        {/* ====================================================== */}
        <View style={styles.albumSection}>
          <View style={styles.albumSectionHeader}>
            <Text style={styles.albumSectionTitle}>{'📚 성장 앨범 만들기'}</Text>
            <TouchableOpacity
              onPress={() => setShowAlbumForm((v) => !v)}
              style={styles.albumNewBtn}
              activeOpacity={0.8}
            >
              <Text style={styles.albumNewBtnText}>{showAlbumForm ? '닫기' : '+ 새 앨범'}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.albumSectionDesc}>
            {'기간을 선택하면 기기에서 바로 PDF를 만들어요.\n생성 후 카카오톡 · 드라이브 · 인쇄소로 공유하세요'}
          </Text>

          {/* 임신기록 자동 병합 안내 */}
          <View style={styles.pregMergeHint}>
            <Text style={styles.pregMergeEmoji}>🤰</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.pregMergeTitle}>임신기록이 자동으로 포함돼요</Text>
              <Text style={styles.pregMergeDesc}>임신 중 저장한 사진·초음파가 날짜순으로 앨범 앞부분에 이어져요</Text>
            </View>
          </View>

          {/* 앨범 생성 폼 */}
          {showAlbumForm && (
            <View style={styles.albumForm}>
              <Text style={styles.albumFormLabel}>앨범 제목 (선택)</Text>
              <TextInput
                style={styles.albumFormInput}
                placeholder={`${selectedChild?.name ?? '아이'} 성장앨범`}
                value={albumTitle}
                onChangeText={setAlbumTitle}
                maxLength={30}
              />
              <View style={styles.albumDateRow}>
                <View style={styles.albumDateField}>
                  <Text style={styles.albumFormLabel}>시작 월</Text>
                  <TextInput
                    style={styles.albumFormInput}
                    placeholder="2024-01"
                    value={albumDateFrom}
                    onChangeText={setAlbumDateFrom}
                    maxLength={7}
                    keyboardType="numbers-and-punctuation"
                  />
                </View>
                <Text style={styles.albumDateSep}>{'~'}</Text>
                <View style={styles.albumDateField}>
                  <Text style={styles.albumFormLabel}>종료 월</Text>
                  <TextInput
                    style={styles.albumFormInput}
                    placeholder="2024-12"
                    value={albumDateTo}
                    onChangeText={setAlbumDateTo}
                    maxLength={7}
                    keyboardType="numbers-and-punctuation"
                  />
                </View>
              </View>
              <Text style={styles.albumFormHint}>
                {'💡 YYYY-MM 형식 · 최대 84개월(7년) · 페이지당 사진 4장'}
              </Text>

              {/* 표지 이미지 선택 */}
              <Text style={styles.albumFormLabel}>표지 이미지 (선택)</Text>
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
                      contentFit="cover"
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
                      contentFit="cover"
                    />
                    <View style={styles.albumCoverDefaultOverlay}>
                      <Text style={styles.albumCoverDefaultText}>{'기본 표지 · 탭하여 변경'}</Text>
                    </View>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.albumGenerateBtn, albumGenerating && styles.albumGenerateBtnDisabled]}
                onPress={handleGenerateAlbum}
                disabled={albumGenerating || !albumDateFrom || !albumDateTo}
                activeOpacity={0.8}
              >
                {albumGenerating
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.albumGenerateBtnText}>{'📄 앨범 생성 시작'}</Text>
                }
              </TouchableOpacity>
            </View>
          )}

        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Full-screen viewer */}
      {viewerPhoto && (
        <PhotoViewer
          visible={viewerIndex !== null}
          uri={viewerPhoto.uri}
          date={viewerPhoto.date}
          onClose={() => setViewerIndex(null)}
        />
      )}

      <AdSlot />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingTop: SPACING.md, paddingBottom: 80 },
  childLabel: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.sm },
  countText: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginBottom: SPACING.md },

  /* Compose card */
  composeCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.md,
    marginBottom: SPACING.md, ...SHADOWS.soft,
  },
  composePhoto: {
    width: '100%', height: 180, borderRadius: RADIUS.md, marginBottom: SPACING.sm,
  },
  composePhotoPlaceholder: {
    width: '100%', height: 120, borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceLight, borderWidth: 1, borderColor: COLORS.border,
    borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  composePlaceholderEmoji: { fontSize: 32, marginBottom: 4 },
  composePlaceholderText: { fontSize: FONT_SIZE.sm, color: COLORS.textLight, fontWeight: '700' },
  composePhotoChange: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: RADIUS.sm,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  composePhotoChangeText: { fontSize: FONT_SIZE.xs, color: '#FFF', fontWeight: '600' },

  /* Compact month nav (inside compose) */
  monthNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: SPACING.xs, marginBottom: SPACING.sm, gap: SPACING.md,
  },
  monthNavArrow: { fontSize: 12, color: COLORS.primary, fontWeight: '700', padding: 4 },
  monthNavLabel: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text },

  /* Compose chips */
  composeChipScroll: { marginBottom: SPACING.sm, maxHeight: 56 },
  composeChipWrap: { marginRight: 7 },
  composeChip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: RADIUS.full, borderWidth: 1.5,
  },
  composeChipActive: { },
  composeChipEmoji: { fontSize: 16, marginRight: 5 },
  composeChipText: { fontSize: 12, fontWeight: '700', color: '#444' },
  composeChipTextActive: { color: '#FFF' },

  /* Compose input */
  composeInput: {
    height: 50, borderRadius: RADIUS.sm, backgroundColor: COLORS.surfaceLight,
    paddingHorizontal: 12, paddingVertical: 8, fontSize: FONT_SIZE.sm, color: '#5C3D1E',
    textAlignVertical: 'top', marginBottom: SPACING.sm,
    fontFamily: 'serif', fontStyle: 'italic', fontWeight: '700',
  },

  /* Compose bottom row */
  composeBottom: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  composeShareRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  composeShareLabel: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, fontWeight: '700' },
  composeSaveBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.sm,
    paddingHorizontal: 20, paddingVertical: 10,
  },
  composeSaveBtnText: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: '#FFF' },

  /* AI Diary compact button */
  aiDiaryBtn: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    backgroundColor: COLORS.surface, borderRadius: RADIUS.full,
    paddingHorizontal: 14, paddingVertical: 8, marginBottom: SPACING.md,
    ...SHADOWS.soft,
  },
  aiDiaryBtnEmoji: { fontSize: 16, marginRight: 6 },
  aiDiaryBtnText: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: COLORS.text },

  /* AI Diary card */
  diaryCard: {
    backgroundColor: '#FFFDF5', borderRadius: RADIUS.lg, padding: SPACING.md,
    marginBottom: SPACING.md, borderWidth: 1, borderColor: '#F5E6C8',
  },
  diaryHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10,
  },
  diaryHeaderText: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: COLORS.text },
  diaryClose: { fontSize: 18, color: COLORS.textSecondary, padding: 4 },
  diaryBody: { fontSize: FONT_SIZE.sm, color: COLORS.text, lineHeight: 22, fontWeight: '600' },

  /* Feed */
  feedCount: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginBottom: SPACING.sm, fontWeight: '700' },
  feedCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    overflow: 'hidden', marginBottom: SPACING.md, ...SHADOWS.soft,
  },
  feedImage: { width: '100%', height: 240 },
  feedStrip: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 },
  feedInfo: { padding: SPACING.md, paddingLeft: SPACING.md + 2 },
  feedDate: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginBottom: 6, fontWeight: '700' },
  feedBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F2F2F7', borderRadius: RADIUS.sm,
    borderWidth: 1,
    paddingHorizontal: 8, paddingVertical: 5, alignSelf: 'flex-start', marginBottom: 6,
  },
  feedBadgeCircle: {
    width: 28, height: 28, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 6,
  },
  feedBadgeImg: {
    width: 28, height: 28, borderRadius: 6,
    marginRight: 6, backgroundColor: '#F2F2F7',
  },
  feedBadgeEmojiInner: { fontSize: 15 },
  feedBadgeText: { fontSize: FONT_SIZE.sm, fontWeight: '700' },
  feedMemo: {
    fontSize: FONT_SIZE.sm, color: '#7A5C40', lineHeight: 22,
    fontFamily: 'serif', fontStyle: 'italic', fontWeight: 'bold',
    marginTop: 4,
  },

  /* Empty */
  emptyWrap: { alignItems: 'center', padding: SPACING.xl, marginTop: SPACING.lg },
  emptyImage: { width: 160, height: 160, marginBottom: SPACING.sm },
  emptyText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.md, fontWeight: '700' },
  emptyHint: { color: COLORS.textLight, fontSize: FONT_SIZE.sm, marginTop: SPACING.xs, fontWeight: '600' },

  /* 성장 앨범 생성 섹션 */
  albumSection: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginTop: SPACING.lg,
    ...SHADOWS.soft,
  },
  albumSectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 6,
  },
  albumSectionTitle: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text },
  albumSectionDesc: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, lineHeight: 20, marginBottom: SPACING.sm, fontWeight: '600' },
  pregMergeHint: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FCE4EC', borderRadius: RADIUS.md,
    padding: SPACING.md, marginBottom: SPACING.md,
    borderWidth: 1, borderColor: '#F8BBD0',
  },
  pregMergeEmoji: { fontSize: 24 },
  pregMergeTitle: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: '#C2185B', marginBottom: 2 },
  pregMergeDesc: { fontSize: FONT_SIZE.xs, color: '#880E4F', lineHeight: 16 },
  albumNewBtn: {
    backgroundColor: '#FFF0E8', borderRadius: RADIUS.sm,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  albumNewBtnText: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.primary },

  /* 앨범 생성 폼 */
  albumForm: {
    backgroundColor: '#FFF8F5', borderRadius: RADIUS.md,
    padding: SPACING.sm, marginBottom: SPACING.sm,
    borderWidth: 1, borderColor: '#FFD4B8',
  },
  albumFormLabel: { fontSize: FONT_SIZE.xs, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 4 },
  albumFormInput: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.sm,
    borderWidth: 1, borderColor: '#E5E7EB',
    paddingHorizontal: 12, paddingVertical: 8,
    fontSize: FONT_SIZE.sm, color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  albumDateRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  albumDateField: { flex: 1 },
  albumDateSep: { fontSize: 18, color: COLORS.textSecondary, marginBottom: 14, alignSelf: 'center' },
  albumFormHint: { fontSize: FONT_SIZE.xs, color: COLORS.textLight, marginBottom: SPACING.sm, fontWeight: '600' },
  albumGenerateBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    paddingVertical: 12, alignItems: 'center',
  },
  albumGenerateBtnDisabled: { opacity: 0.5 },
  albumGenerateBtnText: { color: '#fff', fontSize: FONT_SIZE.md, fontWeight: '700' },
  albumCoverPicker: {
    width: '100%', height: 120, borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceLight,
    borderWidth: 1, borderColor: '#FFD4B8', borderStyle: 'dashed',
    overflow: 'hidden', marginBottom: SPACING.sm,
  },
  albumCoverPreview: { width: '100%', height: '100%' },
  albumCoverEmpty: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
  },
  albumCoverEmptyText: {
    fontSize: FONT_SIZE.xs, color: COLORS.textLight, textAlign: 'center', lineHeight: 18, fontWeight: '600',
  },
  albumCoverClear: {
    position: 'absolute', top: 6, right: 6,
    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: RADIUS.full,
    width: 24, height: 24, alignItems: 'center', justifyContent: 'center',
  },
  albumCoverClearText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  albumCoverDefaultOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.30)', paddingVertical: 5, alignItems: 'center',
  },
  albumCoverDefaultText: { color: '#FFF', fontSize: FONT_SIZE.xs, fontWeight: '700' },

});
