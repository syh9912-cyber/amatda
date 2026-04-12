import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Child } from '../stores/childStore';
import { childApi, coachingApi, observationApi } from './api';

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
  // Gather data
  const [trackingRes, historyRes, observationsRes] = await Promise.allSettled([
    childApi.getDailyTracking(child.id, 30),
    coachingApi.history(child.id),
    observationApi.list(child.id),
  ]);

  const tracking = trackingRes.status === 'fulfilled'
    ? (trackingRes.value.data?.data as Record<string, unknown>[] ?? [])
    : [];
  const sessions = historyRes.status === 'fulfilled'
    ? (historyRes.value.data?.data as Record<string, unknown>[] ?? [])
    : [];
  const observations = observationsRes.status === 'fulfilled'
    ? (observationsRes.value.data?.data as Record<string, unknown>[] ?? [])
    : [];

  const today = new Date().toLocaleDateString('ko-KR');

  // Build HTML
  let html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: -apple-system, sans-serif; padding: 24px; color: #2D2016; font-size: 13px; }
  h1 { color: #FF8C5A; font-size: 22px; border-bottom: 2px solid #FF8C5A; padding-bottom: 8px; }
  h2 { color: #2D2016; font-size: 16px; margin-top: 24px; border-left: 4px solid #FF8C5A; padding-left: 8px; }
  .meta { color: #8C7A6B; font-size: 12px; margin-bottom: 16px; }
  .card { background: #FFF5EC; border-radius: 8px; padding: 12px; margin-bottom: 8px; }
  .label { font-weight: 600; color: #FF8C5A; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { border: 1px solid #E8DDD0; padding: 6px 8px; text-align: left; font-size: 12px; }
  th { background: #FFF5EC; font-weight: 600; }
  .footer { margin-top: 32px; text-align: center; color: #B5A99A; font-size: 11px; }
</style>
</head>
<body>
  <h1>${escapeHtml(child.name)}의 성장 기록</h1>
  <div class="meta">
    출력일: ${today} | 나이: ${getAgeText(child.ageInfo.months)} | 기질: ${escapeHtml(child.innateData?.label ?? '')}
  </div>

  <h2>기본 정보</h2>
  <div class="card">
    <p><span class="label">이름:</span> ${escapeHtml(child.name)}</p>
    <p><span class="label">생년월일:</span> ${child.birthDate ?? '-'}</p>
    <p><span class="label">성별:</span> ${child.gender === 'M' ? '남아' : '여아'}</p>
    <p><span class="label">기질:</span> ${escapeHtml(child.innateData?.label ?? '-')}</p>
  </div>`;

  // Tracking data
  if (tracking.length > 0) {
    html += `
  <h2>육아 기록 (최근 30일)</h2>
  <table>
    <tr><th>날짜</th><th>수면</th><th>식사</th><th>배변</th><th>컨디션</th></tr>`;
    for (const t of tracking.slice(0, 30)) {
      html += `
    <tr>
      <td>${escapeHtml(String(t.date ?? '-'))}</td>
      <td>${escapeHtml(String(t.sleep ?? '-'))}</td>
      <td>${escapeHtml(String(t.meal ?? '-'))}</td>
      <td>${escapeHtml(String(t.poop ?? '-'))}</td>
      <td>${escapeHtml(String(t.condition ?? '-'))}</td>
    </tr>`;
    }
    html += '</table>';
  }

  // Coaching sessions
  if (sessions.length > 0) {
    html += `
  <h2>AI 상담 기록 (최근 10건)</h2>`;
    for (const s of sessions.slice(0, 10)) {
      const msg = String(s.message ?? '');
      const answer = String(s.answer ?? s.text ?? s.reply ?? '');
      const date = String(s.createdAt ?? '').slice(0, 10);
      html += `
  <div class="card">
    <p><span class="label">[${date}] 질문:</span> ${escapeHtml(msg)}</p>
    <p><span class="label">답변:</span> ${escapeHtml(answer.slice(0, 200))}${answer.length > 200 ? '...' : ''}</p>
  </div>`;
    }
  }

  // Observations
  if (observations.length > 0) {
    html += `
  <h2>관찰 일기 (최근 10건)</h2>`;
    for (const o of observations.slice(0, 10)) {
      const content = String(o.content ?? '');
      const date = String(o.createdAt ?? '').slice(0, 10);
      html += `
  <div class="card">
    <p><span class="label">[${date}]</span> ${escapeHtml(content.slice(0, 300))}</p>
  </div>`;
    }
  }

  html += `
  <div class="footer">
    <p>아맞다 (A-matda) | SY Labs | ${today}</p>
    <p>이 문서는 자동으로 생성되었습니다.</p>
  </div>
</body>
</html>`;

  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: `${child.name}의 성장 기록`,
    UTI: 'com.adobe.pdf',
  });
}
