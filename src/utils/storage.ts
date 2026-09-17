import { AppSettings, StudentRosterItem, StudentSubmission } from '../types';
import { DEFAULT_ROSTER, DEFAULT_RUBRICS } from '../data/units';

const SETTINGS_KEY = 'science_song_app_settings';
const ROSTER_KEY = 'science_song_roster';
const SUBMISSIONS_KEY = 'science_song_submissions';

async function readApiJson(response: Response): Promise<any> {
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.status === 'error') {
    throw new Error(data?.message || data?.error || '서버 요청을 처리하지 못했습니다.');
  }
  return data;
}

function canonicalRosterId(item: Partial<StudentRosterItem>): string {
  const grade = Number(item.grade) || 2;
  const classNum = Number(item.classNum) || 0;
  const studentNum = Number(item.studentNum) || 0;
  const formattedNum = studentNum < 10 ? `0${studentNum}` : `${studentNum}`;
  return `${grade}-${classNum}-${formattedNum}`;
}

export const getDefaultSettings = (): AppSettings => ({
  rubrics: DEFAULT_RUBRICS,
  studentAccessEnabled: true,
  accessStartAt: '',
  accessEndAt: '',
  accessMessage: '현재는 수행평가 활동 기간이 아닙니다. 선생님의 안내를 기다려 주세요.',
});

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const defaults = getDefaultSettings();
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) || {};
    return {
      rubrics: Array.isArray(parsed.rubrics) && parsed.rubrics.length > 0
        ? parsed.rubrics
        : defaults.rubrics,
      studentAccessEnabled: typeof parsed.studentAccessEnabled === 'boolean'
        ? parsed.studentAccessEnabled
        : defaults.studentAccessEnabled,
      accessStartAt: typeof parsed.accessStartAt === 'string' ? parsed.accessStartAt : '',
      accessEndAt: typeof parsed.accessEndAt === 'string' ? parsed.accessEndAt : '',
      accessMessage: typeof parsed.accessMessage === 'string' && parsed.accessMessage.trim()
        ? parsed.accessMessage
        : defaults.accessMessage,
    };
  } catch (e) {
    console.error('Failed to load settings', e);
    return getDefaultSettings();
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    // 브라우저 저장소는 화면 복구용 캐시일 뿐이며 서버 설정의 원본으로 사용하지 않습니다.
    // 과거 버전의 teacherPin/gasUrl 값이 다시 저장되지 않도록 허용된 항목만 기록합니다.
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
      rubrics: settings.rubrics,
      studentAccessEnabled: settings.studentAccessEnabled,
      accessStartAt: settings.accessStartAt,
      accessEndAt: settings.accessEndAt,
      accessMessage: settings.accessMessage,
    }));
  } catch (e) {
    console.error('Failed to save settings', e);
  }
}

