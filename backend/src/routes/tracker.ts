import { Router, Request, Response } from 'express';
import Busboy from 'busboy';
import * as XLSX from 'xlsx';
import { authMiddleware } from '../middleware/auth';
import { success, error } from '../utils/response';
import { callGeminiJSON, isGeminiAvailable } from '../services/coaching/gemini.client';
import { logger } from '../utils/logger';

const router = Router();

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type RecordType = 'diaper' | 'feeding' | 'sleep';

interface ParsedRecord {
  type: RecordType;
  subType: string;
  time?: string;
  amount?: number;
  duration?: number;
  note?: string;
  childName?: string;
}

interface ImportedRecord {
  id: string;
  type: RecordType;
  subType: string;
  date: string;
  time: string;
  endTime?: string;
  amount?: number;
  duration?: number;
  note?: string;
}

/* ------------------------------------------------------------------ */
/* POST /voice-parse — 한국어 음성 텍스트 → TrackerRecord JSON          */
/* ------------------------------------------------------------------ */

router.post('/voice-parse', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { text } = req.body as { text?: string };

    if (!text || typeof text !== 'string' || text.trim().length < 2) {
      return error(res, '텍스트를 입력해주세요');
    }

    if (!isGeminiAvailable()) {
      return error(res, 'AI 서비스를 사용할 수 없습니다');
    }

    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const systemPrompt = `너는 한국어 육아 기록 파서야. 부모가 말한 문장을 분석해서 아기 활동 기록 JSON으로 변환해.

반드시 아래 규칙을 따라:

## type과 subType 매핑
- 배변: type="diaper"
  - 소변/쉬/쉬했어: subType="pee"
  - 대변/똥/응가: subType="poop"
  - 소변+대변/둘다: subType="both"
- 수유/식사: type="feeding"
  - 모유/젖/수유: subType="breast"
  - 분유: subType="formula"
  - 이유식/밥/식사/먹었어/밥먹었어: subType="baby_food"
  - 간식: subType="snack"
- 수면: type="sleep"
  - 낮잠: subType="nap"
  - 밤잠/잠/잤어: subType="night"

## 시간 파싱
- "방금" = 현재 시각 (${currentTime})
- "30분 전" = 현재에서 30분 뺀 시각
- "1시에" = "01:00" 또는 "13:00" (문맥으로 판단)
- 시간 언급 없으면 time은 null

## 양(amount) 파싱 (ml 단위)
- "120ml" → amount: 120
- 양 언급 없으면 amount는 null

## 시간(duration) 파싱 (분 단위)
- "30분" → duration: 30
- "1시간" → duration: 60
- 시간 언급 없으면 duration은 null

## 아이 이름
- 문장에 아이 이름이 있으면 childName에 추출

## 응답 형식
반드시 JSON만 응답. 설명 금지.
{ "type": "...", "subType": "...", "time": "HH:MM" 또는 null, "amount": 숫자 또는 null, "duration": 숫자 또는 null, "note": "추가 메모" 또는 null, "childName": "이름" 또는 null }`;

    const parsed = await callGeminiJSON<ParsedRecord>(
      `다음 문장을 육아 기록 JSON으로 변환해: "${text.trim()}"`,
      {
        systemPrompt,
        temperature: 0.1,
        maxTokens: 200,
      },
    );

    // Validate required fields
    const validTypes = ['diaper', 'feeding', 'sleep'];
    const validSubTypes: Record<string, string[]> = {
      diaper: ['pee', 'poop', 'both'],
      feeding: ['breast', 'formula', 'baby_food', 'snack'],
      sleep: ['nap', 'night'],
    };

    if (!parsed.type || !validTypes.includes(parsed.type)) {
      return error(res, '기록 유형을 파악할 수 없습니다. 좀 더 구체적으로 말해주세요.');
    }

    if (!parsed.subType || !validSubTypes[parsed.type]?.includes(parsed.subType)) {
      // Fallback: assign first subType for the type
      parsed.subType = validSubTypes[parsed.type][0];
    }

    // Default time to now if not parsed
    if (!parsed.time) {
      parsed.time = currentTime;
    }

    return success(res, parsed);
  } catch (err) {
    logger.error('tracker/voice-parse', err);
    return error(res, '음성 텍스트 분석에 실패했습니다');
  }
});

