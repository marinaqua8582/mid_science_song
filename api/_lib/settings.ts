import { AppSettings, RubricCriterion, StudentAccessStatus } from '../../src/types';
import { DEFAULT_RUBRICS } from '../../src/data/units';
import { requestGas } from './gas';

const DEFAULT_ACCESS_MESSAGE = '현재는 수행평가 활동 기간이 아닙니다. 선생님의 안내를 기다려 주세요.';

export const DEFAULT_APP_SETTINGS: AppSettings = {
  rubrics: DEFAULT_RUBRICS,
  studentAccessEnabled: true,
  accessStartAt: '',
  accessEndAt: '',
  accessMessage: DEFAULT_ACCESS_MESSAGE,
};

let cached: { settings: AppSettings; initialized: boolean; expiresAt: number } | null = null;

function cleanDateTime(value: unknown): string {
  const text = String(value || '').trim();
  if (!text) return '';
  return Number.isFinite(parseKoreanDateTime(text)) ? text.slice(0, 35) : '';
}

function normalizeRubrics(value: unknown): RubricCriterion[] {
  if (!Array.isArray(value)) return DEFAULT_RUBRICS;

  const rubrics = value.slice(0, 20).map((item, index) => ({
    id: String(item?.id || `rubric-${index + 1}`).trim().slice(0, 80),
    title: String(item?.title || '').trim().slice(0, 200),
    description: String(item?.description || '').trim().slice(0, 2000),
    maxPoints: Math.min(100, Math.max(1, Number(item?.maxPoints) || 1)),
  })).filter(item => item.title);

  return rubrics.length > 0 ? rubrics : DEFAULT_RUBRICS;
}

export function normalizeSettings(value: any): AppSettings {
  return {
    rubrics: normalizeRubrics(value?.rubrics),
    studentAccessEnabled: typeof value?.studentAccessEnabled === 'boolean'
      ? value.studentAccessEnabled
      : true,
    accessStartAt: cleanDateTime(value?.accessStartAt),
    accessEndAt: cleanDateTime(value?.accessEndAt),
    accessMessage: String(value?.accessMessage || DEFAULT_ACCESS_MESSAGE).trim().slice(0, 300) || DEFAULT_ACCESS_MESSAGE,
  };
}

export function parseKoreanDateTime(value: string): number {
  const text = String(value || '').trim();
  if (!text) return Number.NaN;
  const hasTimeZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(text);
  if (hasTimeZone) return Date.parse(text);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(text)) {
    return Date.parse(`${text}:00+09:00`);
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(text)) {
    return Date.parse(`${text}+09:00`);
  }
  return Number.NaN;
}

export async function readSettings(force = false): Promise<{ settings: AppSettings; initialized: boolean }> {
  if (!force && cached && cached.expiresAt > Date.now()) {
    return { settings: cached.settings, initialized: cached.initialized };
  }

  const response = await requestGas('getSettings', { method: 'POST' });
  const initialized = response?.found === true && response?.settings && typeof response.settings === 'object';
  const settings = normalizeSettings(initialized ? response.settings : DEFAULT_APP_SETTINGS);
  cached = { settings, initialized, expiresAt: Date.now() + 15_000 };
  return { settings, initialized };
}

export async function writeSettings(value: unknown): Promise<AppSettings> {
  const settings = normalizeSettings(value);
  if (settings.accessStartAt && settings.accessEndAt) {
    const start = parseKoreanDateTime(settings.accessStartAt);
    const end = parseKoreanDateTime(settings.accessEndAt);
    if (start >= end) {
      throw new Error('접속 종료 일시는 시작 일시보다 뒤여야 합니다.');
    }
  }

  await requestGas('saveSettings', { method: 'POST', payload: { settings } });
  cached = { settings, initialized: true, expiresAt: Date.now() + 15_000 };
  return settings;
}

export function evaluateStudentAccess(settings: AppSettings, now = Date.now()): StudentAccessStatus {
  let reason: StudentAccessStatus['reason'] = 'open';
  const start = settings.accessStartAt ? parseKoreanDateTime(settings.accessStartAt) : Number.NaN;
  const end = settings.accessEndAt ? parseKoreanDateTime(settings.accessEndAt) : Number.NaN;

  if (!settings.studentAccessEnabled) reason = 'disabled';
  else if (Number.isFinite(start) && now < start) reason = 'before_start';
  else if (Number.isFinite(end) && now > end) reason = 'after_end';

  return {
    isOpen: reason === 'open',
    reason,
    startAt: settings.accessStartAt,
    endAt: settings.accessEndAt,
    message: reason === 'open' ? '' : settings.accessMessage,
    checkedAt: new Date(now).toISOString(),
  };
}

export async function requireStudentAccess(): Promise<StudentAccessStatus> {
  const { settings } = await readSettings();
  return evaluateStudentAccess(settings);
}
