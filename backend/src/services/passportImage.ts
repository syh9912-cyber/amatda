/**
 * 여권 카드 이미지 생성 서비스
 * @napi-rs/canvas를 사용하여 PNG 이미지를 생성
 */
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import path from 'path';

/* ─── Types ─── */

export interface PassportCardData {
  childName: string;
  ageInfo: string;
  gender: string;
  birthDate: string;
  temperament: string;
  personality: string[];
  favorites: string[];
  shareCode: string;
}

/* ─── Font Setup ─── */

let fontLoaded = false;
const koreanFontName = 'PassportFont';

/** 로컬 한글 폰트 등록 (배포 시 포함된 TTF 파일 사용) */
function ensureKoreanFont(): void {
  if (fontLoaded) return;

  // Firebase Functions: __dirname = dist/src/services → 3단계 올라가야 backend/fonts
  // 로컬 dev: __dirname = src/services → 2단계 올라가야 backend/fonts
  // process.cwd()가 가장 안정적 (항상 backend/ 루트)
  const fontsDir = path.join(process.cwd(), 'fonts');
  const regularPath = path.join(fontsDir, 'NotoSansKR-Regular.ttf');
  const boldPath = path.join(fontsDir, 'NotoSansKR-Bold.ttf');

  const registered = GlobalFonts.registerFromPath(regularPath, 'PassportFont');
  if (registered) {
    fontLoaded = true;
    console.log('Korean regular font loaded from local file');
  } else {
    console.warn('Failed to register Korean regular font from:', regularPath);
  }

  const boldRegistered = GlobalFonts.registerFromPath(boldPath, 'PassportFontBold');
  if (boldRegistered) {
    console.log('Korean bold font loaded from local file');
  } else {
    console.warn('Failed to register Korean bold font from:', boldPath);
  }
}

/* ─── Drawing Helpers ─── */

type Ctx = ReturnType<ReturnType<typeof createCanvas>['getContext']>;

function roundedRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function centeredTextWithSpacing(
  ctx: Ctx, text: string, cx: number, y: number, spacing: number,
): void {
  if (spacing <= 0) { ctx.fillText(text, cx, y); return; }
  const chars = text.split('');
  let totalW = 0;
  for (const ch of chars) totalW += ctx.measureText(ch).width;
  totalW += (chars.length - 1) * spacing;
  let x = cx - totalW / 2;
  ctx.textAlign = 'left';
  for (const ch of chars) {
    ctx.fillText(ch, x, y);
    x += ctx.measureText(ch).width + spacing;
  }
  ctx.textAlign = 'center';
}

/* ─── Main Generator ─── */