export function loadRoster(): StudentRosterItem[] {
  try {
    const raw = localStorage.getItem(ROSTER_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // If legacy sample data is detected (e.g. contains '강민준'), clear it
    if (parsed.some((item: any) => item?.name === '강민준')) {
      localStorage.removeItem(ROSTER_KEY);
      return [];
    }
    const seen = new Set<string>();
    const unique: StudentRosterItem[] = [];
    for (const item of parsed) {
      if (!item) continue;
      // 시트의 ID가 실수로 중복되어도 서로 다른 학년·반·번호 학생을 누락시키지 않습니다.
      const key = canonicalRosterId(item);
      if (!seen.has(key)) {
        seen.add(key);
        unique.push({
          id: key,
          grade: Number(item.grade),
          classNum: Number(item.classNum),
          studentNum: Number(item.studentNum),
          name: String(item.name || '')
        });
      }
    }
    return unique;
  } catch (e) {
    console.error('Failed to load roster', e);
    return [];
  }
}

export function saveRoster(roster: StudentRosterItem[]): void {
  try {
    localStorage.setItem(ROSTER_KEY, JSON.stringify(roster));
  } catch (e) {
    console.error('Failed to save roster', e);
  }
}

export function getInitialSampleSubmissions(): StudentSubmission[] {
  return [];
}

export function loadSubmissions(): StudentSubmission[] {
  try {
    const raw = localStorage.getItem(SUBMISSIONS_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.some((item: any) => item?.name === '강민준' || item?.id === 'sub-2-1-01')) {
      localStorage.removeItem(SUBMISSIONS_KEY);
      return [];
    }
    return parsed;
  } catch (e) {
    console.error('Failed to load submissions', e);
    return [];
  }
}

export function saveSubmissions(submissions: StudentSubmission[]): void {
  try {
    localStorage.setItem(SUBMISSIONS_KEY, JSON.stringify(submissions));
  } catch (e) {
    console.error('Failed to save submissions', e);
  }
}

export function parseGasSubmissionRows(rows: any[]): StudentSubmission[] {
  if (!Array.isArray(rows)) return [];

  if (rows.length === 0) return [];
  if (typeof rows[0] === 'object' && rows[0] !== null && !Array.isArray(rows[0])) {
    return rows
      .filter(item => item && item.classNum && item.studentNum && String(item.name || '').trim())
      .map(item => parseGasDataToSubmission(item));
  }

  const firstRow = Array.isArray(rows[0]) ? rows[0].map(value => String(value || '').trim()) : [];
  const hasCanonicalHeader = firstRow.includes('ID') && firstRow.includes('이름');
  const hasLegacyHeader = firstRow.includes('최종수정시각') && firstRow.includes('이름');
  const startIndex = hasCanonicalHeader || hasLegacyHeader ? 1 : 0;
  const submissions: StudentSubmission[] = [];

  for (let index = startIndex; index < rows.length; index++) {
    const row = rows[index];
    if (!Array.isArray(row)) continue;

    const isCanonical = hasCanonicalHeader || (!hasLegacyHeader && row.length >= 19 && /^sub-/.test(String(row[0] || '')));
    const raw = isCanonical
      ? {
          id: row[0], grade: row[1], classNum: row[2], studentNum: row[3], name: row[4],
          domain: row[5], learningContent: row[6], keywords: row[7], musicStyle: row[8],
          promptStructure: row[9], promptSituation: row[10], promptCustom: row[11],
          aiLyrics: row[12], editedLyrics: row[13], sunoLink: row[14], status: row[15],
          submittedAt: row[16], score: row[17], feedback: row[18], evaluationJson: row[19]
        }
      : {
          submittedAt: row[0], grade: 2, classNum: row[1], studentNum: row[2], name: row[3],
          domain: row[4], learningContent: row[5], keywords: row[6], musicStyle: row[7],
          promptStructure: row[8], promptSituation: row[9], promptCustom: row[10],
          aiLyrics: row[11], editedLyrics: row[12], sunoLink: row[13], status: row[14],
          score: row[15], feedback: row[16], evaluationJson: row[17]
        };

    if (!raw.classNum || !raw.studentNum || !String(raw.name || '').trim()) continue;
    submissions.push(parseGasDataToSubmission(raw));
  }

  const unique = new Map<string, StudentSubmission>();
  submissions.forEach(submission => unique.set(submission.id, submission));
  return Array.from(unique.values());
}

export async function fetchAllSubmissionsFromGAS(): Promise<StudentSubmission[]> {
  const apiResponse = await fetch('/api/sheet', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'getSubmissions' }),
  });
  const responseData = await readApiJson(apiResponse);
  const rows = Array.isArray(responseData?.data)
    ? responseData.data
    : Array.isArray(responseData?.submissions)
      ? responseData.submissions
      : [];
  const parsed = parseGasSubmissionRows(rows);
  return parsed;
}

export async function syncRosterToGAS(roster: StudentRosterItem[]): Promise<boolean> {
  try {
    const apiRes = await fetch('/api/sheet', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'saveRoster', roster }),
    });
    const data = await readApiJson(apiRes);
    return data?.status === 'success';
  } catch (e) {
    console.warn('Protected roster sync warning:', e);
    return false;
  }
}

export async function mutateRosterStudentInGAS(
  action: 'upsertRosterStudent' | 'deleteRosterStudent',
  student: StudentRosterItem,
): Promise<boolean> {
  try {
    const apiRes = await fetch('/api/sheet', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, student })
    });
    const data = await readApiJson(apiRes);
    return data?.status === 'success';
  } catch (e) {
    console.warn('Protected roster mutation warning:', e);
    return false;
  }
}

