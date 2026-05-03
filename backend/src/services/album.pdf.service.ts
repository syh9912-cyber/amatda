/**
 * 성장 앨범 PDF 생성 서비스 (Luxury Redesign v2)
 *
 * 레이아웃: Landscape A4 (841.89×595.28pt)
 * 표지: 더블 스프레드 커버 이미지 전체 배경, 우측 패널에 아이 이름/기간 오버레이
 * 본문: 2×2 그리드, 마일스톤 배지 + 세리프 메모 폰트, 고급 레이아웃
 *
 * 의존성: pdfkit, firebase-admin
 */

import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import * as admin from 'firebase-admin';
import { storage, collections } from './firestore';

// ─── 이모지/특수문자 제거 (폰트 미지원) ────────────────────────────────
function stripEmoji(str: string): string {
  return str
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
    .replace(/[\u{2600}-\u{27FF}]/gu, '')
    .replace(/[\u{2300}-\u{23FF}]/gu, '')
    .replace(/[\u{FE00}-\u{FEFF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Landscape A4 ────────────────────────────────────────────────────
const A4_W = 841.89;
const A4_H = 595.28;

// ─── 커버 배경 이미지 경로 (.jpg / .png 모두 시도) ─────────────────
const COVER_IMG_PATHS = [
  path.join(__dirname, '../../../src/assets/album-cover.jpg'),
  path.join(__dirname, '../../../src/assets/album-cover.png'),
  path.join(__dirname, '../../assets/album-cover.jpg'),
  path.join(__dirname, '../../assets/album-cover.png'),
  path.join(process.cwd(), 'src/assets/album-cover.jpg'),
  path.join(process.cwd(), 'src/assets/album-cover.png'),
];

let cachedCoverImg: Buffer | null = null;
let coverImgLoadAttempted = false;

// ─── 마일스톤 이미지 디렉토리 (백엔드 assets에 복사된 256개 PNG) ──
const MILESTONE_IMG_DIRS = [
  path.join(__dirname, '../../../src/assets/milestones-sm'),
  path.join(__dirname, '../../assets/milestones-sm'),
  path.join(process.cwd(), 'src/assets/milestones-sm'),
];

let _milestoneImgDir: string | null = null;
let _milestoneFiles: Set<string> | null = null;

/** 마일스톤 이미지 폴더를 한 번만 스캔 후 캐시 */
function getMilestoneFileSet(): { dir: string; files: Set<string> } | null {
  if (_milestoneFiles !== null && _milestoneImgDir !== null) {
    return { dir: _milestoneImgDir, files: _milestoneFiles };
  }
  for (const dir of MILESTONE_IMG_DIRS) {
    if (fs.existsSync(dir)) {
      try {
        const files = new Set(fs.readdirSync(dir));
        _milestoneImgDir = dir;
        _milestoneFiles = files;
        console.log(`[Album PDF] Milestone images: ${dir} (${files.size} files)`);
        return { dir, files };
      } catch { /* next */ }
    }
  }
  _milestoneFiles = new Set(); // 빈 Set으로 반복 탐색 방지
  console.warn('[Album PDF] milestones-sm directory not found');
  return null;
}

/** 마일스톤 레이블 → 파일명 안전 변환 (milestoneImages.ts 동일 로직) */
function safeMilestoneName(label: string): string {
  return label
    .replace(/[^a-zA-Z0-9\u3131-\u318E\uAC00-\uD7A3]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * 마일스톤 레이블로 PNG Buffer 반환
 * 파일명 규칙: {월령prefix}-{safeName}.png
 * 월령prefix를 모르므로 suffix 매칭: "-{safeName}.png"
 */
export function getMilestoneImageBuffer(label: string): Buffer | null {
  const result = getMilestoneFileSet();
  if (!result) return null;
  const { dir, files } = result;

  // 1차: 원본 레이블로 suffix 매칭
  const safeName = safeMilestoneName(label);
  const suffix = `-${safeName}.png`;
  for (const file of files) {
    if (file.endsWith(suffix)) {
      try { return fs.readFileSync(path.join(dir, file)); } catch { return null; }
    }
  }

  // 2차 fallback: 괄호 내용 제거 후 재시도 ("손 꽉 쥐기(파악반사)" → "손 꽉 쥐기")
  const noParen = label.replace(/\s*\([^)]*\)/g, '').trim();
  if (noParen !== label) {
    const safeName2 = safeMilestoneName(noParen);
    const suffix2 = `-${safeName2}.png`;
    for (const file of files) {
      if (file.endsWith(suffix2)) {
        try { return fs.readFileSync(path.join(dir, file)); } catch { return null; }
      }
    }
  }

  return null;
}

function loadCoverImage(): Buffer {
  if (coverImgLoadAttempted && cachedCoverImg) return cachedCoverImg;
  coverImgLoadAttempted = true;
  for (const p of COVER_IMG_PATHS) {
    if (fs.existsSync(p)) {
      cachedCoverImg = fs.readFileSync(p);
      console.log('[Album PDF] Cover image loaded from:', p);
      return cachedCoverImg;
    }
  }
  throw new Error(`[Album PDF] album-cover not found. Checked: ${COVER_IMG_PATHS.join(', ')}`);
}

// ─── NotoSans (제목/본문) 폰트 경로 ──────────────────────────────────
const FONT_LOCAL_PATHS = [
  path.join(__dirname, '../../../src/assets/fonts/NotoSansKR-Regular.otf'),
  path.join(__dirname, '../../assets/fonts/NotoSansKR-Regular.otf'),
  path.join(process.cwd(), 'src/assets/fonts/NotoSansKR-Regular.otf'),
  path.join(__dirname, '../../../src/assets/fonts/NotoSansKR-Regular.ttf'),
  path.join(__dirname, '../../assets/fonts/NotoSansKR-Regular.ttf'),
  path.join(process.cwd(), 'src/assets/fonts/NotoSansKR-Regular.ttf'),
];
const FONT_BOLD_LOCAL_PATHS = [
  path.join(__dirname, '../../../src/assets/fonts/NotoSansKR-Bold.otf'),
  path.join(__dirname, '../../assets/fonts/NotoSansKR-Bold.otf'),
  path.join(process.cwd(), 'src/assets/fonts/NotoSansKR-Bold.otf'),
];

// ─── NotoSerif (메모/고급 텍스트) 폰트 경로 ──────────────────────────
const FONT_SERIF_LOCAL_PATHS = [
  path.join(__dirname, '../../../src/assets/fonts/NotoSerifKR-Regular.otf'),
  path.join(__dirname, '../../assets/fonts/NotoSerifKR-Regular.otf'),
  path.join(process.cwd(), 'src/assets/fonts/NotoSerifKR-Regular.otf'),
];
const FONT_SERIF_BOLD_LOCAL_PATHS = [
  path.join(__dirname, '../../../src/assets/fonts/NotoSerifKR-Bold.otf'),
  path.join(__dirname, '../../assets/fonts/NotoSerifKR-Bold.otf'),
  path.join(process.cwd(), 'src/assets/fonts/NotoSerifKR-Bold.otf'),
];

const FONT_STORAGE_PATH = 'assets/fonts/NotoSansKR-Regular.otf';

let cachedFont: Buffer | null = null;
let cachedBoldFont: Buffer | null = null;
let cachedSerifFont: Buffer | null = null;
let cachedSerifBoldFont: Buffer | null = null;
let fontLoadAttempted = false;

async function loadKoreanFont(): Promise<{
  regular: Buffer | null;
  bold: Buffer | null;
  serif: Buffer | null;
  serifBold: Buffer | null;
}> {
  if (fontLoadAttempted) {
    return { regular: cachedFont, bold: cachedBoldFont, serif: cachedSerifFont, serifBold: cachedSerifBoldFont };
  }
  fontLoadAttempted = true;

  // NotoSans Regular
  for (const p of FONT_LOCAL_PATHS) {
    if (fs.existsSync(p)) {
      try { cachedFont = fs.readFileSync(p); break; } catch { /* next */ }
    }
  }
  // NotoSans Bold (optional)
  for (const p of FONT_BOLD_LOCAL_PATHS) {
    if (fs.existsSync(p)) {
      try { cachedBoldFont = fs.readFileSync(p); break; } catch { /* next */ }
    }
  }
  // NotoSerif Regular
  for (const p of FONT_SERIF_LOCAL_PATHS) {
    if (fs.existsSync(p)) {
      try { cachedSerifFont = fs.readFileSync(p); break; } catch { /* next */ }
    }
  }
  // NotoSerif Bold (optional)
  for (const p of FONT_SERIF_BOLD_LOCAL_PATHS) {
    if (fs.existsSync(p)) {
      try { cachedSerifBoldFont = fs.readFileSync(p); break; } catch { /* next */ }
    }
  }

  // Firebase Storage fallback for NotoSans Regular
  if (!cachedFont) {
    try {
      const file = storage.file(FONT_STORAGE_PATH);
      const [exists] = await file.exists();
      if (exists) {
        const [buf] = await file.download();
        cachedFont = buf;
      }
    } catch (e) {
      console.warn('[Album PDF] Storage font load failed:', e);
    }
  }

  if (!cachedFont) {
    console.warn('[Album PDF] No Korean font. Using Helvetica (Korean will be blank).');
  }
  if (!cachedSerifFont) {
    console.warn('[Album PDF] No Serif font. Memo will use Sans.');
  }

  return { regular: cachedFont, bold: cachedBoldFont, serif: cachedSerifFont, serifBold: cachedSerifBoldFont };
}

// ─── 이미지 다운로드 ──────────────────────────────────────────────────
async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

// ─── 날짜 포맷 ────────────────────────────────────────────────────────
function fmtDate(dateStr: string): string {
  const parts = dateStr.replace(/-/g, '.').split('.');
  if (parts.length >= 3) return `${parts[0]}.${parts[1]}.${parts[2]}`;
  return dateStr;
}
function fmtMonth(dateStr: string): string {
  const parts = dateStr.replace(/-/g, '.').split('.');
  if (parts.length >= 2) return `${parts[0]}년 ${parts[1]}월`;
  return dateStr;
}

// ─── PDF 사진 타입 ────────────────────────────────────────────────────
export interface AlbumPhoto {
  printUrl: string;
  thumbUrl: string;
  date: string;
  milestone?: string;
  milestoneEmoji?: string;
  milestoneColor?: string;   // 카테고리 색상 (#RRGGBB) — 원형 배지에 사용
  memo?: string;
}

// ─── 사진 그리기: cover 방식 (셀 꽉 채우기, 중앙 크롭) ────────────────
function drawPhotoFit(
  doc: PDFKit.PDFDocument,
  imgBuf: Buffer,
  x: number, y: number, w: number, h: number,
) {
  doc.save();
  // 4pt 라운드 클립으로 셀 외부 잘림 방지
  doc.roundedRect(x, y, w, h, 6).clip();
  try {
    doc.image(imgBuf, x, y, { cover: [w, h] });
  } catch {
    doc.rect(x, y, w, h).fill('#EDE8E0');
  }
  doc.restore();

  // 미세 테두리
  doc.roundedRect(x, y, w, h, 6)
    .strokeColor('#DDD4C4')
    .lineWidth(0.5)
    .stroke();
}

// ─── 표지 그리기: 더블 스프레드 커버 배경만 (이름 없음) ──────────────
function drawCover(
  doc: PDFKit.PDFDocument,
  dateFrom: string,
  dateTo: string,
  fontRegular: string,
) {
  doc.addPage();

  const BLUE_GRAY = '#A8BDD0';

  const [fromYear, fromMon] = dateFrom.split('-');
  const [toYear, toMon]     = dateTo.split('-');
  const periodText = `${fromYear}.${fromMon} \u2014 ${toYear}.${toMon}`;

  // 커버 이미지 전체 페이지 배경 (1684×1190 → A4 landscape 841.89×595.28)
  const coverBgBuf = loadCoverImage();
  doc.image(coverBgBuf, 0, 0, { width: A4_W, height: A4_H });

  // 하단 우측 기간 텍스트 (은은하게)
  doc.font(fontRegular).fontSize(9).fillColor(BLUE_GRAY)
    .text(periodText, 0, 555, {
      width: A4_W - 16,
      align: 'right',
      lineBreak: false,
    });
}

// ─── 메인: PDF Buffer 생성 ────────────────────────────────────────────
export async function generateGrowthAlbumPDF(params: {
  childName: string;
  dateFrom: string;
  dateTo: string;
  photos: AlbumPhoto[];
  totalMonths: number;
}): Promise<Buffer> {
  const { childName, dateFrom, dateTo, photos, totalMonths } = params;
  void totalMonths;

  const { regular: fontBuf, bold: boldBuf, serif: serifBuf, serifBold: serifBoldBuf } = await loadKoreanFont();

  const doc = new PDFDocument({
    size: [A4_W, A4_H],
    margin: 0,
    autoFirstPage: false,
    info: {
      Title: `${stripEmoji(childName)} 성장 앨범`,
      Author: '\uc544\ub9de\ub2e4',
      Subject: `${dateFrom} ~ ${dateTo}`,
    },
  });

  const buffers: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => buffers.push(chunk));
  const pdfReady = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);
  });

  // 폰트 등록
  const FONT_R       = fontBuf     ? 'NotoKR'          : 'Helvetica';
  const FONT_B       = boldBuf     ? 'NotoKR-Bold'      : (fontBuf ? 'NotoKR' : 'Helvetica-Bold');
  const FONT_S       = serifBuf    ? 'NotoSerifKR'      : FONT_R;
  const FONT_SB      = serifBoldBuf ? 'NotoSerifKR-Bold' : (serifBuf ? 'NotoSerifKR' : FONT_B);
  if (fontBuf)      doc.registerFont('NotoKR', fontBuf);
  if (boldBuf)      doc.registerFont('NotoKR-Bold', boldBuf);
  if (serifBuf)     doc.registerFont('NotoSerifKR', serifBuf);
  if (serifBoldBuf) doc.registerFont('NotoSerifKR-Bold', serifBoldBuf);

  // ═══════════════════════════════════════════════════════════════
  // 표지
  // ═══════════════════════════════════════════════════════════════
  drawCover(doc, dateFrom, dateTo, FONT_R);

  // ═══════════════════════════════════════════════════════════════
  // 본문 페이지 (2×2 그리드, 고급 레이아웃)
  // ═══════════════════════════════════════════════════════════════

  // ── 레이아웃 상수 ──
  const MARGIN    = 28;
  const HEADER_H  = 34;        // 월 헤더 영역 높이
  const HEADER_GAP = 10;       // 헤더와 사진 사이
  const FOOTER_H  = 16;        // 하단 푸터 영역

  const COL_COUNT  = 2;
  const ROW_COUNT  = 2;
  const COL_GAP    = 16;       // 열 사이 간격
  const ROW_GAP    = 10;       // 행 사이 간격
  const CAPTION_H  = 54;       // 날짜 + 마일스톤 + 메모

  const totalW = A4_W - MARGIN * 2;
  const totalH = A4_H - MARGIN * 2 - HEADER_H - HEADER_GAP - FOOTER_H;
  const PHOTO_W = (totalW - COL_GAP * (COL_COUNT - 1)) / COL_COUNT;
  const PHOTO_H = (totalH - ROW_GAP * (ROW_COUNT - 1) - CAPTION_H * ROW_COUNT) / ROW_COUNT;

  const COL_X     = Array.from({ length: COL_COUNT }, (_, i) => MARGIN + i * (PHOTO_W + COL_GAP));
  const ROW_Y_START = MARGIN + HEADER_H + HEADER_GAP;
  const ROW_Y     = Array.from({ length: ROW_COUNT }, (_, i) =>
    ROW_Y_START + i * (PHOTO_H + CAPTION_H + ROW_GAP)
  );

  // ── 색상 팔레트 ──
  const C_BG          = '#FDFAF5';  // 따뜻한 크림 배경
  const C_GOLD_DEEP   = '#B8922A';  // 짙은 골드
  const C_GOLD_LT     = '#D4A847';  // 밝은 골드
  const C_MONTH_TITLE = '#4A3520';  // 짙은 브라운 (월 제목)
  const C_DATE        = '#7A5C40';  // 날짜 텍스트
  const C_MILESTONE   = '#5C3D1E';  // 마일스톤 텍스트
  const C_MILESTONE_BG = '#F5ECD8'; // 마일스톤 배지 배경
  const C_MEMO        = '#6B4F3A';  // 메모 텍스트
  const C_FOOTER      = '#C8B8A0';  // 푸터 텍스트
  const C_EMPTY       = '#EDE9E2';  // 빈 칸 배경

  // ── 월별 그룹핑 ──
  const photosByMonth: Map<string, AlbumPhoto[]> = new Map();
  for (const photo of photos) {
    const mon = fmtMonth(photo.date);
    if (!photosByMonth.has(mon)) photosByMonth.set(mon, []);
    photosByMonth.get(mon)!.push(photo);
  }

  for (const [monthLabel, monthPhotos] of photosByMonth) {
    const pages: AlbumPhoto[][] = [];
    for (let i = 0; i < monthPhotos.length; i += 4) {
      pages.push(monthPhotos.slice(i, i + 4));
    }

    for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
      const pagePhotos = pages[pageIdx];
      doc.addPage();

      // ── 배경 ──
      doc.rect(0, 0, A4_W, A4_H).fill(C_BG);

      // ── 좌측 골드 액센트 스트립 ──
      doc.rect(0, 0, 4, A4_H).fill(C_GOLD_DEEP);
      // 스트립 내부 하이라이트
      doc.rect(4, 0, 1, A4_H).fill(C_GOLD_LT);

      // ── 월 헤더 ──
      const headerLabel = pageIdx === 0 ? monthLabel : `${monthLabel} (${pageIdx + 1})`;
      const headerX = MARGIN + 12;
      const headerY = MARGIN + 4;
      const headerCenterY = MARGIN + HEADER_H / 2;

      // 헤더 좌측 짧은 금색 막대
      doc.rect(headerX - 10, headerCenterY - 7, 3, 14).fill(C_GOLD_DEEP);

      // 월 제목 텍스트
      doc.font(FONT_SB).fontSize(14).fillColor(C_MONTH_TITLE)
        .text(stripEmoji(headerLabel), headerX, headerY + 2, { lineBreak: false });

      // 제목 우측 가는 골드 라인 (헤더 구분선)
      const titleWidth = doc.widthOfString(stripEmoji(headerLabel));
      const lineStartX = headerX + titleWidth + 12;
      doc.moveTo(lineStartX, headerCenterY)
        .lineTo(A4_W - MARGIN, headerCenterY)
        .strokeColor(C_GOLD_LT)
        .lineWidth(0.6)
        .stroke();

      // 구분선 아래 얇은 그림자 선
      doc.moveTo(headerX, MARGIN + HEADER_H + 2)
        .lineTo(A4_W - MARGIN, MARGIN + HEADER_H + 2)
        .strokeColor('#EDE0CC')
        .lineWidth(0.4)
        .stroke();

      // ── 2×2 사진 배치 ──
      for (let idx = 0; idx < 4; idx++) {
        const col  = idx % COL_COUNT;
        const row  = Math.floor(idx / COL_COUNT);
        const x    = COL_X[col];
        const y    = ROW_Y[row];
        const photo = pagePhotos[idx];

        if (!photo) {
          // 빈 칸: 점선 테두리
          doc.roundedRect(x, y, PHOTO_W, PHOTO_H, 6).fill(C_EMPTY);
          doc.roundedRect(x, y, PHOTO_W, PHOTO_H, 6)
            .dash(4, { space: 4 })
            .strokeColor('#D0C8BC')
            .lineWidth(0.5)
            .stroke();
          doc.undash();
          continue;
        }

        // 이미지 다운로드 (print → thumb)
        const imgBuf = await fetchImageBuffer(photo.printUrl)
          || await fetchImageBuffer(photo.thumbUrl);

        if (imgBuf) {
          // 미세한 그림자 효과: 사진 아래 회색 레이어
          doc.roundedRect(x + 2, y + 2, PHOTO_W, PHOTO_H, 6)
            .fill('#D8D0C4');
          drawPhotoFit(doc, imgBuf, x, y, PHOTO_W, PHOTO_H);
        } else {
          doc.roundedRect(x, y, PHOTO_W, PHOTO_H, 6).fill('#EDE8E0');
          doc.font(FONT_R).fontSize(14).fillColor('#C0B0A0')
            .text('\uc0ac\uc9c4', x, y + PHOTO_H / 2 - 10, {
              width: PHOTO_W, align: 'center', lineBreak: false,
            });
        }

        // ── 캡션 영역 ──
        const captionY = y + PHOTO_H + 6;

        // ── 날짜 (1행) ──
        const dateLabel = fmtDate(photo.date);
        doc.font(FONT_B).fontSize(9).fillColor(C_DATE)
          .text(dateLabel, x, captionY, { lineBreak: false });

        // ── 마일스톤 (2행): PNG 이미지 우선, 없으면 컬러 원형 폴백 ──
        const milestone = photo.milestone ? stripEmoji(photo.milestone) : '';
        if (milestone) {
          const mColor = photo.milestoneColor || '#FF8C5A';
          const rowY = captionY + 13;
          const IMG_SIZE = 22; // 마일스톤 PNG 표시 크기 (pt)

          const mImgBuf = photo.milestone ? getMilestoneImageBuffer(photo.milestone) : null;

          if (mImgBuf) {
            // ── PNG 이미지 렌더링 ──
            doc.save();
            doc.roundedRect(x, rowY, IMG_SIZE, IMG_SIZE, 4).clip();
            try {
              doc.image(mImgBuf, x, rowY, { width: IMG_SIZE, height: IMG_SIZE });
            } catch {
              doc.rect(x, rowY, IMG_SIZE, IMG_SIZE).fill(mColor + '40');
            }
            doc.restore();
            // 이미지 테두리
            doc.roundedRect(x, rowY, IMG_SIZE, IMG_SIZE, 4)
              .strokeColor(mColor + '66').lineWidth(0.5).stroke();
            // 마일스톤 텍스트 (이미지 오른쪽)
            doc.font(FONT_B).fontSize(7.5).fillColor(mColor)
              .text(milestone, x + IMG_SIZE + 4, rowY + 5, {
                width: PHOTO_W - IMG_SIZE - 6,
                lineBreak: false,
                ellipsis: true,
              });
          } else {
            // ── 폴백: 카테고리 컬러 원형 ──
            const circleR = 5;
            const circleX = x + circleR;
            const circleY = rowY + circleR;
            doc.circle(circleX, circleY, circleR).fill(mColor);
            doc.font(FONT_B).fontSize(5.5).fillColor('#FFFFFF')
              .text('\u2605', x, circleY - 4.5, {
                width: circleR * 2, align: 'center', lineBreak: false,
              });
            doc.font(FONT_B).fontSize(7.5).fillColor(mColor)
              .text(milestone, x + circleR * 2 + 4, rowY + 1.5, {
                width: PHOTO_W - circleR * 2 - 6,
                lineBreak: false,
                ellipsis: true,
              });
          }
        }

        // ── 메모 (3행, 세리프 폰트) ──
        const memo = photo.memo ? stripEmoji(photo.memo) : '';
        if (memo) {
          const memoRowY = captionY + (milestone ? 28 : 14);
          // 메모 구분선
          doc.moveTo(x, memoRowY)
            .lineTo(x + PHOTO_W, memoRowY)
            .strokeColor('#E8DDD0')
            .lineWidth(0.4)
            .stroke();

          // 메모 텍스트 (NotoSerif)
          doc.font(FONT_S).fontSize(7.5).fillColor(C_MEMO)
            .text(`\u201c${memo}\u201d`, x, memoRowY + 3, {
              width: PHOTO_W,
              lineBreak: false,
              ellipsis: true,
            });
        }
      }

      // ── 푸터: 페이지 번호 + 브랜드 ──
      const footerY = A4_H - MARGIN - 8;
      doc.font(FONT_R).fontSize(7).fillColor(C_FOOTER)
        .text('\uc544\ub9db\ub2e4', MARGIN + 8, footerY, { lineBreak: false });
      doc.font(FONT_R).fontSize(7).fillColor(C_FOOTER)
        .text(stripEmoji(monthLabel), 0, footerY, {
          width: A4_W - MARGIN,
          align: 'right',
          lineBreak: false,
        });
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 마지막 페이지 (클로징)
  // ═══════════════════════════════════════════════════════════════
  doc.addPage();

  // 배경: 위쪽 따뜻한 크림, 아래쪽 살짝 더 진한 크림
  doc.rect(0, 0, A4_W, A4_H).fill('#F5EDE0');
  doc.rect(0, 0, A4_W, A4_H * 0.45).fill('#FAF4EC');

  // 상단/하단 이중 금색 프레임
  doc.rect(50, 48, A4_W - 100, 2).fill('#B8922A');
  doc.rect(50, 54, A4_W - 100, 0.5).fill('#D4A847');
  doc.rect(50, A4_H - 54, A4_W - 100, 0.5).fill('#D4A847');
  doc.rect(50, A4_H - 48, A4_W - 100, 2).fill('#B8922A');

  // 좌우 세로 금색 프레임
  doc.rect(50, 48, 2, A4_H - 96).fill('#B8922A');
  doc.rect(A4_W - 52, 48, 2, A4_H - 96).fill('#B8922A');

  const endCX = A4_W / 2;

  // 별 장식 (상단)
  doc.font(FONT_R).fontSize(12).fillColor('#C9A040')
    .text('\u2736', 0, A4_H / 2 - 90, {
      width: A4_W, align: 'center', lineBreak: false,
    });

  // 아이 이름 (세리프 볼드)
  doc.font(FONT_SB).fontSize(32).fillColor('#4A3520')
    .text(stripEmoji(childName), 60, A4_H / 2 - 64, {
      width: A4_W - 120, align: 'center', lineBreak: false,
    });

  // 장식 가로선 (이름 아래)
  doc.moveTo(endCX - 80, A4_H / 2 - 12).lineTo(endCX - 14, A4_H / 2 - 12)
    .strokeColor('#C9A040').lineWidth(0.8).stroke();
  doc.moveTo(endCX + 14, A4_H / 2 - 12).lineTo(endCX + 80, A4_H / 2 - 12)
    .strokeColor('#C9A040').lineWidth(0.8).stroke();
  // 중앙 다이아몬드
  doc.save();
  doc.fillColor('#C9A040');
  doc.moveTo(endCX, A4_H / 2 - 17)
    .lineTo(endCX + 5, A4_H / 2 - 12)
    .lineTo(endCX, A4_H / 2 - 7)
    .lineTo(endCX - 5, A4_H / 2 - 12)
    .closePath().fill();
  doc.restore();

  // 부제 (세리프 레귤러)
  doc.font(FONT_S).fontSize(14).fillColor('#8B6B4A')
    .text('\uc18c\uc911\ud55c \uae30\uc5b5\ub4e4', 60, A4_H / 2 + 2, {
      width: A4_W - 120, align: 'center', lineBreak: false,
    });

  // 장식 점 3개
  doc.circle(endCX - 22, A4_H / 2 + 28, 2.5).fill('#C9A96E');
  doc.circle(endCX,      A4_H / 2 + 28, 2.5).fill('#C9A96E');
  doc.circle(endCX + 22, A4_H / 2 + 28, 2.5).fill('#C9A96E');

  // 사진 수 + 브랜드
  doc.font(FONT_B).fontSize(9.5).fillColor('#A08060')
    .text(`${photos.length}\uc7a5\uc758 \uc0ac\uc9c4  \u00b7  \uc544\ub9db\ub2e4`, 60, A4_H / 2 + 46, {
      width: A4_W - 120, align: 'center', lineBreak: false,
    });

  doc.end();
  return pdfReady;
}

// ─── Firebase Storage에 PDF 업로드 ───────────────────────────────────
export async function uploadAlbumPDF(
  userId: string,
  childId: string,
  albumId: string,
  pdfBuffer: Buffer,
): Promise<string> {
  const storagePath = `growth_albums/${userId}/${childId}/${albumId}.pdf`;
  const file = storage.file(storagePath);

  // 추측 불가능한 다운로드 토큰 — storage rules와 무관하게 인증된 다운로드
  const downloadToken = uuidv4();
  await file.save(pdfBuffer, {
    metadata: {
      contentType: 'application/pdf',
      metadata: {
        userId,
        childId,
        albumId,
        firebaseStorageDownloadTokens: downloadToken,
      },
    },
    resumable: false,
  });

  const bucketName = file.bucket.name;
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(storagePath)}?alt=media&token=${downloadToken}`;
}

// ─── 앨범 상태 업데이트 ────────────────────────────────────────────────
export async function updateAlbumStatus(
  albumId: string,
  status: 'generating' | 'ready' | 'error',
  extra: Record<string, unknown> = {},
): Promise<void> {
  await collections.growthAlbums.doc(albumId).update({
    status,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    ...extra,
  });
}