export function generatePassportPng(data: PassportCardData): Buffer {
  ensureKoreanFont();

  const F = koreanFontName;
  const W = 600;
  const H = 820;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // ═══ 배경 ═══
  ctx.fillStyle = '#F0EBE3';
  ctx.fillRect(0, 0, W, H);

  const cx = 20, cy = 20, cw = W - 40, ch = H - 40;

  // ═══ 카드 영역 클립 ═══
  ctx.save();
  ctx.beginPath();
  roundedRect(ctx, cx, cy, cw, ch, 16);
  ctx.clip();

  // 카드 배경
  ctx.fillStyle = '#FFFDF7';
  ctx.fillRect(cx, cy, cw, ch);

  // ═══ 상단 밴드 (그라디언트) ═══
  const grad = ctx.createLinearGradient(cx, cy, cx + cw, cy);
  grad.addColorStop(0, '#1B3A5C');
  grad.addColorStop(1, '#2C5F8A');
  ctx.fillStyle = grad;
  ctx.fillRect(cx, cy, cw, 80);

  // 밴드 텍스트
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = 'rgba(212,175,55,0.7)';
  ctx.font = `600 11px ${F}`;
  centeredTextWithSpacing(ctx, 'REPUBLIC OF CHILDHOOD', W / 2, cy + 22, 3);

  ctx.fillStyle = '#D4AF37';
  ctx.font = `800 26px ${F}`;
  centeredTextWithSpacing(ctx, 'PASSPORT', W / 2, cy + 46, 6);

  ctx.fillStyle = 'rgba(212,175,55,0.7)';
  ctx.font = `600 11px ${F}`;
  ctx.fillText('아이 여권', W / 2, cy + 68);

  ctx.restore();

  // ═══ 바디 콘텐츠 ═══
  const pad = 24;
  const bl = cx + pad;
  const br = cx + cw - pad;
  let y = cy + 80 + pad;

  // ─── 사진 영역 ───
  const pW = 120, pH = 150;
  ctx.fillStyle = '#F5EFE6';
  ctx.fillRect(bl, y, pW, pH);
  ctx.strokeStyle = '#C4A882';
  ctx.lineWidth = 2;
  ctx.strokeRect(bl, y, pW, pH);

  // 이름 이니셜 원형
  ctx.fillStyle = '#E0D1C0';
  ctx.beginPath();
  ctx.arc(bl + pW / 2, y + pH / 2, 36, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#1B3A5C';
  ctx.font = `700 32px ${F}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(data.childName.charAt(0), bl + pW / 2, y + pH / 2);

  // ─── 인적사항 필드 ───
  const fl = bl + pW + 20;
  let fy = y;

  const drawLabel = (text: string) => {
    ctx.font = `700 10px ${F}`;
    ctx.fillStyle = '#8B7355';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(text, fl, fy);
    fy += 14;
  };

  const drawValue = (text: string) => {
    ctx.font = `700 17px ${F}`;
    ctx.fillStyle = '#1B3A5C';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(text, fl, fy);
    fy += 28;
  };

  drawLabel('NAME');
  drawValue(data.childName);
  drawLabel('AGE');
  drawValue(data.ageInfo);
  drawLabel('BIRTH');
  drawValue(data.birthDate);
  drawLabel('GENDER');
  drawValue(data.gender === 'F' ? 'FEMALE' : 'MALE');

  y += pH + 20;

  // ─── 구분선 함수 ───
  const drawDivider = () => {
    ctx.strokeStyle = '#D4C5A9';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bl, y);
    ctx.lineTo(br, y);
    ctx.stroke();
    y += 16;
  };

  drawDivider();

  // ─── 기질 섹션 ───
  ctx.font = `700 10px ${F}`;
  ctx.fillStyle = '#8B7355';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('TEMPERAMENT TYPE', bl, y);
  y += 18;

  ctx.font = `700 20px ${F}`;
  ctx.fillStyle = '#1B3A5C';
  ctx.fillText(data.temperament, bl, y);
  y += 34;

  // ─── 성격 스탬프 ───
  if (data.personality.length > 0) {
    ctx.font = `700 10px ${F}`;
    ctx.fillStyle = '#8B7355';
    ctx.fillText('PERSONALITY', bl, y);
    y += 18;

    let sx = bl;
    for (const trait of data.personality.slice(0, 4)) {
      ctx.font = `700 13px ${F}`;
      const tw = ctx.measureText(trait).width + 24;
      if (sx + tw > br) { sx = bl; y += 34; }

      ctx.strokeStyle = '#1B3A5C';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      roundedRect(ctx, sx, y, tw, 28, 14);
      ctx.stroke();

      ctx.fillStyle = '#1B3A5C';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(trait, sx + tw / 2, y + 14);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';

      sx += tw + 8;
    }
    y += 40;
  }

  // ─── 좋아하는 활동 스탬프 ───
  if (data.favorites.length > 0) {
    ctx.font = `700 10px ${F}`;
    ctx.fillStyle = '#8B7355';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('FAVORITE ACTIVITIES', bl, y);
    y += 18;

    let sx = bl;
    for (const act of data.favorites) {
      ctx.font = `700 13px ${F}`;
      const tw = ctx.measureText(act).width + 24;
      if (sx + tw > br) { sx = bl; y += 34; }

      ctx.strokeStyle = '#2BA89E';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      roundedRect(ctx, sx, y, tw, 28, 14);
      ctx.stroke();

      ctx.fillStyle = '#2BA89E';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(act, sx + tw / 2, y + 14);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';

      sx += tw + 8;
    }
    y += 40;
  }

  drawDivider();

  // ─── 발급 정보 ───
  ctx.font = `700 10px ${F}`;
  ctx.fillStyle = '#8B7355';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('ISSUE DATE', bl, y);
  ctx.fillText('AUTHORITY', bl + 220, y);
  y += 14;

  const issueDate = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
  ctx.font = `700 14px ${F}`;
  ctx.fillStyle = '#1B3A5C';
  ctx.fillText(issueDate, bl, y);
  ctx.fillText('A-MATDA', bl + 220, y);
  y += 28;

  // ─── MRZ 바 ───
  ctx.fillStyle = '#F5EFE6';
  ctx.beginPath();
  roundedRect(ctx, bl, y, br - bl, 36, 4);
  ctx.fill();

  const mrzName = data.childName.toUpperCase().replace(/\s/g, '<');
  const mrzG = data.gender === 'F' ? 'F' : 'M';
  ctx.font = '11px monospace';
  ctx.fillStyle = '#8B7355';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`P<${mrzName}<<<${data.shareCode}<<<${mrzG}<<<AMATDA`, bl + 10, y + 18);

  y += 46;

  // ─── Powered by ───
  ctx.font = `10px ${F}`;
  ctx.fillStyle = '#B5A99A';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('Powered by A-matda', W / 2, y);

  // ═══ 카드 외곽 보더 (최상위) ═══
  ctx.strokeStyle = '#C4A882';
  ctx.lineWidth = 3;
  ctx.beginPath();
  roundedRect(ctx, cx, cy, cw, ch, 16);
  ctx.stroke();

  return canvas.toBuffer('image/png');
}