export function parseGasRosterRows(rows: any[], allowMissingName = false): StudentRosterItem[] {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const roster: StudentRosterItem[] = [];

  // Check if rows is an array of objects
  if (typeof rows[0] === 'object' && rows[0] !== null && !Array.isArray(rows[0])) {
    for (const item of rows) {
      if (!item) continue;
      const name = String(item.name || item.studentName || item.성명 || item.이름 || '').trim();
      if ((allowMissingName || name) && name !== '이름' && name !== '성명') {
        const grade = Number(item.grade || item.학년) || 2;
        const classNum = Number(item.classNum || item.class || item.반) || 0;
        const studentNum = Number(item.studentNum || item.number || item.num || item.번호) || 0;
        if (classNum <= 0 || studentNum <= 0) continue;
        const id = canonicalRosterId({ grade, classNum, studentNum });
        roster.push({ id, grade, classNum, studentNum, name });
      }
    }
    return roster;
  }

  // 2D Array parsing
  const firstRow = Array.isArray(rows[0]) ? rows[0].map(cell => String(cell || '').trim()) : [];
  
  let idIdx = -1;
  let gradeIdx = -1;
  let classIdx = -1;
  let numIdx = -1;
  let nameIdx = -1;

  firstRow.forEach((cell, idx) => {
    const lower = cell.toLowerCase();
    if (lower === 'id') idIdx = idx;
    else if (lower.includes('학년')) gradeIdx = idx;
    else if (lower.includes('반')) classIdx = idx;
    else if (lower.includes('번호')) numIdx = idx;
    else if (lower.includes('이름') || lower.includes('성명') || lower.includes('학생명')) nameIdx = idx;
  });

  const hasHeader = (nameIdx !== -1 || classIdx !== -1 || numIdx !== -1 || gradeIdx !== -1 || idIdx !== -1);
  const startIdx = hasHeader ? 1 : 0;

  for (let i = startIdx; i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row) || row.length === 0) continue;

    let grade = 2;
    let classNum = 0;
    let studentNum = 0;
    let name = '';
    let id = '';

    if (hasHeader) {
      if (idIdx !== -1) id = String(row[idIdx] || '').trim();
      if (gradeIdx !== -1) grade = Number(row[gradeIdx]) || 2;
      if (classIdx !== -1) classNum = Number(row[classIdx]) || 0;
      if (numIdx !== -1) studentNum = Number(row[numIdx]) || 0;
      if (nameIdx !== -1) name = String(row[nameIdx] || '').trim();
    } else {
      // Positional fallbacks based on row length
      if (row.length >= 5) {
        id = String(row[0] || '').trim();
        grade = Number(row[1]) || 2;
        classNum = Number(row[2]) || 0;
        studentNum = Number(row[3]) || 0;
        name = String(row[4] || '').trim();
      } else if (row.length === 4) {
        grade = Number(row[0]) || 2;
        classNum = Number(row[1]) || 0;
        studentNum = Number(row[2]) || 0;
        name = String(row[3] || '').trim();
      } else if (row.length === 3) {
        grade = 2;
        classNum = Number(row[0]) || 0;
        studentNum = Number(row[1]) || 0;
        name = String(row[2] || '').trim();
      } else if (row.length === 2) {
        const first = String(row[0] || '').trim();
        name = String(row[1] || '').trim();
        if (/^\d{4,5}$/.test(first)) {
          if (first.length === 5) {
            grade = Number(first[0]) || 2;
            classNum = Number(first.slice(1, 3)) || 0;
            studentNum = Number(first.slice(3, 5)) || 0;
          } else {
            grade = 2;
            classNum = Number(first.slice(0, 2)) || 0;
            studentNum = Number(first.slice(2, 4)) || 0;
          }
        }
      }
    }

    if ((allowMissingName || name) && name !== '이름' && name !== '성명' && !name.toLowerCase().includes('id') && classNum > 0 && studentNum > 0) {
      const canonicalId = canonicalRosterId({ grade, classNum, studentNum });
      roster.push({
        // ID 열의 오타·중복보다 실제 학년·반·번호를 우선합니다.
        id: canonicalId,
        grade,
        classNum,
        studentNum,
        name
      });
    }
  }

  const seenKeys = new Set<string>();
  const uniqueRoster: StudentRosterItem[] = [];
  for (const item of roster) {
    const key = canonicalRosterId(item);
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      uniqueRoster.push({ ...item, id: key });
    }
  }

  return uniqueRoster;
}

