/**
 * Time/formatting helpers for baby-tracker.
 * Pure functions — no side effects, no React dependencies (t 파라미터로만 i18n 연결).
 */
import type { TFunction } from 'i18next';

export function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export function formatDateKorean(date: Date, t: TFunction): string {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const dayName = t(`common.time.dayShort.${DAY_KEYS[date.getDay()]}`);
  return t('common.time.dateWithDay', { month: m, day: d, dayName });
}

export function isToday(date: Date): boolean {
  const now = new Date();
  return formatDate(date) === formatDate(now);
}

export function nowTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export function getRelativeTime(timeStr: string, dateStr: string, t: TFunction): string {
  const [h, m] = timeStr.split(':').map(Number);
  const rec = new Date(dateStr);
  rec.setHours(h, m, 0, 0);
  const diffMin = Math.round((Date.now() - rec.getTime()) / 60000);
  if (diffMin < 1) return t('common.time.justNow');
  if (diffMin < 60) return t('common.time.minutesAgo', { count: diffMin });
  const hrs = Math.floor(diffMin / 60);
  const mins = diffMin % 60;
  if (mins === 0) return t('common.time.hoursAgo', { count: hrs });
  return t('common.time.hoursMinutesAgo', { hours: hrs, minutes: mins });
}

export function calcDurationMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let diff = (eh * 60 + em) - (sh * 60 + sm);
  if (diff < 0) diff += 24 * 60;
  return diff;
}

export function formatMinutes(m: number, t: TFunction): string {
  const hours = Math.floor(m / 60);
  const mins = m % 60;
  if (hours === 0) return t('common.time.minutes', { count: mins });
  if (mins === 0) return t('common.time.hours', { count: hours });
  return t('common.time.hoursMinutes', { hours, minutes: mins });
}
