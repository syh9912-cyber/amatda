/**
 * 기질 분석 풀 리포트 HTML 생성기 (analysis-detail.tsx 공유용 PDF).
 *
 * 화면 캡쳐 대신 HTML→PDF 변환 방식 사용 — react-native-view-shot 의
 * snapshotContentContainer 가 KeyboardAvoidingView+ScrollView 조합에서 콘텐츠 일부만
 * 캡쳐하는 이슈가 있어 PDF 가 안정적.
 *
 * 디자인: Editorial Magazine Dark 풍 — trait-detail 표지와 통일된 톤.
 */
import type { TFunction } from 'i18next';
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

function getTraitLabels(t: TFunction): Array<{ key: FiveKey; label: string }> {
  return [
    { key: 'wood', label: t('components.editorialCover.traitShort.wood') },
    { key: 'fire', label: t('components.editorialCover.traitShort.fire') },
    { key: 'earth', label: t('components.editorialCover.traitShort.earth') },
    { key: 'metal', label: t('components.editorialCover.traitShort.metal') },
    { key: 'water', label: t('components.editorialCover.traitShort.water') },
  ];
}

function getTypeArchetype(t: TFunction): Record<string, string> {
  return {
    탐구형: t('components.editorialCover.archetype.explorer'),
    활동형: t('components.editorialCover.archetype.active'),
    조화형: t('components.editorialCover.archetype.harmony'),
    분석형: t('components.editorialCover.archetype.analytic'),
    감성형: t('components.editorialCover.archetype.emotional'),
  };
}

function getTypePrimary(t: TFunction): Record<string, string> {
  return {
    탐구형: t('components.editorialCover.traitShort.wood'),
    활동형: t('components.editorialCover.traitShort.fire'),
    조화형: t('components.editorialCover.traitShort.earth'),
    분석형: t('components.editorialCover.traitShort.metal'),
    감성형: t('components.editorialCover.traitShort.water'),
  };
}

function getTypeDesc(t: TFunction): Record<string, string> {
  return {
    탐구형: t('components.editorialCover.typeDesc.explorer'),
    활동형: t('components.editorialCover.typeDesc.active'),
    조화형: t('components.editorialCover.typeDesc.harmony'),
    분석형: t('components.editorialCover.typeDesc.analytic'),
    감성형: t('components.editorialCover.typeDesc.emotional'),
  };
}

function ageLabel(t: TFunction, months: number): string {
  if (months <= 0) return t('components.editorialCover.newborn');
  if (months < 12) return t('components.profileCard.ageMonths', { count: months });
  const yrs = Math.floor(months / 12);
  const rem = months % 12;
  return rem === 0
    ? t('components.profileCard.ageYears', { years: yrs })
    : t('components.profileCard.ageYearsMonths', { years: yrs, months: rem });
}

export function buildFullReportHtml(
  t: TFunction,
  {
    childName,
    ageMonths,
    analysisDate,
    dominantType,
    label,
    fiveElements,
    report,
  }: BuildArgs,
): string {
  const r = report ?? null;
  const archetype = getTypeArchetype(t)[dominantType] || label || dominantType;
  const primary = getTypePrimary(t)[dominantType] || t('components.editorialCover.balanced');
  const desc = getTypeDesc(t)[dominantType] || t('components.editorialCover.defaultDesc');

  const traitLabels = getTraitLabels(t);
  const stats = fiveElements
    ? traitLabels.map((tr) => {
        const v = fiveElements[tr.key];
        const num = typeof v === 'number' ? Math.round(Math.max(0, Math.min(100, v))) : 0;
        return `<div class="stat"><div class="stat-label">${escapeHtml(tr.label)}</div><div class="stat-value">${num}</div></div>`;
      }).join('')
    : '';

  const summaryHtml = r?.summary
    ? `<section class="cover-summary"><p>${escapeHtml(r.summary)}</p></section>`
    : '';

  const personalityHtml = r?.personality?.length
    ? listSection(t('traitReportHtml.section.personality'), r.personality, '#FFB088')
    : '';
  const strengthsHtml = detailListSection(t('traitReportHtml.section.strengths'), r?.strengthsDetail, '#7DD3A3');
  const weaknessesHtml = detailListSection(t('traitReportHtml.section.weaknesses'), r?.weaknessesDetail, '#F4A4A4');
  const studyHtml = paragraphSection(t('traitReportHtml.section.studyStyle'), r?.studyStyle, '#A8C8FF');
  const subjectsHtml = listSection(t('traitReportHtml.section.bestSubjects'), r?.bestSubjects, '#A8C8FF');
  const weakAreasHtml = listSection(t('traitReportHtml.section.weakAreas'), r?.weakAreas, '#A8C8FF');
  const academyHtml = paragraphSection(t('traitReportHtml.section.academyStyle'), r?.academyStyle, '#A8C8FF');
  const educationHtml = paragraphSection(t('traitReportHtml.section.educationDirection'), r?.educationDirection, '#A8C8FF');
  const futureHtml = listSection(t('traitReportHtml.section.futureFields'), r?.futureFields, '#FFD37A');
  const sportsHtml = listSection(t('traitReportHtml.section.sportsMatch'), r?.sportsMatch, '#FFD37A');
  const goodFoodsHtml = listSection(t('traitReportHtml.section.goodFoods'), r?.goodFoods, '#7DD3A3');
  const badFoodsHtml = listSection(t('traitReportHtml.section.badFoods'), r?.badFoods, '#F4A4A4');
  const talentHtml = paragraphSection(t('traitReportHtml.section.specialTalent'), r?.specialTalent, '#FFD37A');
  const parentingHtml = paragraphSection(t('traitReportHtml.section.parentingTip'), r?.parentingTip, '#FFB088');
  const routineHtml = paragraphSection(t('traitReportHtml.section.dailyRoutineTip'), r?.dailyRoutineTip, '#FFB088');
  const socialHtml = paragraphSection(t('traitReportHtml.section.socialTip'), r?.socialTip, '#FFB088');
  const emotionalHtml = paragraphSection(t('traitReportHtml.section.emotionalTip'), r?.emotionalTip, '#FFB088');
  const doHtml = listSection(t('traitReportHtml.section.doList'), r?.doList, '#7DD3A3');
  const dontHtml = listSection(t('traitReportHtml.section.dontList'), r?.dontList, '#F4A4A4');

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(t('traitDetail.shareDialogTitle', { name: childName }))}</title>
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
    <div class="cover-subject">${escapeHtml(childName)} · ${escapeHtml(ageLabel(t, ageMonths))}</div>
    <div class="cover-primary">${escapeHtml(t('components.editorialCover.primaryLabel', { primary }))}</div>
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

  <div class="footer">${escapeHtml(t('traitReportHtml.footer', { date: analysisDate }))}</div>
</body>
</html>`;
}