/* ------------------------------------------------------------------ */
/* POST /import — BabyTime 엑셀 파일 가져오기                           */
/* ------------------------------------------------------------------ */

/** BabyTime 카테고리 → 우리 type/subType 매핑 */
const CATEGORY_MAP: Record<string, { type: RecordType; subType: string }> = {
  // 수유 관련
  '모유': { type: 'feeding', subType: 'breast' },
  '모유 수유': { type: 'feeding', subType: 'breast' },
  '왼쪽 수유': { type: 'feeding', subType: 'breast' },
  '오른쪽 수유': { type: 'feeding', subType: 'breast' },
  '양쪽 수유': { type: 'feeding', subType: 'breast' },
  '분유': { type: 'feeding', subType: 'formula' },
  '젖병': { type: 'feeding', subType: 'formula' },
  '유축': { type: 'feeding', subType: 'breast' },
  '이유식': { type: 'feeding', subType: 'baby_food' },
  '식사': { type: 'feeding', subType: 'baby_food' },
  '간식': { type: 'feeding', subType: 'snack' },
  '수유': { type: 'feeding', subType: 'breast' },
  'Breast': { type: 'feeding', subType: 'breast' },
  'Bottle': { type: 'feeding', subType: 'formula' },
  'Formula': { type: 'feeding', subType: 'formula' },
  'Baby food': { type: 'feeding', subType: 'baby_food' },
  'Snack': { type: 'feeding', subType: 'snack' },
  'Pumping': { type: 'feeding', subType: 'breast' },
  // 배변 관련
  '기저귀': { type: 'diaper', subType: 'both' },
  '소변': { type: 'diaper', subType: 'pee' },
  '대변': { type: 'diaper', subType: 'poop' },
  '소변+대변': { type: 'diaper', subType: 'both' },
  '배변': { type: 'diaper', subType: 'poop' },
  'Diaper': { type: 'diaper', subType: 'both' },
  'Pee': { type: 'diaper', subType: 'pee' },
  'Poop': { type: 'diaper', subType: 'poop' },
  'Both': { type: 'diaper', subType: 'both' },
  // 수면 관련
  '수면': { type: 'sleep', subType: 'night' },
  '낮잠': { type: 'sleep', subType: 'nap' },
  '밤잠': { type: 'sleep', subType: 'night' },
  '잠': { type: 'sleep', subType: 'night' },
  'Sleep': { type: 'sleep', subType: 'night' },
  'Nap': { type: 'sleep', subType: 'nap' },
};

/** 배변 상세 → subType 매핑 */
const DIAPER_DETAIL_MAP: Record<string, string> = {
  '소변': 'pee', '쉬': 'pee', 'pee': 'pee', 'wet': 'pee',
  '대변': 'poop', '똥': 'poop', 'poop': 'poop', 'dirty': 'poop',
  '소변+대변': 'both', '둘다': 'both', 'both': 'both', 'mixed': 'both',
};

/** 엑셀 날짜 → YYYY-MM-DD 문자열 */
function parseExcelDate(val: unknown): string | null {
  if (val == null) return null;
  // 숫자 (엑셀 serial date)
  if (typeof val === 'number') {
    const d = XLSX.SSF.parse_date_code(val);
    if (d) {
      return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
    }
  }
  const s = String(val).trim();
  // YYYY-MM-DD
  const isoMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
  // YYYY/MM/DD
  const slashMatch = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (slashMatch) return `${slashMatch[1]}-${slashMatch[2].padStart(2, '0')}-${slashMatch[3].padStart(2, '0')}`;
  // MM/DD/YYYY
  const usMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (usMatch) return `${usMatch[3]}-${usMatch[1].padStart(2, '0')}-${usMatch[2].padStart(2, '0')}`;
  // Date object
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
  }
  return null;
}

