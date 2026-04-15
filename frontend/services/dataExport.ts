import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Child } from '../stores/childStore';
import { childApi, coachingApi, observationApi, pregnancyApi, albumApi } from './api';

/**
 * 영상 URI → 첫 장면 썸네일 추출 (동적 import + fallback)
 * expo-video-thumbnails 네이티브 모듈이 없는 APK에선 원본 URI 그대로 반환
 */
async function getVideoThumbnail(videoUri: string): Promise<string> {
  try {
    const VideoThumbnails = await import('expo-video-thumbnails');
    const { uri } = await VideoThumbnails.getThumbnailAsync(videoUri, { time: 500 });
    return uri;
  } catch {
    return videoUri; // fallback: 원본 URI
  }
}

function getAgeText(months: number): string {
  if (months < 12) return `${months}개월`;
  const years = Math.floor(months / 12);
  const remaining = months % 12;
  if (remaining === 0) return `${years}세`;
  return `${years}세 ${remaining}개월`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function exportChildDataAsPDF(child: Child): Promise<void> {
  const isPregnant = child.isPregnant === true;
  const today = new Date().toLocaleDateString('ko-KR');

  // ── Pregnancy: Album-style export (photos only) ──
  if (isPregnant) {
    return exportPregnancyAlbum(child, today);
  }

  // ── Baby: existing detailed export ──
  return exportBabyData(child, today);
}

/* ================================================================== */
/*  Pregnancy Album Export — 사진앨범 스타일 (2x2 그리드)               */
/* ================================================================== */
async function exportPregnancyAlbum(child: Child, today: string): Promise<void> {
  const title = `${escapeHtml(child.name)}의 추억 앨범`;

  // Fetch timeline (includes records with mediaUri)
  let pregnancyTimeline: Record<string, unknown>[] = [];
  try {
    const res = await pregnancyApi.getTimeline(child.id);
    pregnancyTimeline = (res.data?.data as Record<string, unknown>[] ?? []);
  } catch { /* empty */ }

  // Extract only items with media (photos/videos)
  interface AlbumItem {
    mediaUri: string;
    mediaType: string;
    caption: string;
    week: number;
    date: string;
    emoji: string;
    title: string;
  }

  const albumItems: AlbumItem[] = [];
  for (const weekGroup of pregnancyTimeline) {
    const week = weekGroup.week as number;
    const items = (weekGroup.items as Record<string, unknown>[]) ?? [];
    for (const item of items) {
      const uri = String(item.mediaUri ?? '');
      if (!uri) continue; // skip items without media
      albumItems.push({
        mediaUri: uri,
        mediaType: String(item.mediaType ?? 'photo'),
        caption: String(item.content ?? ''),
        week,
        date: String(item.createdAt ?? '').slice(0, 10),
        emoji: String(item.emoji ?? ''),
        title: String(item.title ?? ''),
      });
    }
  }

  // Sort by date (oldest first, like a photo album)
  albumItems.sort((a, b) => a.date.localeCompare(b.date));

  // 영상 → 첫 장면 썸네일로 교체
  for (const item of albumItems) {
    if (item.mediaType === 'video') {
      item.mediaUri = await getVideoThumbnail(item.mediaUri);
    }
  }

  // Build album HTML
  let html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, 'Helvetica Neue', sans-serif;
    background: #FDF8F4;
    color: #2D2016;
    padding: 20px;
  }
  .album-header {
    text-align: center;
    margin-bottom: 24px;
    padding-bottom: 16px;
    border-bottom: 2px dashed #FFD4B8;
  }
  .album-title {
    font-size: 24px;
    color: #FF8C5A;
    font-weight: 700;
    margin-bottom: 4px;
  }
  .album-sub {
    font-size: 12px;
    color: #B5A99A;
  }
  .album-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    justify-content: flex-start;
  }
  .album-cell {
    width: calc(50% - 6px);
    background: #FFFFFF;
    border-radius: 10px;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    page-break-inside: avoid;
    margin-bottom: 4px;
  }
  .album-img-wrap {
    position: relative;
    width: 100%;
    padding-top: 100%; /* 1:1 ratio */
    background: #F5EDE6;
    overflow: hidden;
  }
  .album-img-wrap img {
    position: absolute;
    top: 0; left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .video-badge {
    position: absolute;
    top: 8px; right: 8px;
    background: rgba(0,0,0,0.55);
    color: #fff;
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 4px;
  }
  .album-info {
    padding: 8px 10px 10px;
  }
  .album-week {
    font-size: 10px;
    color: #FF8C5A;
    font-weight: 600;
    margin-bottom: 2px;
  }
  .album-caption {
    font-size: 12px;
    color: #4A3728;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .album-date {
    font-size: 10px;
    color: #B5A99A;
    margin-top: 4px;
  }
  .album-empty {
    text-align: center;
    padding: 60px 20px;
    color: #B5A99A;
  }
  .album-empty-icon { font-size: 48px; margin-bottom: 12px; }
  .album-empty-text { font-size: 14px; }
  .album-footer {
    margin-top: 24px;
    text-align: center;
    color: #C4B8AB;
    font-size: 10px;
    padding-top: 12px;
    border-top: 1px solid #E8DDD0;
  }
</style>
</head>
<body>
  <div class="album-header">
    <div class="album-title">${title}</div>
    <div class="album-sub">${today}</div>
  </div>`;

  if (albumItems.length === 0) {
    html += `
  <div class="album-empty">
    <div class="album-empty-icon">📷</div>
    <div class="album-empty-text">아직 등록된 사진이 없어요</div>
  </div>`;
  } else {
    html += `<div class="album-grid">`;
    for (const item of albumItems) {
      const isVideo = item.mediaType === 'video';
      const caption = item.caption || item.title;
      html += `
    <div class="album-cell">
      <div class="album-img-wrap">
        <img src="${escapeHtml(item.mediaUri)}" alt="" />
        ${isVideo ? '<div class="video-badge">▶ 영상</div>' : ''}
      </div>
      <div class="album-info">
        <div class="album-week">${item.emoji} ${item.week}주차</div>
        ${caption ? `<div class="album-caption">${escapeHtml(caption)}</div>` : ''}
        <div class="album-date">${item.date}</div>
      </div>
    </div>`;
    }
    html += `</div>`;
  }

  html += `
  <div class="album-footer">
    아맞다 (A-matda) | SY Labs | ${today}
  </div>
</body>
</html>`;

  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: title,
    UTI: 'com.adobe.pdf',
  });
}

/* ================================================================== */
/*  Baby Data Export — 2x2 성장앨범 스타일                              */
/* ================================================================== */
async function exportBabyData(child: Child, today: string): Promise<void> {
  const title = `${escapeHtml(child.name)}의 성장앨범`;
  const ageText = getAgeText(child.ageInfo.months);
  const genderText = child.gender === 'M' ? '남아' : '여아';
  const temperament = escapeHtml(child.innateData?.label ?? '');

  // 데이터 병렬 로드
  interface AlbumPhoto {
    uri: string;
    milestone: string;
    milestoneEmoji: string;
    memo: string;
    date: string;
  }

  let albumPhotos: AlbumPhoto[] = [];
  let observations: Record<string, unknown>[] = [];

  const [albumRes, observationsRes] = await Promise.allSettled([
    albumApi.list(child.id),
    observationApi.list(child.id),
  ]);

  if (albumRes.status === 'fulfilled') {
    const raw = (albumRes.value.data?.data as Record<string, unknown>[]) ?? [];
    albumPhotos = raw
      .filter((p) => p.uri || p.imageUrl)
      .map((p) => ({
        uri: String(p.uri ?? p.imageUrl ?? ''),
        milestone: String(p.milestone ?? ''),
        milestoneEmoji: String(p.milestoneEmoji ?? ''),
        memo: String(p.memo ?? ''),
        date: String(p.date ?? p.createdAt ?? '').slice(0, 10),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
  if (observationsRes.status === 'fulfilled') {
    observations = (observationsRes.value.data?.data as Record<string, unknown>[]) ?? [];
  }

  let html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, 'Helvetica Neue', sans-serif;
    background: #FDF8F4;
    color: #2D2016;
    padding: 20px;
  }
  /* ── Cover Page ── */
  .cover {
    text-align: center;
    padding: 60px 20px 40px;
    page-break-after: always;
  }
  .cover-emoji { font-size: 56px; margin-bottom: 16px; }
  .cover-title {
    font-size: 28px;
    font-weight: 800;
    color: #FF8C5A;
    letter-spacing: -0.5px;
  }
  .cover-sub {
    font-size: 14px;
    color: #8C7A6B;
    margin-top: 8px;
  }
  .cover-info {
    margin-top: 32px;
    display: inline-block;
    background: #FFF5EC;
    border-radius: 16px;
    padding: 16px 28px;
    text-align: left;
  }
  .cover-info p {
    font-size: 13px;
    color: #4A3728;
    line-height: 1.8;
  }
  .cover-info .label {
    font-weight: 700;
    color: #FF8C5A;
    margin-right: 6px;
  }
  .cover-date {
    margin-top: 24px;
    font-size: 11px;
    color: #C4B8AB;
  }

  /* ── Section Title ── */
  .section-title {
    font-size: 18px;
    font-weight: 700;
    color: #2D2016;
    margin: 24px 0 12px;
    padding-left: 10px;
    border-left: 4px solid #FF8C5A;
  }

  /* ── 2x2 Album Grid ── */
  .album-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    justify-content: flex-start;
  }
  .album-cell {
    width: calc(50% - 6px);
    background: #FFFFFF;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    page-break-inside: avoid;
    margin-bottom: 4px;
  }
  .album-img-wrap {
    position: relative;
    width: 100%;
    padding-top: 100%;
    background: #F5EDE6;
    overflow: hidden;
  }
  .album-img-wrap img {
    position: absolute;
    top: 0; left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .milestone-badge {
    position: absolute;
    bottom: 8px; left: 8px;
    background: rgba(255,140,90,0.9);
    color: #fff;
    font-size: 10px;
    font-weight: 600;
    padding: 3px 8px;
    border-radius: 8px;
    max-width: 80%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .album-info {
    padding: 8px 10px 10px;
  }
  .album-memo {
    font-size: 12px;
    color: #4A3728;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .album-date {
    font-size: 10px;
    color: #B5A99A;
    margin-top: 4px;
  }

  /* ── Observation Cards ── */
  .obs-card {
    background: #FFFFFF;
    border-radius: 12px;
    padding: 14px 16px;
    margin-bottom: 8px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.04);
  }
  .obs-date {
    font-size: 10px;
    color: #FF8C5A;
    font-weight: 600;
    margin-bottom: 4px;
  }
  .obs-text {
    font-size: 12px;
    color: #4A3728;
    line-height: 1.5;
  }

  /* ── Empty State ── */
  .empty {
    text-align: center;
    padding: 40px 20px;
    color: #B5A99A;
  }
  .empty-icon { font-size: 40px; margin-bottom: 8px; }
  .empty-text { font-size: 13px; }

  /* ── Footer ── */
  .footer {
    margin-top: 32px;
    text-align: center;
    color: #C4B8AB;
    font-size: 10px;
    padding-top: 16px;
    border-top: 1px solid #E8DDD0;
  }
</style>
</head>
<body>

  <!-- Cover Page -->
  <div class="cover">
    <div class="cover-emoji">📖</div>
    <div class="cover-title">${title}</div>
    <div class="cover-sub">${escapeHtml(child.name)}의 특별한 성장 이야기</div>
    <div class="cover-info">
      <p><span class="label">이름</span>${escapeHtml(child.name)}</p>
      <p><span class="label">나이</span>${ageText} (${genderText})</p>
      <p><span class="label">기질</span>${temperament || '-'}</p>
      <p><span class="label">생년월일</span>${child.birthDate ?? '-'}</p>
    </div>
    <div class="cover-date">${today} | SY Labs</div>
  </div>`;

  // ── Photo Album Section ──
  if (albumPhotos.length > 0) {
    html += `<div class="section-title">성장 앨범</div>`;
    html += `<div class="album-grid">`;
    for (const photo of albumPhotos) {
      const badge = photo.milestone
        ? `<div class="milestone-badge">${escapeHtml(photo.milestoneEmoji)} ${escapeHtml(photo.milestone)}</div>`
        : '';
      html += `
    <div class="album-cell">
      <div class="album-img-wrap">
        <img src="${escapeHtml(photo.uri)}" alt="" />
        ${badge}
      </div>
      <div class="album-info">
        ${photo.memo ? `<div class="album-memo">${escapeHtml(photo.memo)}</div>` : ''}
        <div class="album-date">${photo.date}</div>
      </div>
    </div>`;
    }
    html += `</div>`;
  } else {
    html += `
    <div class="section-title">성장 앨범</div>
    <div class="empty">
      <div class="empty-icon">📷</div>
      <div class="empty-text">아직 등록된 성장 사진이 없어요</div>
    </div>`;
  }

  // ── Observation Diary Section (최근 10건) ──
  if (observations.length > 0) {
    html += `<div class="section-title">관찰 일기</div>`;
    for (const o of observations.slice(0, 10)) {
      const content = String(o.rawContent ?? o.content ?? '');
      const date = String(o.createdAt ?? '').slice(0, 10);
      html += `
    <div class="obs-card">
      <div class="obs-date">${date}</div>
      <div class="obs-text">${escapeHtml(content.slice(0, 300))}${content.length > 300 ? '...' : ''}</div>
    </div>`;
    }
  }

  html += `
  <div class="footer">
    <p>아맞다 (A-matda) | SY Labs | ${today}</p>
  </div>
</body>
</html>`;

  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: title,
    UTI: 'com.adobe.pdf',
  });
}
