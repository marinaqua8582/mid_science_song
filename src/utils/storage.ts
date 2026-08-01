import { AppSettings, StudentRosterItem, StudentSubmission, RubricCriterion } from '../types';
import { DEFAULT_ROSTER, DEFAULT_RUBRICS } from '../data/units';

const SETTINGS_KEY = 'science_song_app_settings';
const ROSTER_KEY = 'science_song_roster';
const SUBMISSIONS_KEY = 'science_song_submissions';

export function getGasUrl(): string {
  const metaEnv = (import.meta as any).env || {};
  const envUrl = metaEnv.NEXT_PUBLIC_GAS_URL ||
                 metaEnv.VITE_GAS_URL ||
                 (typeof window !== 'undefined' && ((window as any).NEXT_PUBLIC_GAS_URL || (window as any).GAS_URL)) ||
                 'https://script.google.com/macros/s/AKfycbwnhnAzyN6HP__bXd0N_KzTY-GZOZ8ayqO6BD0i_iaMJPuxUGNsFDKys7c38VFleeJnDg/exec';
  return envUrl;
}

export const getDefaultSettings = (): AppSettings => ({
  teacherPin: '1234',
  gasUrl: getGasUrl(),
  rubrics: DEFAULT_RUBRICS,
});

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const defaults = getDefaultSettings();
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return {
      ...parsed,
      gasUrl: getGasUrl(), // Always prioritize process.env / global GAS_URL over local storage
    };
  } catch (e) {
    console.error('Failed to load settings', e);
    return getDefaultSettings();
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
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
      const formattedNum = item.studentNum < 10 ? `0${item.studentNum}` : `${item.studentNum}`;
      const key = item.id || `${item.grade}-${item.classNum}-${formattedNum}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push({ ...item, id: key });
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

export async function syncRosterToGAS(roster: StudentRosterItem[], gasUrlParam?: string): Promise<boolean> {
  const targetGasUrl = gasUrlParam || getGasUrl();
  const payload = {
    action: 'saveRoster',
    roster,
    gasUrl: targetGasUrl
  };

  // 1. Backend proxy API (/api/sheet)
  try {
    const apiRes = await fetch('/api/sheet', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (apiRes.ok) {
      const data = await apiRes.json().catch(() => null);
      if (data && data.status === 'success') return true;
    }
  } catch (e) {
    console.warn('API route roster sync warning:', e);
  }

  // 2. Direct fetch to Google Apps Script URL as fallback
  if (targetGasUrl && targetGasUrl.startsWith('http')) {
    try {
      const res = await fetch(targetGasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const resData = await res.json().catch(() => null);
        if (resData && resData.status === 'success') return true;
      }
    } catch (e) {
      try {
        await fetch(targetGasUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload),
        });
        return true;
      } catch (err) {
        console.warn('Direct GAS roster sync warning:', err);
      }
    }
  }

  return false;
}

export function parseGasRosterRows(rows: any[]): StudentRosterItem[] {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const roster: StudentRosterItem[] = [];

  // Check if rows is an array of objects
  if (typeof rows[0] === 'object' && rows[0] !== null && !Array.isArray(rows[0])) {
    for (const item of rows) {
      if (!item) continue;
      const name = String(item.name || item.studentName || item.성명 || item.이름 || '').trim();
      if (name && name !== '이름' && name !== '성명') {
        const grade = Number(item.grade || item.학년) || 2;
        const classNum = Number(item.classNum || item.class || item.반) || 1;
        const studentNum = Number(item.studentNum || item.number || item.num || item.번호) || 1;
        const formattedNum = studentNum < 10 ? `0${studentNum}` : `${studentNum}`;
        const id = String(item.id || `${grade}-${classNum}-${formattedNum}`);
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

    if (name && name !== '이름' && name !== '성명' && !name.toLowerCase().includes('id') && classNum > 0 && studentNum > 0) {
      const formattedNum = studentNum < 10 ? `0${studentNum}` : `${studentNum}`;
      roster.push({
        id: id || `${grade}-${classNum}-${formattedNum}`,
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
    const formattedNum = item.studentNum < 10 ? `0${item.studentNum}` : `${item.studentNum}`;
    const key = item.id || `${item.grade}-${item.classNum}-${formattedNum}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      uniqueRoster.push({ ...item, id: key });
    }
  }

  return uniqueRoster;
}