/** 엑셀 시간 → HH:MM 문자열 */
function parseExcelTime(val: unknown): string {
  if (val == null) return '00:00';
  if (typeof val === 'number') {
    // 엑셀 시간은 0~1 사이 소수 (0.5 = 12:00)
    const totalMinutes = Math.round(val * 24 * 60);
    const h = Math.floor(totalMinutes / 60) % 24;
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  const s = String(val).trim();
  // HH:MM or HH:MM:SS
  const timeMatch = s.match(/(\d{1,2}):(\d{2})/);
  if (timeMatch) return `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
  // 오전/오후 포맷
  const ampmMatch = s.match(/(오전|오후|AM|PM)\s*(\d{1,2}):(\d{2})/i);
  if (ampmMatch) {
    let h = parseInt(ampmMatch[2], 10);
    const isPM = ampmMatch[1] === '오후' || ampmMatch[1].toUpperCase() === 'PM';
    if (isPM && h < 12) h += 12;
    if (!isPM && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${ampmMatch[3]}`;
  }
  return '00:00';
}

/** 양(ml) 파싱 */
function parseAmount(val: unknown): number | undefined {
  if (val == null) return undefined;
  if (typeof val === 'number') return val > 0 ? val : undefined;
  const s = String(val).trim();
  const numMatch = s.match(/(\d+(\.\d+)?)/);
  if (numMatch) {
    const n = parseFloat(numMatch[1]);
    return n > 0 ? n : undefined;
  }
  return undefined;
}

/** 시간(분) 파싱 */
function parseDuration(val: unknown): number | undefined {
  if (val == null) return undefined;
  if (typeof val === 'number') {
    // 엑셀 시간 소수 (0.5 = 12시간 = 720분)
    if (val < 1 && val > 0) return Math.round(val * 24 * 60);
    return val > 0 ? Math.round(val) : undefined;
  }
  const s = String(val).trim();
  // "1시간 30분" or "1h 30m"
  const hMatch = s.match(/(\d+)\s*(시간|h)/i);
  const mMatch = s.match(/(\d+)\s*(분|m)/i);
  let total = 0;
  if (hMatch) total += parseInt(hMatch[1], 10) * 60;
  if (mMatch) total += parseInt(mMatch[1], 10);
  if (total > 0) return total;
  // 숫자만
  const numMatch = s.match(/^(\d+)$/);
  if (numMatch) return parseInt(numMatch[1], 10);
  return undefined;
}

/** 헤더 이름을 정규화 (공백/특수문자 제거, 소문자) */
function normalizeHeader(h: string): string {
  return h.replace(/[\s\r\n]+/g, '').toLowerCase();
}

/** BabyTime 엑셀 열 이름 매칭 패턴 */
const COL_PATTERNS = {
  category: ['카테고리', '활동', '종류', '유형', '구분', 'category', 'type', 'activity'],
  detail: ['상세', '세부', '타입', '내용', 'detail', 'subtype', 'details', '세부사항'],
  date: ['날짜', '일자', '일시', 'date', '시작날짜', '시작일'],
  startTime: ['시작시간', '시작', '시간', 'start', 'starttime', 'time', '시작시각'],
  endTime: ['종료시간', '종료', '끝', 'end', 'endtime', '종료시각'],
  amount: ['양', '용량', 'ml', 'amount', 'volume', '수유량'],
  duration: ['시간', '기간', '소요시간', 'duration', '수면시간', '총시간'],
  note: ['메모', '비고', '노트', 'note', 'memo', 'notes', '기타'],
};

function findColumn(headers: string[], patterns: string[]): number {
  for (const p of patterns) {
    const idx = headers.findIndex((h) => normalizeHeader(h).includes(p));
    if (idx >= 0) return idx;
  }
  return -1;
}

