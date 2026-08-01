import { AppSettings, StudentRosterItem, StudentSubmission, RubricCriterion } from '../types';
import { DEFAULT_ROSTER, DEFAULT_RUBRICS } from '../data/units';

const SETTINGS_KEY = 'science_song_app_settings';
const ROSTER_KEY = 'science_song_roster';
const SUBMISSIONS_KEY = 'science_song_submissions';

export const getDefaultSettings = (): AppSettings => ({
  teacherPin: '1234',
  gasUrl: '',
  rubrics: DEFAULT_RUBRICS,
});

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return getDefaultSettings();
    return JSON.parse(raw);
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
      saveRoster(DEFAULT_ROSTER);
      return DEFAULT_ROSTER;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load roster', e);
    return DEFAULT_ROSTER;
  }
}

export function saveRoster(roster: StudentRosterItem[]): void {
  try {
    localStorage.setItem(ROSTER_KEY, JSON.stringify(roster));
  } catch (e) {
    console.error('Failed to save roster', e);
  }
}

// Helper to initialize realistic sample student submissions if empty
export function getInitialSampleSubmissions(): StudentSubmission[] {
  const roster = DEFAULT_ROSTER;
  const submissions: StudentSubmission[] = [
    {
      id: 'sub-2-1-01',
      grade: 2,
      classNum: 1,
      studentNum: 1,
      name: '강민준',
      status: 'completed',
      step1: {
        unit: '소화',
        summary: '소화는 음식물 속 크고 복잡한 영양소를 세포가 흡수할 수 있는 작고 단순한 물질로 분해하는 과정입니다. 입에서는 침 속의 아밀레이스가 녹말을 당분으로 분해합니다. 위에서는 위산과 펩신이 작용하여 단백질을 분해합니다. 소장에서는 이자액, 쓸개즙, 장액이 작용하여 모든 영양소를 최종 분해합니다. 융털을 통해 포도당, 아미노산, 지방산 등이 모세혈관과 암죽관으로 흡수됩니다.',
        keywords: ['소화', '영양소', '아밀레이스', '위산', '펩신', '소장', '이자액', '쓸개즙', '융털', '포도당'],
        savedAt: '2026-08-01 09:15'
      },
      step2: {
        genre: 'K-Pop',
        structurePrompt: '[Verse 1] 입에서 시작되는 여행 - [Chorus] 융털 융털 소화송 - [Verse 2] 위와 소장의 비밀 - [Outro]',
        situationPrompt: '신나는 K-Pop 걸그룹 댄스곡 스타일로 과학 개념 노래하기',
        customPrompt: '중독성 있는 후렴구에 영양소 분해 과정을 밝게 담아주세요.',
        generatedLyrics: `[Verse 1]
맛있는 샌드위치 한 입 베어 물면
입속에서 아밀레이스 춤을 추기 시작해
녹말은 포도당으로 변하는 첫걸음
식도를 타고 위로 퐁당 내려가네

[Chorus]
소화 소화 멈추지 마 융털 속으로!
펩신과 위산이 단백질을 안아줘
소장에서 이자액 쓸개즙 만나서
포도당 아미노산 에너지로 변해!

[Verse 2]
쓸개즙은 간에서 만들어 소장으로
지방 덩어리를 작게 작게 녹여내
소장 벽 융털 암죽관 모세혈관
우리의 온몸으로 사랑을 전해줘!

[Outro]
영양소 쏙쏙, 소화 완벽해!
내 몸의 놀라운 과학 엔진 팡팡!`,
        generatedAt: '2026-08-01 09:20'
      },
      step3: {
        editedLyrics: `[Verse 1]
맛있는 샌드위치 한 입 베어 물면
입속에서 아밀레이스 춤을 추기 시작해
녹말은 당분으로 변하는 첫걸음 (아밀레이스는 녹말을 엿당/당분으로 분해!)
식도를 타고 위로 퐁당 내려가네

[Chorus]
소화 소화 멈추지 마 융털 속으로!
펩신과 위산이 단백질을 잘라줘
소장에서 이자액 쓸개즙 만나서
포도당 아미노산 지방산으로 변해!

[Verse 2]
쓸개즙은 간에서 만들어 담낭에 보관 소장으로
지방 덩어리를 작게 작게 유화해
소장 벽 융털 암죽관 모세혈관
우리의 온몸으로 영양을 전해줘!

[Outro]
영양소 쏙쏙, 소화 완벽해!
내 몸의 놀라운 과학 엔진 팡팡!`,
        hasSelfEdited: true,
        reviewedAt: '2026-08-01 09:25'
      },
      step4: {
        sunoUrl: 'https://suno.com/song/sample-digestion-kpop-123',
        finalSubmittedAt: '2026-08-01 09:30'
      },
      updatedAt: '2026-08-01 09:30',
      evaluation: {
        scores: {
          'rubric-1': 10,
          'rubric-2': 10,
          'rubric-3': 10
        },
        totalScore: 30,
        maxScore: 30,
        feedback: '아밀레이스가 녹말을 최종 포도당이 아닌 당분/엿당으로 우선 분해한다는 점을 자가 수정 단계에서 비판적으로 정정함. 훌륭합니다!',
        evaluatedAt: '2026-08-01 10:00'
      }
    },
    {
      id: 'sub-2-1-02',
      grade: 2,
      classNum: 1,
      studentNum: 2,
      name: '김서연',
      status: 'completed',
      step1: {
        unit: '순환',
        summary: '순환계는 심장과 혈관으로 구성되어 있으며 혈액을 온몸으로 보냅니다. 심장은 2심방 2심실로 이루어져 있으며 펌프 작용을 합니다. 동맥은 심장에서 나가는 혈액이 흐르고 정맥은 심장으로 들어오는 혈액이 흐릅니다. 모세혈관은 한 층의 세포로 이루어져 물질교환이 일어납니다. 적혈구의 헤모글로빈이 산소를 운반합니다.',
        keywords: ['순환', '심장', '우심방', '좌심실', '동맥', '정맥', '모세혈관', '적혈구', '헤모글로빈', '물질교환'],
        savedAt: '2026-08-01 09:40'
      },
      step2: {
        genre: '힙합/랩',
        structurePrompt: '[Verse 1] - [Chorus] - [Verse 2] - [Outro]',
        situationPrompt: '빠른 비트의 힙합 랩 스타일',
        customPrompt: '심장의 2심방 2심실과 라임을 맞춰주세요.',
        generatedLyrics: `[Verse 1]
Yo, 쿵쾅대는 내 가슴속 심장 엔진 2심방 2심실
좌심실 강력한 펌프질 온몸으로 뻗어나가는 길
동맥 타고 달리는 적혈구의 붉은 열정
헤모글로빈 산소 장착하고 목표를 향해 진격!

[Chorus]
순환계의 흐름 멈추지 않는 비트
체순환 폐순환 피가 도는 서킷
모세혈관에서 영양소 교환 시크릿
내 몸을 살리는 생명의 피트!`,
        generatedAt: '2026-08-01 09:45'
      },
      step3: {
        editedLyrics: `[Verse 1]
Yo, 쿵쾅대는 내 가슴속 심장 엔진 2심방 2심실
좌심실 강력한 펌프질 온몸으로 뻗어나가는 길
동맥 타고 달리는 적혈구의 붉은 열정
헤모글로빈 산소 장착하고 세포로 진격!

[Chorus]
순환계의 흐름 멈추지 않는 비트
체순환 폐순환 피가 도는 서킷
모세혈관에서 산소와 노폐물 교환 시크릿
내 몸을 살리는 생명의 피트!`,
        hasSelfEdited: true,
        reviewedAt: '2026-08-01 09:50'
      },
      step4: {
        sunoUrl: 'https://suno.com/song/sample-circulation-hiphop-456',
        finalSubmittedAt: '2026-08-01 09:55'
      },
      updatedAt: '2026-08-01 09:55',
      evaluation: null
    },
    {
      id: 'sub-2-1-03',
      grade: 2,
      classNum: 1,
      studentNum: 3,
      name: '박도현',
      status: 'step1_saved',
      step1: {
        unit: '호흡',
        summary: '호흡은 코, 기관, 기관지, 폐를 통해 공기를 마시고 내뱉는 과정입니다. 들숨 시 갈비뼈가 올라가고 가로막이 내려가 폐의 부피가 커집니다. 폐포에서 산소와 이산화탄소의 확산에 의한 기체 교환이 일어납니다. 세포호흡을 통해 영양소와 산소로 에너지를 만들어냅니다.',
        keywords: ['호흡', '들숨', '날숨', '가로막', '갈비뼈', '폐포', '산소', '이산화탄소', '확산', '세포호흡'],
        savedAt: '2026-08-01 10:10'
      },
      step2: null,
      step3: null,
      step4: null,
      updatedAt: '2026-08-01 10:10',
      evaluation: null
    }
  ];

  return submissions;
}