export async function fetchRosterFromGAS(): Promise<StudentRosterItem[]> {
  const gasUrl = getGasUrl();
  const payload = {
    action: 'getRoster',
    gasUrl
  };

  const processResponse = (resData: any): StudentRosterItem[] | null => {
    if (!resData) return null;
    const rawRows = Array.isArray(resData) ? resData :
                    Array.isArray(resData?.data) ? resData.data :
                    Array.isArray(resData?.roster) ? resData.roster :
                    Array.isArray(resData?.result) ? resData.result : null;
    if (rawRows && Array.isArray(rawRows)) {
      const roster = parseGasRosterRows(rawRows);
      saveRoster(roster);
      return roster;
    }
    return null;
  };

  // 1. Try backend proxy API (/api/sheet)
  try {
    const apiRes = await fetch('/api/sheet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (apiRes.ok) {
      const resData = await apiRes.json().catch(() => null);
      const roster = processResponse(resData);
      if (roster) return roster;
    }
  } catch (e) {
    console.warn('Backend proxy fetchRosterFromGAS error:', e);
  }

  // 2. Direct GET request to gasUrl
  if (gasUrl && gasUrl.startsWith('http')) {
    try {
      const getUrl = `${gasUrl}${gasUrl.includes('?') ? '&' : '?'}action=getRoster`;
      const directRes = await fetch(getUrl);
      if (directRes.ok) {
        const resData = await directRes.json().catch(() => null);
        const roster = processResponse(resData);
        if (roster) return roster;
      }
    } catch (e) {
      console.warn('Direct GET fetchRosterFromGAS error:', e);
    }
  }

  // 3. Direct POST request to gasUrl
  if (gasUrl && gasUrl.startsWith('http')) {
    try {
      const directPostRes = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });
      if (directPostRes.ok) {
        const resData = await directPostRes.json().catch(() => null);
        const roster = processResponse(resData);
        if (roster) return roster;
      }
    } catch (e) {
      console.warn('Direct POST fetchRosterFromGAS error:', e);
    }
  }

  return loadRoster();
}

export interface FormSubmissionPayload {
  gasUrl?: string;
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
}

export function buildSubmissionPayload(submission: StudentSubmission, gasUrl?: string): FormSubmissionPayload {
  const step1 = submission.step1;
  const step2 = submission.step2;
  const step3 = submission.step3;
  const step4 = submission.step4;

  const keywordsStr = Array.isArray(step1?.keywords)
    ? step1.keywords.join(', ')
    : (step1?.keywords || '');

  const submittedAtStr = step4?.finalSubmittedAt || submission.updatedAt || new Date().toLocaleString('ko-KR');

  return {
    gasUrl,
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

  const subId = data.id || `sub-${data.grade}-${data.classNum}-${data.studentNum}`;

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
    evaluation: (data.score || data.feedback) ? {
      totalScore: Number(data.score) || 0,
      maxScore: 100,
      scores: {},
      feedback: data.feedback || '',
      evaluatedAt: new Date().toLocaleString('ko-KR')
    } : null
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (apiRes.ok) {
      const data = await apiRes.json().catch(() => null);
      if (data && data.status === 'success' && data.found && data.data) {
        return parseGasDataToSubmission(data.data);
      }
    }
  } catch (e) {
    console.warn('Backend proxy fetch student error:', e);
  }

  // 2. Direct fetch to GAS URL if needed
  const gasUrl = getGasUrl();
  if (gasUrl && gasUrl.startsWith('http')) {
    try {
      const res = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data && data.status === 'success' && data.found && data.data) {
          return parseGasDataToSubmission(data.data);
        }
      }
    } catch (e) {
      console.warn('Direct GAS fetch student error:', e);
    }
  }

  return null;
}

export function updateSingleSubmission(submission: StudentSubmission): void {
  const current = loadSubmissions();
  const idx = current.findIndex(s => s.id === submission.id);
  if (idx >= 0) {
    current[idx] = submission;
  } else {
    current.push(submission);
  }
  saveSubmissions(current);

  // Immediately sync to Google Apps Script via /api/sheet backend proxy
  syncSubmissionToGAS(submission).catch(err => {
    console.warn('GAS sync warning:', err);
  });
}

export async function syncSubmissionToGAS(submission: StudentSubmission, gasUrlParam?: string): Promise<boolean> {
  const targetGasUrl = gasUrlParam || getGasUrl();
  const bodyData = buildSubmissionPayload(submission, targetGasUrl);

  // 1. Backend proxy API (/api/sheet)
  try {
    const apiRes = await fetch('/api/sheet', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bodyData),
    });

    if (apiRes.ok) {
      const data = await apiRes.json().catch(() => null);
      if (data && data.status === 'success') return true;
    }
  } catch (e) {
    console.warn('API route sheet sync warning:', e);
  }

  // 2. Direct fetch to Google Apps Script URL as fallback
  if (targetGasUrl && targetGasUrl.startsWith('http')) {
    const payload = {
      action: 'saveSubmission',
      data: bodyData,
      ...bodyData,
    };

    try {
      const response = await fetch(targetGasUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const resData = await response.json().catch(() => null);
        if (resData && resData.status === 'success') return true;
      }
    } catch (e) {
      // Fallback: mode 'no-cors'
      try {
        await fetch(targetGasUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: {
            'Content-Type': 'text/plain;charset=utf-8',
          },
          body: JSON.stringify(payload),
        });
        return true;
      } catch (err) {
        console.warn('Direct GAS sync warning:', err);
      }
    }
  }

  return false;
}
