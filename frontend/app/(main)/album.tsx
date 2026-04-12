import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  Modal,
  TextInput,
  Dimensions,
  ImageSourcePropType,
  Switch,
} from 'react-native';
import { Stack } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useChildStore } from '../../stores/childStore';
import { momstagramApi } from '../../services/api';
import { useMomstagramStore } from '../../stores/momstagramStore';
import { COLORS, FONT_SIZE, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { PhotoViewer } from '../../components/album/PhotoViewer';

const SCREEN_WIDTH = Dimensions.get('window').width;
const PHOTO_WIDTH = SCREEN_WIDTH - 80; // timeline left margin + padding

/* ------------------------------------------------------------------ */
/* Milestone category images                                           */
/* ------------------------------------------------------------------ */

type MilestoneCategory = 'body' | 'talk' | 'brain' | 'heart' | 'hand' | 'star' | 'food' | 'eye';

const CATEGORY_IMAGES: Record<MilestoneCategory, ImageSourcePropType> = {
  body: require('../../assets/milestone-body.png'),
  talk: require('../../assets/milestone-talk.png'),
  brain: require('../../assets/milestone-brain.png'),
  heart: require('../../assets/milestone-heart.png'),
  hand: require('../../assets/milestone-hand.png'),
  star: require('../../assets/milestone-star.png'),
  food: require('../../assets/milestone-food.png'),
  eye: require('../../assets/milestone-eye.png'),
};

const CATEGORY_LABELS: Record<MilestoneCategory, string> = {
  body: '신체 발달',
  talk: '언어 발달',
  brain: '인지 발달',
  heart: '사회/감정',
  hand: '자조 능력',
  star: '창의/놀이',
  food: '식사/영양',
  eye: '감각 발달',
};

/* ------------------------------------------------------------------ */
/* Milestones by age range (expanded!)                                 */
/* ------------------------------------------------------------------ */

interface MilestoneItem {
  label: string;
  emoji: string;
  cat: MilestoneCategory;
}

const MILESTONE_PRESETS: Record<string, MilestoneItem[]> = {
  // 0개월 (신생아)
  '0개월': [
    { label: '첫 울음', emoji: '👶', cat: 'body' },
    { label: '빛에 반응', emoji: '💡', cat: 'eye' },
    { label: '큰 소리에 깜짝', emoji: '👂', cat: 'eye' },
    { label: '손 꽉 쥐기(파악반사)', emoji: '✊', cat: 'body' },
    { label: '엄마 목소리 인식', emoji: '🤱', cat: 'heart' },
    { label: '수유 시작', emoji: '🍼', cat: 'food' },
    { label: '얼굴 가까이 응시', emoji: '👀', cat: 'eye' },
    { label: '제대 탈락', emoji: '🏥', cat: 'body' },
  ],
  // 1개월
  '1개월': [
    { label: '엎드려 고개 들기', emoji: '💪', cat: 'body' },
    { label: '20~30cm 초점 맞추기', emoji: '👁', cat: 'eye' },
    { label: '움직이는 물체 따라보기', emoji: '👀', cat: 'brain' },
    { label: '소리 나는 쪽 반응', emoji: '👂', cat: 'eye' },
    { label: '수유 리듬 형성', emoji: '🍼', cat: 'food' },
    { label: '울음으로 의사표현', emoji: '😢', cat: 'talk' },
    { label: '손발 활발히 움직임', emoji: '🦶', cat: 'body' },
    { label: '안아주면 안정', emoji: '🤗', cat: 'heart' },
  ],
  // 2개월
  '2개월': [
    { label: '사회적 미소', emoji: '😊', cat: 'heart' },
    { label: '옹알이 시작(쿠~)', emoji: '🗣', cat: 'talk' },
    { label: '180도 따라보기', emoji: '👀', cat: 'eye' },
    { label: '손을 입에 가져가기', emoji: '🤚', cat: 'hand' },
    { label: '엎드려 가슴 들기', emoji: '💪', cat: 'body' },
    { label: '소리에 조용해지기', emoji: '🤫', cat: 'brain' },
    { label: '얼굴 보고 웃기', emoji: '😄', cat: 'heart' },
    { label: '밤 수면 길어짐', emoji: '😴', cat: 'brain' },
  ],
  // 3개월
  '3개월': [
    { label: '목 가누기', emoji: '🦒', cat: 'body' },
    { label: '소리내어 웃기', emoji: '😂', cat: 'heart' },
    { label: '손에 쥐어주면 잡기', emoji: '✊', cat: 'hand' },
    { label: '엎드려 팔로 지탱', emoji: '🤸', cat: 'body' },
    { label: '옹알이 다양해짐', emoji: '🗣', cat: 'talk' },
    { label: '손 쳐다보기', emoji: '🖐', cat: 'brain' },
    { label: '거울 속 얼굴에 관심', emoji: '🪞', cat: 'brain' },
    { label: '수유량 안정', emoji: '🍼', cat: 'food' },
  ],
  // 4개월
  '4개월': [
    { label: '뒤집기 시도', emoji: '🔄', cat: 'body' },
    { label: '장난감 손 뻗어 잡기', emoji: '🧸', cat: 'hand' },
    { label: '아~에~ 모음 발성', emoji: '🗣', cat: 'talk' },
    { label: '거울 보고 웃기', emoji: '🪞', cat: 'heart' },
    { label: '양손으로 물건 잡기', emoji: '🤲', cat: 'hand' },
    { label: '받쳐주면 앉기', emoji: '🪑', cat: 'body' },
    { label: '얼굴 표정 모방', emoji: '🎭', cat: 'brain' },
    { label: '배고픔 외 울음 구분', emoji: '😢', cat: 'talk' },
  ],
  // 5개월
  '5개월': [
    { label: '뒤집기 성공', emoji: '🔄', cat: 'body' },
    { label: '발 잡고 놀기', emoji: '🦶', cat: 'body' },
    { label: '입으로 탐색하기', emoji: '👄', cat: 'eye' },
    { label: '낯가리기 시작', emoji: '🫣', cat: 'heart' },
    { label: '한 손에서 다른 손으로', emoji: '🤲', cat: 'hand' },
    { label: '이유식 준비(침 많아짐)', emoji: '🥄', cat: 'food' },
    { label: '까꿍에 반응', emoji: '🙈', cat: 'brain' },
    { label: '큰 소리로 깔깔 웃기', emoji: '😂', cat: 'heart' },
  ],
  // 6개월
  '6개월': [
    { label: '이유식 시작', emoji: '🥄', cat: 'food' },
    { label: '혼자 앉기 시도', emoji: '🪑', cat: 'body' },
    { label: '바바/마마 옹알이', emoji: '🗣', cat: 'talk' },
    { label: '물건 쥐고 흔들기', emoji: '🔔', cat: 'hand' },
    { label: '낯선 사람 경계', emoji: '😮', cat: 'heart' },
    { label: '원인-결과 이해 시작', emoji: '🧠', cat: 'brain' },
    { label: '양손에 각각 물건 잡기', emoji: '🤲', cat: 'hand' },
    { label: '엎드려 빙글빙글', emoji: '🔄', cat: 'body' },
  ],
  // 7개월
  '7개월': [
    { label: '혼자 앉기 안정', emoji: '🧒', cat: 'body' },
    { label: '배밀이 시작', emoji: '🐛', cat: 'body' },
    { label: '이름 부르면 반응', emoji: '📢', cat: 'brain' },
    { label: '집게 잡기 시도', emoji: '🤏', cat: 'hand' },
    { label: '이유식 중기(으깬 음식)', emoji: '🥣', cat: 'food' },
    { label: '까꿍 놀이 즐기기', emoji: '🙈', cat: 'brain' },
    { label: '엄마에게 팔 벌리기', emoji: '🤗', cat: 'heart' },
    { label: '물건 떨어뜨리기 놀이', emoji: '⬇️', cat: 'brain' },
  ],
  // 8개월
  '8개월': [
    { label: '기어가기 시작', emoji: '🐛', cat: 'body' },
    { label: '잡고 서기', emoji: '🧍', cat: 'body' },
    { label: '바이바이 흉내', emoji: '👋', cat: 'heart' },
    { label: '두 물건 부딪치기', emoji: '🥁', cat: 'hand' },
    { label: '소리 따라하기', emoji: '🦜', cat: 'talk' },
    { label: '숨긴 물건 찾기', emoji: '🔍', cat: 'brain' },
    { label: '분리불안 시작', emoji: '😢', cat: 'heart' },
    { label: '핑거푸드 집어먹기', emoji: '🍪', cat: 'food' },
  ],
  // 9개월
  '9개월': [
    { label: '가구 잡고 이동', emoji: '🚶', cat: 'body' },
    { label: '집게 잡기 성공', emoji: '🤏', cat: 'hand' },
    { label: '안 돼 이해하기', emoji: '🚫', cat: 'brain' },
    { label: '손가락으로 가리키기', emoji: '👆', cat: 'talk' },
    { label: '컵 잡고 마시기 시도', emoji: '🥤', cat: 'hand' },
    { label: '이유식 후기(잘게 썬)', emoji: '🥗', cat: 'food' },
    { label: '박수치기', emoji: '👏', cat: 'body' },
    { label: '간단한 몸짓 모방', emoji: '🙌', cat: 'brain' },
  ],
  // 10개월
  '10개월': [
    { label: '잡고 서서 움직이기', emoji: '🚶', cat: 'body' },
    { label: '엄마/아빠 뜻있게 말하기', emoji: '🗣', cat: 'talk' },
    { label: '손 흔들어 인사', emoji: '👋', cat: 'heart' },
    { label: '뚜껑 열기 시도', emoji: '🫙', cat: 'hand' },
    { label: '간단한 지시 이해', emoji: '✅', cat: 'brain' },
    { label: '숟가락 잡기 시도', emoji: '🥄', cat: 'hand' },
    { label: '까꿍 놀이 주도', emoji: '🎭', cat: 'brain' },
    { label: '음악에 몸 흔들기', emoji: '🎵', cat: 'star' },
  ],
  // 11개월
  '11개월': [
    { label: '혼자 서기 시도', emoji: '🧍', cat: 'body' },
    { label: '첫 단어 시도', emoji: '💬', cat: 'talk' },
    { label: '블록 2~3개 쌓기', emoji: '🧱', cat: 'star' },
    { label: '물건 넣고 빼기', emoji: '📦', cat: 'brain' },
    { label: '전화 놀이', emoji: '📱', cat: 'star' },
    { label: '책장 넘기기', emoji: '📖', cat: 'hand' },
    { label: '간식 스스로 먹기', emoji: '🍪', cat: 'food' },
    { label: '또래에게 관심', emoji: '👶', cat: 'heart' },
  ],
  // 12개월 (돌)
  '12개월': [
    { label: '첫 걸음', emoji: '🚶', cat: 'body' },
    { label: '의미있는 단어 2~3개', emoji: '💬', cat: 'talk' },
    { label: '컵으로 마시기', emoji: '🥤', cat: 'hand' },
    { label: '숨은 물건 찾기', emoji: '🔍', cat: 'brain' },
    { label: '공 굴리기', emoji: '⚽', cat: 'body' },
    { label: '크레용 쥐기', emoji: '🖍', cat: 'star' },
    { label: '완료식 시작', emoji: '🍚', cat: 'food' },
    { label: '엄마아빠에게 애정표현', emoji: '💕', cat: 'heart' },
  ],
  // 13개월
  '13개월': [
    { label: '걷기 점점 안정', emoji: '🚶', cat: 'body' },
    { label: '원하는 것 가리키기', emoji: '👆', cat: 'talk' },
    { label: '숟가락 혼자 시도', emoji: '🥄', cat: 'hand' },
    { label: '블록 3개 쌓기', emoji: '🧱', cat: 'brain' },
    { label: '동물 소리 흉내', emoji: '🐶', cat: 'talk' },
    { label: '인형에 밥 주기', emoji: '🧸', cat: 'star' },
    { label: '신발 벗기 시도', emoji: '👟', cat: 'hand' },
    { label: '밥 거부/편식 시작', emoji: '🍽', cat: 'food' },
  ],
  // 14개월
  '14개월': [
    { label: '뒤로 걷기', emoji: '🔙', cat: 'body' },
    { label: '의미있는 단어 5개+', emoji: '💬', cat: 'talk' },
    { label: '컵 혼자 사용', emoji: '🥛', cat: 'hand' },
    { label: '그림 그리기(끼적)', emoji: '🎨', cat: 'star' },
    { label: '신체 부위 1~2개 가리키기', emoji: '👆', cat: 'brain' },
    { label: '계단 기어오르기', emoji: '🪜', cat: 'body' },
    { label: '소유욕 표현(내 거!)', emoji: '🫂', cat: 'heart' },
    { label: '리듬에 맞춰 흔들기', emoji: '🎵', cat: 'star' },
  ],
  // 15개월
  '15개월': [
    { label: '안정적으로 걷기', emoji: '🚶', cat: 'body' },
    { label: '공 차기 시도', emoji: '⚽', cat: 'body' },
    { label: '10개 이상 단어 이해', emoji: '🧠', cat: 'brain' },
    { label: '책 넘기기(여러 장)', emoji: '📖', cat: 'hand' },
    { label: '낙서하기', emoji: '🖍', cat: 'star' },
    { label: '동물 가리키며 이름 말하기', emoji: '🐱', cat: 'talk' },
    { label: '컵에 물 따르기 흉내', emoji: '🫗', cat: 'star' },
    { label: '또래 옆에서 놀기', emoji: '👫', cat: 'heart' },
  ],
  // 16개월
  '16개월': [
    { label: '빠르게 걷기', emoji: '🏃', cat: 'body' },
    { label: '두 단어 조합 시도', emoji: '💬', cat: 'talk' },
    { label: '블록 4개 쌓기', emoji: '🧱', cat: 'brain' },
    { label: '양말 벗기', emoji: '🧦', cat: 'hand' },
    { label: '간단한 심부름', emoji: '✅', cat: 'brain' },
    { label: '신체 부위 3~4개', emoji: '👆', cat: 'brain' },
    { label: '숟가락으로 혼자 먹기', emoji: '🥄', cat: 'food' },
    { label: '그림책 좋아하기', emoji: '📚', cat: 'star' },
  ],
  // 17개월
  '17개월': [
    { label: '계단 한 손 잡고 오르기', emoji: '🪜', cat: 'body' },
    { label: '50개 이상 단어 이해', emoji: '🧠', cat: 'brain' },
    { label: '뚜껑 열고 닫기', emoji: '🫙', cat: 'hand' },
    { label: '동물 소리 5가지+', emoji: '🐶', cat: 'talk' },
    { label: '인형 안아주기', emoji: '🧸', cat: 'heart' },
    { label: '세로선 그리기', emoji: '🖍', cat: 'star' },
    { label: '포크 사용 시도', emoji: '🍴', cat: 'food' },
    { label: '숨바꼭질 좋아하기', emoji: '🙈', cat: 'star' },
  ],
  // 18개월
  '18개월': [
    { label: '달리기 시작', emoji: '🏃', cat: 'body' },
    { label: '두 단어 문장', emoji: '💬', cat: 'talk' },
    { label: '블록 5~6개 쌓기', emoji: '🧱', cat: 'brain' },
    { label: '옷 벗기 시도', emoji: '👕', cat: 'hand' },
    { label: '자기 이름 반응', emoji: '🏷', cat: 'brain' },
    { label: '분류하기(크기/색)', emoji: '🔵', cat: 'brain' },
    { label: '그림에 이름 붙이기', emoji: '🎨', cat: 'talk' },
    { label: '또래와 나란히 놀이', emoji: '👫', cat: 'heart' },
  ],
  // 19개월
  '19개월': [
    { label: '점프 시도', emoji: '🤸', cat: 'body' },
    { label: '단어 20개+ 사용', emoji: '💬', cat: 'talk' },
    { label: '색깔 1~2개 인식', emoji: '🌈', cat: 'brain' },
    { label: '지퍼 올리기 시도', emoji: '🤐', cat: 'hand' },
    { label: '노래 따라 흥얼', emoji: '🎤', cat: 'star' },
    { label: '숫자 따라 말하기', emoji: '🔢', cat: 'brain' },
    { label: '혼자 먹기 안정', emoji: '🍽', cat: 'food' },
    { label: '감정 표현 시작', emoji: '😤', cat: 'heart' },
  ],
  // 20개월
  '20개월': [
    { label: '빠르게 달리기', emoji: '🏃', cat: 'body' },
    { label: '두 단어 문장 자주', emoji: '💬', cat: 'talk' },
    { label: '블록 6개 쌓기', emoji: '🧱', cat: 'brain' },
    { label: '공 던지기', emoji: '🥎', cat: 'body' },
    { label: '간단한 퍼즐(2~3조각)', emoji: '🧩', cat: 'brain' },
    { label: '양치 시도', emoji: '🪥', cat: 'hand' },
    { label: '상상 놀이 시작', emoji: '🎭', cat: 'star' },
    { label: '친구에게 관심', emoji: '🤝', cat: 'heart' },
  ],
  // 21개월
  '21개월': [
    { label: '계단 오르내리기', emoji: '🪜', cat: 'body' },
    { label: '50+ 단어 사용', emoji: '💬', cat: 'talk' },
    { label: '이름 말하기', emoji: '🏷', cat: 'talk' },
    { label: '신발 신기 시도', emoji: '👟', cat: 'hand' },
    { label: '동그라미 그리기 시도', emoji: '⭕', cat: 'star' },
    { label: '크다/작다 이해', emoji: '📏', cat: 'brain' },
    { label: '밥 먹기 싫다 표현', emoji: '🙅', cat: 'food' },
    { label: '차례 기다리기 시도', emoji: '⏳', cat: 'heart' },
  ],
  // 22개월
  '22개월': [
    { label: '두 발 모아 점프', emoji: '🤸', cat: 'body' },
    { label: '세 단어 문장 시도', emoji: '💬', cat: 'talk' },
    { label: '옷 벗기 혼자', emoji: '👕', cat: 'hand' },
    { label: '색깔 2~3개 구분', emoji: '🌈', cat: 'brain' },
    { label: '노래 따라부르기', emoji: '🎤', cat: 'talk' },
    { label: '블록으로 기차 만들기', emoji: '🚂', cat: 'star' },
    { label: '포크 사용 안정', emoji: '🍴', cat: 'food' },
    { label: '소유욕 강해짐', emoji: '🫂', cat: 'heart' },
  ],
  // 23개월
  '23개월': [
    { label: '한 발로 서기 시도', emoji: '🦩', cat: 'body' },
    { label: '왜? 질문 시작', emoji: '❓', cat: 'talk' },
    { label: '4~5조각 퍼즐', emoji: '🧩', cat: 'brain' },
    { label: '지퍼 올리기 성공', emoji: '🤐', cat: 'hand' },
    { label: '역할 놀이(소꿉)', emoji: '🧑‍🍳', cat: 'star' },
    { label: '간단한 지시 2단계', emoji: '✅', cat: 'brain' },
    { label: '컵 혼자 따르기', emoji: '🫗', cat: 'food' },
    { label: '친구와 장난감 나누기 시도', emoji: '🤝', cat: 'heart' },
  ],
  // 24개월 (두 돌)
  '24개월': [
    { label: '세발자전거 관심', emoji: '🚲', cat: 'body' },
    { label: '두~세 단어 문장 자유', emoji: '💬', cat: 'talk' },
    { label: '숫자 1~5 따라 세기', emoji: '🔢', cat: 'brain' },
    { label: '옷 입기 시도', emoji: '👔', cat: 'hand' },
    { label: '동그라미 그리기', emoji: '⭕', cat: 'star' },
    { label: '화장실 관심', emoji: '🚽', cat: 'hand' },
    { label: '혼자 식사 완성', emoji: '🍽', cat: 'food' },
    { label: '감정 이름 말하기', emoji: '😊', cat: 'heart' },
  ],
  // 25~27개월
  '25~27개월': [
    { label: '높은 곳 오르기', emoji: '🧗', cat: 'body' },
    { label: '100+ 단어 사용', emoji: '💬', cat: 'talk' },
    { label: '화장실 가기 연습', emoji: '🚽', cat: 'hand' },
    { label: '가위 잡기 시도', emoji: '✂️', cat: 'hand' },
    { label: '숫자 1~3 세기', emoji: '🔢', cat: 'brain' },
    { label: '색칠하기 시도', emoji: '🖍', cat: 'star' },
    { label: '친구와 놀기', emoji: '👫', cat: 'heart' },
    { label: '밥 잘 안 먹는 시기', emoji: '🙅', cat: 'food' },
  ],
  // 28~30개월
  '28~30개월': [
    { label: '한 발로 잠깐 서기', emoji: '🦩', cat: 'body' },
    { label: '왜? 질문 폭발', emoji: '❓', cat: 'talk' },
    { label: '옷 입기 시도', emoji: '👔', cat: 'hand' },
    { label: '이야기 이해하기', emoji: '📚', cat: 'brain' },
    { label: '이름 쓰기 흉내', emoji: '✏️', cat: 'star' },
    { label: '역할 놀이 다양화', emoji: '🎭', cat: 'star' },
    { label: '규칙 이해 시작', emoji: '📋', cat: 'brain' },
    { label: '나누기/양보하기', emoji: '🤝', cat: 'heart' },
  ],
  // 31~33개월
  '31~33개월': [
    { label: '계단 번갈아 오르기', emoji: '🪜', cat: 'body' },
    { label: '긴 문장 말하기', emoji: '💬', cat: 'talk' },
    { label: '단추 끼우기 시도', emoji: '🔘', cat: 'hand' },
    { label: '숫자 1~5 세기', emoji: '🔢', cat: 'brain' },
    { label: '노래 전체 부르기', emoji: '🎵', cat: 'star' },
    { label: '화장실 혼자 가기 시도', emoji: '🚽', cat: 'hand' },
    { label: '음식 골고루 시도', emoji: '🥗', cat: 'food' },
    { label: '감정 조절 연습', emoji: '😌', cat: 'heart' },
  ],
  // 34~36개월 (3세)
  '34~36개월': [
    { label: '세발자전거 타기', emoji: '🚴', cat: 'body' },
    { label: '대화 가능', emoji: '💬', cat: 'talk' },
    { label: '가위로 자르기', emoji: '✂️', cat: 'hand' },
    { label: '색깔 5가지+ 구분', emoji: '🌈', cat: 'brain' },
    { label: '그림으로 표현', emoji: '🖼', cat: 'star' },
    { label: '규칙 게임 참여', emoji: '🎲', cat: 'star' },
    { label: '혼자 옷 입기', emoji: '👕', cat: 'hand' },
    { label: '친구 사귀기', emoji: '🤝', cat: 'heart' },
  ],
  // 4세 (37~48개월)
  '4세': [
    { label: '한 발로 5초 서기', emoji: '🦩', cat: 'body' },
    { label: '이름 쓰기', emoji: '✏️', cat: 'star' },
    { label: '이야기 만들기', emoji: '📖', cat: 'talk' },
    { label: '가위바위보', emoji: '✊', cat: 'brain' },
    { label: '시간 개념(아침/저녁)', emoji: '⏰', cat: 'brain' },
    { label: '차례 지키기', emoji: '🔄', cat: 'heart' },
    { label: '수 세기(10이상)', emoji: '🔟', cat: 'brain' },
    { label: '줄넘기 시도', emoji: '🤾', cat: 'body' },
  ],
  // 5세 (49~60개월)
  '5세': [
    { label: '자전거 보조바퀴', emoji: '🚴', cat: 'body' },
    { label: '한글 관심/읽기', emoji: '🇰🇷', cat: 'talk' },
    { label: '동화 이해/전달', emoji: '📖', cat: 'brain' },
    { label: '규칙 게임 즐기기', emoji: '🎲', cat: 'star' },
    { label: '혼자 옷 입기 완성', emoji: '👕', cat: 'hand' },
    { label: '친구 관계 형성', emoji: '🤝', cat: 'heart' },
    { label: '그림 상세하게 그리기', emoji: '🎨', cat: 'star' },
    { label: '숫자 20까지 세기', emoji: '🔢', cat: 'brain' },
  ],
  // 6세 이상 (61개월+)
  '6세 이상': [
    { label: '자전거 두발', emoji: '🚴', cat: 'body' },
    { label: '읽기/쓰기 시작', emoji: '📝', cat: 'talk' },
    { label: '긴 문장 말하기', emoji: '💬', cat: 'talk' },
    { label: '덧셈/뺄셈 시작', emoji: '🔢', cat: 'brain' },
    { label: '줄넘기 연속', emoji: '🤾', cat: 'body' },
    { label: '규칙 지키기', emoji: '📋', cat: 'heart' },
    { label: '요리 도와주기', emoji: '🧑‍🍳', cat: 'hand' },
    { label: '혼자 준비하기', emoji: '🎒', cat: 'hand' },
  ],
};

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
  uri: string;
  date: string;
  milestone?: string;
  milestoneEmoji?: string;
  memo?: string;
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}