export function loadSubmissions(): StudentSubmission[] {
  try {
    const raw = localStorage.getItem(SUBMISSIONS_KEY);
    if (!raw) {
      const initial = getInitialSampleSubmissions();
      saveSubmissions(initial);
      return initial;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load submissions', e);
    return getInitialSampleSubmissions();
  }
}

export function saveSubmissions(submissions: StudentSubmission[]): void {
  try {
    localStorage.setItem(SUBMISSIONS_KEY, JSON.stringify(submissions));
  } catch (e) {
    console.error('Failed to save submissions', e);
  }
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

export function updateSingleSubmission(submission: StudentSubmission): void {
  const current = loadSubmissions();
  const idx = current.findIndex(s => s.id === submission.id);
  if (idx >= 0) {
    current[idx] = submission;
  } else {
    current.push(submission);
  }
  saveSubmissions(current);

  // Sync to Google Apps Script if URL exists
  const settings = loadSettings();
  if (settings.gasUrl) {
    syncSubmissionToGAS(settings.gasUrl, submission).catch(err => {
      console.warn('GAS sync warning:', err);
    });
  }
}

export async function syncSubmissionToGAS(gasUrl: string, submission: StudentSubmission): Promise<boolean> {
  const bodyData = buildSubmissionPayload(submission, gasUrl);

  // 1. Send full JSON object to backend API endpoint (/api/sheet) with application/json header
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
    // API route fallback
  }

  if (!gasUrl || !gasUrl.startsWith('http')) return false;

  const payload = {
    action: 'saveSubmission',
    data: bodyData,
    ...bodyData,
  };

  // 2. Direct fetch fallback to GAS URL using text/plain (avoids CORS OPTIONS preflight check)
  try {
    const response = await fetch(gasUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload)
    });
    if (response.ok) {
      const resData = await response.json().catch(() => null);
      if (resData && resData.status === 'success') return true;
    }
  } catch (e) {
    // Direct CORS fallback
  }

  // 3. Fallback using mode: 'no-cors'
  try {
    await fetch(gasUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload)
    });
    return true;
  } catch (err) {
    console.warn('GAS sync warning:', err);
    return false;
  }
}

export async function syncRosterToGAS(gasUrl: string, roster: StudentRosterItem[]): Promise<boolean> {
  if (!gasUrl || !gasUrl.startsWith('http')) return false;

  const payload = {
    action: 'saveRoster',
    roster
  };

  try {
    const response = await fetch(gasUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload)
    });
    if (response.ok) {
      const resData = await response.json().catch(() => null);
      if (resData && resData.status === 'success') return true;
    }
  } catch (e) {
    // Fallback
  }

  try {
    await fetch(gasUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload)
    });
    return true;
  } catch (err) {
    console.warn('GAS roster sync warning:', err);
    return false;
  }
}