export async function fetchRosterFromGAS(): Promise<StudentRosterItem[]> {
  const apiRes = await fetch('/api/roster/public', {
    method: 'GET',
    credentials: 'same-origin',
    cache: 'default',
  });
  const resData = await readApiJson(apiRes);
  const rawRows = Array.isArray(resData?.data) ? resData.data : [];
  const roster = parseGasRosterRows(rawRows, true);
  saveRoster(roster);
  return roster;
}

export async function fetchAdminRosterFromGAS(): Promise<StudentRosterItem[]> {
  const apiRes = await fetch('/api/sheet', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'getRoster' })
  });
  const resData = await readApiJson(apiRes);
  const rawRows = Array.isArray(resData?.data) ? resData.data : [];
  const roster = parseGasRosterRows(rawRows);
  saveRoster(roster);
  return roster;
}

export async function fetchStudentGoogleIdFromGAS(
  student: Pick<StudentRosterItem, 'grade' | 'classNum' | 'studentNum' | 'name'>
): Promise<string | null> {
  const payload = {
    action: 'getStudentGoogleId',
    grade: student.grade,
    classNum: student.classNum,
    studentNum: student.studentNum,
    name: student.name,
  };

  const readGoogleId = (data: any): string | null => {
    if (!data || data.status !== 'success' || !data.found) return null;
    const googleId = String(data.googleId || data.data?.googleId || '').trim();
    return googleId || null;
  };

  try {
    const apiRes = await fetch('/api/sheet', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const googleId = readGoogleId(await readApiJson(apiRes));
    if (googleId) return googleId;
  } catch (e) {
    console.warn('Protected student Google ID fetch error:', e);
  }

  return null;
}

export interface FormSubmissionPayload {
  action?: string;
  id: string;
  grade: number;
  classNum: number;
  studentNum: number;
  name: string;
  domain: string;
  learningContent: string;
  keywords: string;
  musicStyle: string;
  promptStructure: string;
  promptSituation: string;
  promptCustom: string;
  aiLyrics: string;
  editedLyrics: string;
  sunoLink: string;
  status: string;
  submittedAt: string;
  score: number | '';
  feedback: string;
  evaluation: StudentSubmission['evaluation'];
}

export function buildSubmissionPayload(submission: StudentSubmission): FormSubmissionPayload {
  const step1 = submission.step1;
  const step2 = submission.step2;
  const step3 = submission.step3;
  const step4 = submission.step4;

  const keywordsStr = Array.isArray(step1?.keywords)
    ? step1.keywords.join(', ')
    : (step1?.keywords || '');

  const submittedAtStr = step4?.finalSubmittedAt || submission.updatedAt || new Date().toLocaleString('ko-KR');

  return {
    action: 'saveSubmission',
    id: submission.id,
    grade: submission.grade,
    classNum: submission.classNum,
    studentNum: submission.studentNum,
    name: submission.name,
    domain: step1?.unit || '',
    learningContent: step1?.summary || '',
    keywords: keywordsStr,
    musicStyle: step2?.genre || '',
    promptStructure: step2?.structurePrompt || '',
    promptSituation: step2?.situationPrompt || '',
    promptCustom: step2?.customPrompt || '',
    aiLyrics: step2?.generatedLyrics || '',
    editedLyrics: step3?.editedLyrics || '',
    sunoLink: step4?.sunoUrl || '',
    status: submission.status,
    submittedAt: submittedAtStr,
    score: submission.evaluation?.totalScore ?? '',
    feedback: submission.evaluation?.feedback || '',
    evaluation: submission.evaluation,
  };
}

export function parseGasDataToSubmission(data: any): StudentSubmission {
  const keywordsArr = typeof data.keywords === 'string'
    ? data.keywords.split(',').map((k: string) => k.trim()).filter(Boolean)
    : (Array.isArray(data.keywords) ? data.keywords : []);

  const hasStep1 = Boolean(data.domain || data.learningContent || keywordsArr.length > 0);
  const hasStep2 = Boolean(data.musicStyle || data.aiLyrics);
  const hasStep3 = Boolean(data.editedLyrics);
  const hasStep4 = Boolean(data.sunoLink);

  let status: StudentSubmission['status'] = 'not_started';
  if (data.status === 'completed' || hasStep4) {
    status = 'completed';
  } else if (data.status === 'step3' || hasStep3) {
    status = 'step3';
  } else if (data.status === 'step2' || hasStep2) {
    status = 'step2';
  } else if (data.status === 'step1' || hasStep1) {
    status = 'step1';
  }

  const studentNum = Number(data.studentNum);
  const formattedStudentNum = studentNum < 10 ? `0${studentNum}` : `${studentNum}`;
  const subId = data.id || `sub-${Number(data.grade) || 2}-${Number(data.classNum)}-${formattedStudentNum}`;

  let evaluation = data.evaluation || null;
  if (!evaluation && data.evaluationJson) {
    try {
      evaluation = JSON.parse(String(data.evaluationJson));
    } catch {
      evaluation = null;
    }
  }
  if (!evaluation && (data.score !== '' && data.score !== undefined || data.feedback)) {
    evaluation = {
      totalScore: Number(data.score) || 0,
      maxScore: 100,
      scores: {},
      feedback: data.feedback || '',
      evaluatedAt: data.submittedAt || new Date().toLocaleString('ko-KR')
    };
  }

  return {
    id: subId,
    grade: Number(data.grade),
    classNum: Number(data.classNum),
    studentNum: Number(data.studentNum),
    name: String(data.name),
    status,
    step1: hasStep1 ? {
      unit: data.domain || '',
      summary: data.learningContent || '',
      keywords: keywordsArr,
      savedAt: data.submittedAt || new Date().toLocaleString('ko-KR')
    } : null,
    step2: hasStep2 ? {
      genre: data.musicStyle || '',
      structurePrompt: data.promptStructure || '',
      situationPrompt: data.promptSituation || '',
      customPrompt: data.promptCustom || '',
      generatedLyrics: data.aiLyrics || '',
      generatedAt: data.submittedAt || new Date().toLocaleString('ko-KR')
    } : null,
    step3: hasStep3 ? {
      editedLyrics: data.editedLyrics || data.aiLyrics || '',
      hasSelfEdited: Boolean(data.editedLyrics && data.editedLyrics !== data.aiLyrics),
      reviewedAt: data.submittedAt || new Date().toLocaleString('ko-KR')
    } : null,
    step4: hasStep4 ? {
      sunoUrl: data.sunoLink || '',
      finalSubmittedAt: data.submittedAt || new Date().toLocaleString('ko-KR')
    } : null,
    updatedAt: data.submittedAt || new Date().toLocaleString('ko-KR'),
    evaluation
  };
}

export async function fetchStudentDataFromGAS(
  grade: number,
  classNum: number,
  studentNum: number,
  name: string
): Promise<StudentSubmission | null> {
  const payload = {
    action: 'getStudentData',
    grade,
    classNum,
    studentNum,
    name,
    id: `sub-${grade}-${classNum}-${studentNum}`
  };

  // 1. Backend proxy API (/api/sheet) for backend stability
  try {
    const apiRes = await fetch('/api/sheet', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await readApiJson(apiRes);
    if (data?.found && data?.data) {
      return parseGasDataToSubmission(data.data);
    }
  } catch (e) {
    console.warn('Protected student data fetch error:', e);
    throw e;
  }

  return null;
}

export async function updateSingleSubmission(submission: StudentSubmission): Promise<void> {
  await syncSubmissionToGAS(submission);
  const current = loadSubmissions();
  const idx = current.findIndex(s => s.id === submission.id);
  if (idx >= 0) {
    current[idx] = submission;
  } else {
    current.push(submission);
  }
  saveSubmissions(current);
}

export async function syncSubmissionToGAS(submission: StudentSubmission): Promise<void> {
  const bodyData = buildSubmissionPayload(submission);
  const apiRes = await fetch('/api/sheet', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bodyData),
  });
  await readApiJson(apiRes);
}