/* ------------------------------------------------------------------ */
/* Screen                                                              */
/* ------------------------------------------------------------------ */

export default function AlbumScreen() {
  const [photos, setPhotos] = useState<MilestonePhoto[]>([]);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [milestoneModal, setMilestoneModal] = useState(false);
  const [pendingUri, setPendingUri] = useState<string | null>(null);
  const [selectedMilestone, setSelectedMilestone] = useState<MilestoneItem | null>(null);
  const [memo, setMemo] = useState('');
  const [modalCategory, setModalCategory] = useState<MilestoneCategory | 'all'>('all');
  const [shareToMomstagram, setShareToMomstagram] = useState(false);
  const selectedChild = useChildStore((s) => s.selectedChild);
  const addPost = useMomstagramStore((s) => s.addPost);

  const childMonths = selectedChild?.birthDate
    ? Math.floor((Date.now() - new Date(selectedChild.birthDate).getTime()) / (1000 * 60 * 60 * 24 * 30.44))
    : 12;
  const [viewMonth, setViewMonth] = useState(childMonths);
  const monthKey = getMonthKey(viewMonth);
  const monthLabel = getMonthLabel(viewMonth);
  const presets = MILESTONE_PRESETS[monthKey] ?? MILESTONE_PRESETS['12개월'];

  const pickImage = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('권한 필요', '사진 접근 권한이 필요합니다.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsMultipleSelection: false,
    });
    if (!result.canceled && result.assets.length > 0) {
      setPendingUri(result.assets[0].uri);
      setSelectedMilestone(null);
      setMemo('');
      setModalCategory('all');
      setShareToMomstagram(false);
      setMilestoneModal(true);
    }
  }, []);

  const saveMilestonePhoto = useCallback(async () => {
    if (!pendingUri) return;
    const newPhoto: MilestonePhoto = {
      uri: pendingUri,
      date: formatDate(new Date()),
      milestone: selectedMilestone?.label,
      milestoneEmoji: selectedMilestone?.emoji,
      memo: memo.trim() || undefined,
    };
    setPhotos((prev) => [newPhoto, ...prev]);
    setMilestoneModal(false);
    setPendingUri(null);

    // 맘스타그램에도 공유
    if (shareToMomstagram && selectedChild) {
      const milestoneText = selectedMilestone
        ? `${selectedMilestone.emoji} ${selectedMilestone.label}`
        : '성장 기록';
      const content = memo.trim()
        ? `${milestoneText}\n${memo.trim()}`
        : `${milestoneText} - ${selectedChild.name}의 성장 타임라인`;
      const childAge = selectedChild.ageInfo?.months
        ? `${selectedChild.ageInfo.months}개월`
        : '';
      try {
        const res = await momstagramApi.createPost({
          content,
          imageUrl: pendingUri,
          sourceType: 'album',
          childAge: childAge || undefined,
          childGender: selectedChild.gender ?? undefined,
          dominantType: selectedChild.innateData?.dominantType ?? undefined,
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
          likes: 0,
          liked: false,
          comments: [],
          createdAt: apiPost?.createdAt ?? new Date().toISOString(),
          isPrivate: false,
        });
        Alert.alert('공유 완료', '맘스타그램에도 게시되었습니다.');
      } catch {
        Alert.alert('알림', '타임라인은 저장되었지만 맘스타그램 공유에 실패했습니다.');
      }
    }
  }, [pendingUri, selectedMilestone, memo, shareToMomstagram, selectedChild, addPost]);

  const viewerPhoto = viewerIndex !== null ? photos[viewerIndex] : null;

  // Achievement tracking
  const achievedLabels = new Set(photos.map((p) => p.milestone).filter(Boolean));
  const totalPresets = presets.length;
  const achievedCount = presets.filter((p) => achievedLabels.has(p.label)).length;

  // Filter milestones in modal
  const filteredPresets = modalCategory === 'all'
    ? presets
    : presets.filter((p) => p.cat === modalCategory);

  // Categories that actually exist in current age presets
  const availableCategories = [...new Set(presets.map((p) => p.cat))];

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: '성장 타임라인', headerShown: true }} />
      <ScrollView contentContainerStyle={styles.content}>
        {selectedChild && (
          <Text style={styles.childLabel}>
            {selectedChild.name}의 성장 타임라인
          </Text>
        )}

        {/* Month navigation */}
        <View style={styles.monthNav}>
          <TouchableOpacity
            style={[styles.monthNavBtn, viewMonth <= 0 && styles.monthNavBtnDisabled]}
            onPress={() => setViewMonth((v) => Math.max(0, v - 1))}
            disabled={viewMonth <= 0}
          >
            <Text style={styles.monthNavBtnText}>{'<'}</Text>
          </TouchableOpacity>
          <View style={styles.monthNavCenter}>
            <Text style={styles.monthNavLabel}>{monthLabel}</Text>
            {viewMonth !== childMonths && (
              <TouchableOpacity onPress={() => setViewMonth(childMonths)}>
                <Text style={styles.monthNavReset}>현재 월령으로</Text>
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={styles.monthNavBtn}
            onPress={() => setViewMonth((v) => v + 1)}
          >
            <Text style={styles.monthNavBtnText}>{'>'}</Text>
          </TouchableOpacity>
        </View>

        {/* Milestone progress */}
        <View style={styles.milestoneProgress}>
          <View style={styles.mpHeader}>
            <Text style={styles.mpTitle}>{'🏆'} {monthLabel} 마일스톤</Text>
            <Text style={styles.mpCount}>{achievedCount}/{totalPresets}</Text>
          </View>
          <View style={styles.mpBarBg}>
            <View style={[styles.mpBarFill, { width: `${totalPresets > 0 ? (achievedCount / totalPresets) * 100 : 0}%` }]} />
          </View>

          {/* Category images row */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catRow}>
            {availableCategories.map((cat) => {
              const catItems = presets.filter((p) => p.cat === cat);
              const catDone = catItems.filter((p) => achievedLabels.has(p.label)).length;
              return (
                <View key={cat} style={styles.catItem}>
                  <Image source={CATEGORY_IMAGES[cat]} style={styles.catImage} />
                  <Text style={styles.catLabel}>{CATEGORY_LABELS[cat]}</Text>
                  <Text style={styles.catCount}>{catDone}/{catItems.length}</Text>
                </View>
              );
            })}
          </ScrollView>

          <View style={styles.mpChips}>
            {presets.map((ms) => {
              const done = achievedLabels.has(ms.label);
              return (
                <View key={ms.label} style={[styles.mpChip, done && styles.mpChipDone]}>
                  <Text style={styles.mpChipEmoji}>{ms.emoji}</Text>
                  <Text style={[styles.mpChipText, done && styles.mpChipTextDone]}>
                    {done ? '✓ ' : ''}{ms.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {photos.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Image
              source={require('../../assets/empty-album.png')}
              style={styles.emptyImage}
              resizeMode="contain"
            />
            <Text style={styles.emptyText}>아직 사진이 없습니다</Text>
            <Text style={styles.emptyHint}>+ 버튼으로 마일스톤 사진을 추가하세요</Text>
          </View>
        ) : (
          <>
            <Text style={styles.countText}>{photos.length}장의 사진</Text>

            {/* Timeline view — large photos */}
            {photos.map((photo, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.timelineCard}
                onPress={() => setViewerIndex(idx)}
                activeOpacity={0.8}
              >
                {/* Timeline connector */}
                <View style={styles.timelineLeft}>
                  <View style={styles.timelineDot} />
                  {idx < photos.length - 1 && <View style={styles.timelineLine} />}
                </View>

                {/* Card content */}
                <View style={styles.timelineRight}>
                  <Image source={{ uri: photo.uri }} style={styles.timelineImage} resizeMode="cover" />
                  <View style={styles.timelineInfo}>
                    <Text style={styles.timelineDate}>{photo.date}</Text>
                    {photo.milestone && (
                      <View style={styles.timelineBadge}>
                        <Text style={styles.timelineBadgeText}>
                          {photo.milestoneEmoji ?? '🎯'} {photo.milestone}
                        </Text>
                      </View>
                    )}
                    {photo.memo && <Text style={styles.timelineMemo}>{photo.memo}</Text>}
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={pickImage} activeOpacity={0.85}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Milestone Picker Modal */}
      <Modal visible={milestoneModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>마일스톤 기록</Text>
            <Text style={styles.modalSub}>어떤 순간을 기록하나요?</Text>

            {pendingUri && (
              <Image source={{ uri: pendingUri }} style={styles.modalPreview} />
            )}

            {/* Category filter */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.modalCatScroll}>
              <TouchableOpacity
                style={[styles.modalCatBtn, modalCategory === 'all' && styles.modalCatBtnActive]}
                onPress={() => setModalCategory('all')}
              >
                <Text style={[styles.modalCatBtnText, modalCategory === 'all' && styles.modalCatBtnTextActive]}>
                  전체
                </Text>
              </TouchableOpacity>
              {availableCategories.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.modalCatBtn, modalCategory === cat && styles.modalCatBtnActive]}
                  onPress={() => setModalCategory(cat)}
                >
                  <Image source={CATEGORY_IMAGES[cat]} style={styles.modalCatIcon} />
                  <Text style={[styles.modalCatBtnText, modalCategory === cat && styles.modalCatBtnTextActive]}>
                    {CATEGORY_LABELS[cat]}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Milestone chips */}
            <ScrollView style={styles.modalChipScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.modalChips}>
                {filteredPresets.map((ms) => (
                  <TouchableOpacity
                    key={ms.label}
                    style={[styles.modalChip, selectedMilestone?.label === ms.label && styles.modalChipActive]}
                    onPress={() => setSelectedMilestone(selectedMilestone?.label === ms.label ? null : ms)}
                  >
                    <Text style={styles.modalChipEmoji}>{ms.emoji}</Text>
                    <Text style={[styles.modalChipText, selectedMilestone?.label === ms.label && styles.modalChipTextActive]}>
                      {ms.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <TextInput
              style={styles.modalInput}
              placeholder="메모 (선택)"
              placeholderTextColor="#B5A99A"
              value={memo}
              onChangeText={setMemo}
              multiline
            />

            <View style={styles.shareRow}>
              <Text style={styles.shareLabel}>맘스타그램에도 공유</Text>
              <Switch
                value={shareToMomstagram}
                onValueChange={setShareToMomstagram}
                trackColor={{ false: '#E0E0E0', true: '#FF8C5A' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setMilestoneModal(false)}>
                <Text style={styles.modalBtnCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnSave} onPress={saveMilestonePhoto}>
                <Text style={styles.modalBtnSaveText}>저장</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Full-screen viewer */}
      {viewerPhoto && (
        <PhotoViewer
          visible={viewerIndex !== null}
          uri={viewerPhoto.uri}
          date={viewerPhoto.date}
          onClose={() => setViewerIndex(null)}
        />
      )}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingTop: SPACING.md, paddingBottom: 120 },
  childLabel: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.sm },
  countText: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginBottom: SPACING.md },

  /* Month navigation */
  monthNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFF', borderRadius: 16, padding: 12, marginBottom: 12,
    ...SHADOWS.soft,
  },
  monthNavBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#F8F4F0', justifyContent: 'center', alignItems: 'center',
  },
  monthNavBtnDisabled: { opacity: 0.3 },
  monthNavBtnText: { fontSize: 18, fontWeight: '700', color: COLORS.primary },
  monthNavCenter: { alignItems: 'center', flex: 1 },
  monthNavLabel: { fontSize: 17, fontWeight: '800', color: COLORS.text },
  monthNavReset: { fontSize: 11, color: COLORS.primary, fontWeight: '600', marginTop: 2 },

  /* Milestone Progress */
  milestoneProgress: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 20,
    ...SHADOWS.soft,
  },
  mpHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  mpTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  mpCount: { fontSize: 14, fontWeight: '800', color: COLORS.primary },
  mpBarBg: { height: 8, borderRadius: 4, backgroundColor: '#F0E6DC', marginBottom: 12 },
  mpBarFill: { height: 8, borderRadius: 4, backgroundColor: COLORS.primary },

  /* Category row */
  catRow: { marginBottom: 12 },
  catItem: { alignItems: 'center', marginRight: 14, width: 56 },
  catImage: { width: 40, height: 40, borderRadius: 12 },
  catLabel: { fontSize: 9, fontWeight: '600', color: COLORS.textSecondary, marginTop: 4 },
  catCount: { fontSize: 9, fontWeight: '700', color: COLORS.primary },

  /* Chips */
  mpChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  mpChip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
    backgroundColor: '#F8F4F0', borderWidth: 1, borderColor: '#E8E0D8',
  },
  mpChipDone: { backgroundColor: '#E8F5E9', borderColor: '#81C784' },
  mpChipEmoji: { fontSize: 12, marginRight: 3 },
  mpChipText: { fontSize: 11, fontWeight: '600', color: COLORS.textSecondary },
  mpChipTextDone: { color: '#2E7D32' },

  /* Timeline — large photo layout */
  timelineCard: {
    flexDirection: 'row', marginBottom: 20,
  },
  timelineLeft: {
    width: 24, alignItems: 'center', paddingTop: 8,
  },
  timelineDot: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: COLORS.primary,
    borderWidth: 2, borderColor: '#FFF',
  },
  timelineLine: {
    width: 2, flex: 1, backgroundColor: '#E8E0D8', marginTop: 4,
  },
  timelineRight: {
    flex: 1, marginLeft: 8,
    backgroundColor: '#FFF', borderRadius: 16, overflow: 'hidden',
    ...SHADOWS.soft,
  },
  timelineImage: {
    width: '100%', height: 200, // full-width large photo
  },
  timelineInfo: { padding: 14 },
  timelineDate: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 4 },
  timelineBadge: {
    backgroundColor: '#FFF0E6', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start', marginBottom: 4,
  },
  timelineBadgeText: { fontSize: 13, fontWeight: '600', color: COLORS.primary },
  timelineMemo: { fontSize: 13, color: COLORS.text, lineHeight: 18 },

  /* Empty / FAB */
  fab: {
    position: 'absolute', bottom: SPACING.xl, right: SPACING.lg,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center',
    ...SHADOWS.elevated,
  },
  fabText: { color: '#FFF', fontSize: 28, fontWeight: '600', lineHeight: 30 },
  emptyWrap: { alignItems: 'center', padding: SPACING.xl, marginTop: SPACING.xl },
  emptyImage: { width: 160, height: 160, marginBottom: SPACING.sm },
  emptyText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.md, fontWeight: '500' },
  emptyHint: { color: COLORS.textLight, fontSize: FONT_SIZE.sm, marginTop: SPACING.xs },

  /* Modal */
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, maxHeight: '85%',
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text, marginBottom: 4 },
  modalSub: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 12 },
  modalPreview: { width: '100%', height: 160, borderRadius: 12, marginBottom: 12 },

  /* Modal category filter */
  modalCatScroll: { marginBottom: 10, maxHeight: 44 },
  modalCatBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16,
    backgroundColor: '#F8F4F0', marginRight: 8, borderWidth: 1, borderColor: '#E8E0D8',
  },
  modalCatBtnActive: { backgroundColor: '#FFF0E6', borderColor: COLORS.primary },
  modalCatIcon: { width: 18, height: 18, borderRadius: 4, marginRight: 4 },
  modalCatBtnText: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  modalCatBtnTextActive: { color: COLORS.primary },

  /* Modal chips */
  modalChipScroll: { maxHeight: 140, marginBottom: 12 },
  modalChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  modalChip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#F8F4F0', borderWidth: 1, borderColor: '#E8E0D8',
  },
  modalChipActive: { backgroundColor: '#FFF0E6', borderColor: COLORS.primary },
  modalChipEmoji: { fontSize: 15, marginRight: 5 },
  modalChipText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  modalChipTextActive: { color: COLORS.primary },
  modalInput: {
    height: 60, borderRadius: 12, backgroundColor: '#F8F4F0',
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: COLORS.text,
    textAlignVertical: 'top', marginBottom: 16,
  },
  shareRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFF5EC', borderRadius: 12, padding: 12, marginBottom: 16,
  },
  shareLabel: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  modalBtns: { flexDirection: 'row', gap: 12 },
  modalBtnCancel: {
    flex: 1, paddingVertical: 14, borderRadius: 14,
    backgroundColor: '#F0EBE4', alignItems: 'center',
  },
  modalBtnCancelText: { fontSize: 15, fontWeight: '700', color: COLORS.textSecondary },
  modalBtnSave: {
    flex: 1, paddingVertical: 14, borderRadius: 14,
    backgroundColor: COLORS.primary, alignItems: 'center',
  },
  modalBtnSaveText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
});