router.post('/import', authMiddleware, (req: Request, res: Response) => {
  const chunks: Buffer[] = [];
  let fileFound = false;

  const busboy = Busboy({
    headers: req.headers,
    limits: { fileSize: 10 * 1024 * 1024 },
  });

  busboy.on('file', (_fieldname: string, stream: NodeJS.ReadableStream) => {
    fileFound = true;
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
  });

  busboy.on('finish', () => {
    if (!fileFound || chunks.length === 0) {
      return error(res, '엑셀 파일을 업로드해주세요');
    }

    try {
      const buffer = Buffer.concat(chunks);
      const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });

      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        return error(res, '엑셀 파일에 시트가 없습니다');
      }

      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });

      if (rows.length === 0) {
        return error(res, '엑셀 파일에 데이터가 없습니다');
      }

      // 헤더 추출
      const headers = Object.keys(rows[0]);

      // 열 매핑
      const colIdx = {
        category: findColumn(headers, COL_PATTERNS.category),
        detail: findColumn(headers, COL_PATTERNS.detail),
        date: findColumn(headers, COL_PATTERNS.date),
        startTime: findColumn(headers, COL_PATTERNS.startTime),
        endTime: findColumn(headers, COL_PATTERNS.endTime),
        amount: findColumn(headers, COL_PATTERNS.amount),
        duration: findColumn(headers, COL_PATTERNS.duration),
        note: findColumn(headers, COL_PATTERNS.note),
      };

      if (colIdx.category < 0) {
        return error(res, `카테고리/활동 열을 찾을 수 없습니다. 인식된 열: ${headers.join(', ')}`);
      }

      const records: ImportedRecord[] = [];
      let skipped = 0;

      for (const row of rows) {
        const categoryRaw = String(row[headers[colIdx.category]] ?? '').trim();
        if (!categoryRaw) { skipped++; continue; }

        // 카테고리 매핑
        const mapped = CATEGORY_MAP[categoryRaw];
        if (!mapped) { skipped++; continue; }

        let { type, subType } = mapped;

        // 상세 열로 subType 보강
        if (colIdx.detail >= 0) {
          const detail = String(row[headers[colIdx.detail]] ?? '').trim();
          if (detail && type === 'diaper' && DIAPER_DETAIL_MAP[detail]) {
            subType = DIAPER_DETAIL_MAP[detail];
          }
          // 수면 상세
          if (type === 'sleep') {
            const dl = detail.toLowerCase();
            if (dl.includes('낮잠') || dl.includes('nap')) subType = 'nap';
            else if (dl.includes('밤잠') || dl.includes('night')) subType = 'night';
          }
        }

        // 날짜 파싱
        const dateVal = colIdx.date >= 0 ? row[headers[colIdx.date]] : null;
        const dateStr = parseExcelDate(dateVal);
        if (!dateStr) { skipped++; continue; }

        // 시간 파싱
        const startTimeVal = colIdx.startTime >= 0 ? row[headers[colIdx.startTime]] : null;
        const time = parseExcelTime(startTimeVal);

        const endTimeVal = colIdx.endTime >= 0 ? row[headers[colIdx.endTime]] : null;
        const endTime = endTimeVal ? parseExcelTime(endTimeVal) : undefined;

        // 양 파싱
        const amountVal = colIdx.amount >= 0 ? row[headers[colIdx.amount]] : null;
        const amount = parseAmount(amountVal);

        // 시간 파싱
        let duration = colIdx.duration >= 0 ? parseDuration(row[headers[colIdx.duration]]) : undefined;
        // endTime이 있으면 duration 계산
        if (!duration && endTime && time) {
          const [sh, sm] = time.split(':').map(Number);
          const [eh, em] = endTime.split(':').map(Number);
          let diff = (eh * 60 + em) - (sh * 60 + sm);
          if (diff < 0) diff += 24 * 60;
          if (diff > 0) duration = diff;
        }

        // 메모
        const noteVal = colIdx.note >= 0 ? row[headers[colIdx.note]] : null;
        const note = noteVal ? String(noteVal).trim() : undefined;

        const id = `import_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

        records.push({
          id,
          type,
          subType,
          date: dateStr,
          time,
          ...(endTime ? { endTime } : {}),
          ...(amount != null ? { amount } : {}),
          ...(duration != null ? { duration } : {}),
          ...(note && note !== 'null' ? { note } : {}),
        });
      }

      // 날짜별로 그룹핑
      const byDate: Record<string, ImportedRecord[]> = {};
      for (const r of records) {
        if (!byDate[r.date]) byDate[r.date] = [];
        byDate[r.date].push(r);
      }

      return success(res, {
        totalRows: rows.length,
        imported: records.length,
        skipped,
        dates: Object.keys(byDate).sort(),
        records: byDate,
        columns: headers,
      });
    } catch (err) {
      logger.error('tracker/excel-import', err);
      return error(res, '엑셀 파일 처리에 실패했습니다. BabyTime에서 내보낸 파일인지 확인해주세요.');
    }
  });

  // Cloud Functions에서는 rawBody 사용
  const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody;
  if (rawBody) {
    busboy.end(rawBody);
  } else {
    req.pipe(busboy);
  }
});

export default router;
