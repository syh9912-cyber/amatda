/**
 * 기질 분석 풀 리포트 HTML 생성기 (analysis-detail.tsx 공유용 PDF).
 *
 * 화면 캡쳐 대신 HTML→PDF 변환 방식 사용 — react-native-view-shot 의
 * snapshotContentContainer 가 KeyboardAvoidingView+ScrollView 조합에서 콘텐츠 일부만
 * 캡쳐하는 이슈가 있어 PDF 가 안정적.
 *
 * 디자인: Editorial Magazine Dark 풍 — trait-detail 표지와 통일된 톤.
 */
import type { AnalysisReport } from '../stores/childStore';

function escapeHtml(str: string | null | undefined): string {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function listSection(title: string, items: readonly string[] | undefined, accent = '#E6A878'): string {
  if (!items || items.length === 0) return '';
  const lis = items
    .filter((s) => typeof s === 'string' && s.trim())
    .map((s) => `<li>${escapeHtml(s)}</li>`)
    .join('');
  if (!lis) return '';
  return `
    <section class="card">
      <h3 style="color:${accent}">${escapeHtml(title)}</h3>
      <ul class="bullet-list">${lis}</ul>
    </section>`;
}

function detailListSection(
  title: string,
  items: { item: string; reason: string }[] | undefined,
  accent = '#E6A878',
): string {
  if (!items || items.length === 0) return '';
  const rows = items
    .filter((d) => d && typeof d.item === 'string')
    .map(
      (d) => `
        <li>
          <div class="detail-item">${escapeHtml(d.item)}</div>
          ${d.reason ? `<div class="detail-reason">${escapeHtml(d.reason)}</div>` : ''}
        </li>`,
    )
    .join('');
  if (!rows) return '';
  return `
    <section class="card">
      <h3 style="color:${accent}">${escapeHtml(title)}</h3>
      <ul class="detail-list">${rows}</ul>
    </section>`;
}

function paragraphSection(title: string, body: string | undefined, accent = '#E6A878'): string {
  if (!body || !body.trim()) return '';
  return `
    <section class="card">
      <h3 style="color:${accent}">${escapeHtml(title)}</h3>
      <p class="paragraph">${escapeHtml(body)}</p>
    </section>`;
}

interface BuildArgs {
  childName: string;
  ageMonths: number;
  analysisDate: string;
  dominantType: string;
  label: string;
  fiveElements: { wood?: number; fire?: number; earth?: number; metal?: number; water?: number } | null;
  report: AnalysisReport | null | undefined;
}

type FiveKey = 'wood' | 'fire' | 'earth' | 'metal' | 'water';
const TRAIT_LABELS: Array<{ key: FiveKey; label: string }> = [
  { key: 'wood', label: '탐구' },
  { key: 'fire', label: '활동' },
  { key: 'earth', label: '안정' },
  { key: 'metal', label: '결단' },
  { key: 'water', label: '지혜' },
];

const TYPE_ARCHETYPE: Record<string, string> = {
  탐구형: '탐구형 활동가',
  활동형: '활동형 도전자',
  조화형: '안정형 협력가',
  분석형: '지혜형 연구가',
  감성형: '감성형 공감가',
};

const TYPE_PRIMARY: Record<string, string> = {
  탐구형: '탐구',
  활동형: '활동',
  조화형: '안정',
  분석형: '결단',
  감성형: '지혜',
};

const TYPE_DESC: Record<string, string> = {
  탐구형: '호기심이 많고 새 것을 좋아해요\n손으로 만지며 배우는 걸 즐겨요\n자극이 풍부할 때 가장 빛나요',
  활동형: '몸으로 움직일 때 즐거워요\n달리고 뛰는 활동을 좋아해요\n직접 해봐야 만족하는 아이예요',
  조화형: '익숙한 사람·환경에서 편해요\n친구·가족과 어울려 잘 놀아요\n다정하고 협력적인 아이예요',
  분석형: '규칙·순서를 잘 지켜요\n관찰하며 차근차근 익혀요\n반복과 정리를 즐겨요',
  감성형: '주변 분위기를 잘 알아채요\n다른 사람 마음에 공감해요\n섬세하고 표현이 풍부해요',
};

function ageLabel(months: number): string {
  if (months <= 0) return '신생아';
  if (months < 12) return `${months}개월`;
  const yrs = Math.floor(months / 12);
  const rem = months % 12;
  return rem === 0 ? `${yrs}세` : `${yrs}세 ${rem}개월`;
}

export function buildFullReportHtml({
  childName,
  ageMonths,
  analysisDate,
  dominantType,
  label,
  fiveElements,
  report,
}: BuildArgs): string {
  const r = report ?? null;
  const archetype = TYPE_ARCHETYPE[dominantType] || label || dominantType;
  const primary = TYPE_PRIMARY[dominantType] || '균형';
  const desc = TYPE_DESC[dominantType] || '아이만의 고유한 기질이에요.';

  const stats = fiveElements
    ? TRAIT_LABELS.map((t) => {
        const v = fiveElements[t.key];
        const num = typeof v === 'number' ? Math.round(Math.max(0, Math.min(100, v))) : 0;
        return `<div class="stat"><div class="stat-label">${escapeHtml(t.label)}</div><div class="stat-value">${num}</div></div>`;
      }).join('')
    : '';

  const summaryHtml = r?.summary
    ? `<section class="cover-summary"><p>${escapeHtml(r.summary)}</p></section>`
    : '';

  const personalityHtml = r?.personality?.length
    ? listSection('🎭 성격 특성', r.personality, '#FFB088')
    : '';
  const strengthsHtml = detailListSection('💪 강점', r?.strengthsDetail, '#7DD3A3');
  const weaknessesHtml = detailListSection('⚠️ 주의할 점', r?.weaknessesDetail, '#F4A4A4');
  const studyHtml = paragraphSection('📚 학습 스타일', r?.studyStyle, '#A8C8FF');
  const subjectsHtml = listSection('⭐ 잘 맞는 과목', r?.bestSubjects, '#A8C8FF');
  const weakAreasHtml = listSection('💡 보완할 영역', r?.weakAreas, '#A8C8FF');
  const academyHtml = paragraphSection('🏫 학원 추천 스타일', r?.academyStyle, '#A8C8FF');
  const educationHtml = paragraphSection('🎓 교육 방향', r?.educationDirection, '#A8C8FF');
  const futureHtml = listSection('🚀 어울리는 미래 직업', r?.futureFields, '#FFD37A');
  const sportsHtml = listSection('🏃 추천 운동', r?.sportsMatch, '#FFD37A');
  const goodFoodsHtml = listSection('🥗 잘 맞는 음식', r?.goodFoods, '#7DD3A3');
  const badFoodsHtml = listSection('🚫 피할 음식', r?.badFoods, '#F4A4A4');
  const talentHtml = paragraphSection('🏆 특별한 재능', r?.specialTalent, '#FFD37A');
  const parentingHtml = paragraphSection('🤱 양육 팁', r?.parentingTip, '#FFB088');
  const routineHtml = paragraphSection('☀️ 일상 루틴 팁', r?.dailyRoutineTip, '#FFB088');
  const socialHtml = paragraphSection('🤝 사회성 팁', r?.socialTip, '#FFB088');
  const emotionalHtml = paragraphSection('💖 감정 팁', r?.emotionalTip, '#FFB088');
  const doHtml = listSection('✅ 추천 (Do)', r?.doList, '#7DD3A3');
  const dontHtml = listSection("❌ 비추천 (Don't)", r?.dontList, '#F4A4A4');

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(childName)}의 기질 분석 리포트</title>
<style>
  @page { size: A4; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  body {
    font-family: 'Pretendard', -apple-system, 'Apple SD Gothic Neo', system-ui, sans-serif;
    background: #0A0504;
    color: #F2E6D8;
    margin: 0;
    line-height: 1.6;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .cover {
    text-align: center;
    padding: 24px 14px 28px;
    border-bottom: 1px solid #2A1A14;
    margin-bottom: 18px;
    background: #1F0F08;
  }
  .cover-meta {
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    letter-spacing: 3px;
    color: #C9A88A;
    margin-bottom: 14px;
  }
  .cover-vol {
    font-size: 13px;
    font-weight: 900;
    letter-spacing: 2px;
    color: #FFD2A8;
    text-align: left;
  }
  .cover-subject {
    font-size: 11px;
    color: #E0C8B8;
    text-align: left;
    margin-bottom: 18px;
  }
  .cover-primary {
    font-size: 12px;
    font-weight: 900;
    letter-spacing: 4px;
    color: #FFB088;
    margin-top: 16px;
  }
  .cover-title {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 32px;
    font-weight: 800;
    color: #FFFFFF;
    margin: 6px 0 14px;
    letter-spacing: -0.5px;
  }
  .cover-desc {
    font-size: 12px;
    color: #E0C8B8;
    line-height: 1.7;
    white-space: pre-line;
    margin-bottom: 20px;
  }
  .stats-row {
    display: flex;
    gap: 4px;
    justify-content: space-between;
  }
  .stat {
    flex: 1;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,210,168,0.18);
    border-radius: 10px;
    padding: 8px 0;
  }
  .stat-label {
    font-size: 10px;
    color: #D9C5B5;
    margin-bottom: 2px;
  }
  .stat-value {
    font-size: 16px;
    font-weight: 900;
    color: #FFFFFF;
  }
  .cover-date {
    font-size: 9px;
    color: #9A7A5A;
    letter-spacing: 2px;
    margin-top: 16px;
  }
  .cover-summary {
    margin: 14px 6px;
    padding: 14px 16px;
    background: #16100B;
    border-left: 3px solid #E6A878;
    border-radius: 4px;
  }
  .cover-summary p {
    font-size: 12px;
    color: #DCC6B0;
    margin: 0;
    line-height: 1.7;
  }
  .card {
    background: #160E0A;
    border: 1px solid #2A1A14;
    border-radius: 6px;
    padding: 14px 16px;
    margin: 10px 6px;
    page-break-inside: avoid;
  }
  h3 {
    font-size: 14px;
    font-weight: 700;
    margin: 0 0 8px;
  }
  .paragraph {
    font-size: 12px;
    color: #DCC6B0;
    margin: 0;
    line-height: 1.7;
  }
  .bullet-list {
    margin: 0;
    padding-left: 18px;
    color: #DCC6B0;
    font-size: 12px;
    line-height: 1.8;
  }
  .bullet-list li { margin-bottom: 2px; }
  .detail-list {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .detail-list li {
    padding: 8px 0;
    border-bottom: 1px solid #2A1A14;
  }
  .detail-list li:last-child { border-bottom: none; }
  .detail-item {
    font-size: 12px;
    font-weight: 700;
    color: #FFFFFF;
    margin-bottom: 3px;
  }
  .detail-reason {
    font-size: 11px;
    color: #B89A82;
    line-height: 1.6;
  }
  .footer {
    text-align: center;
    margin-top: 22px;
    padding: 14px;
    color: #9A7A5A;
    font-size: 10px;
    letter-spacing: 2px;
    border-top: 1px solid #2A1A14;
  }
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0;
  }
</style>
</head>
<body>
  <div class="cover">
    <div class="cover-meta">
      <span>INNATE TEMPERAMENT REPORT</span>
      <span>${escapeHtml(analysisDate)}</span>
    </div>
    <div class="cover-vol">VOL. 01</div>
    <div class="cover-subject">${escapeHtml(childName)} · ${escapeHtml(ageLabel(ageMonths))}</div>
    <div class="cover-primary">주성향 · ${escapeHtml(primary)}</div>
    <div class="cover-title">${escapeHtml(archetype)}</div>
    <div class="cover-desc">${escapeHtml(desc)}</div>
    ${stats ? `<div class="stats-row">${stats}</div>` : ''}
  </div>

  ${summaryHtml}
  ${personalityHtml}

  <div class="grid">
    ${strengthsHtml}
    ${weaknessesHtml}
  </div>

  ${studyHtml}
  ${subjectsHtml}
  ${weakAreasHtml}
  ${academyHtml}
  ${educationHtml}

  ${futureHtml}
  ${sportsHtml}

  <div class="grid">
    ${goodFoodsHtml}
    ${badFoodsHtml}
  </div>

  ${talentHtml}
  ${parentingHtml}
  ${routineHtml}
  ${socialHtml}
  ${emotionalHtml}

  <div class="grid">
    ${doHtml}
    ${dontHtml}
  </div>

  <div class="footer">— 아맞다 앱에서 분석 · ${escapeHtml(analysisDate)}</div>
</body>
</html>`;
}
