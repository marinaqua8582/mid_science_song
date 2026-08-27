/**
 * Types for Middle School Science Song Performance Evaluation & Teacher Management App
 */

export type ScienceUnit = '소화' | '순환' | '호흡' | '배설';

export interface UnitInfo {
  id: ScienceUnit;
  name: string;
  description: string;
  icon: string;
  starterExample: string;
  recommendedTerms: string[];
}

export interface StudentRosterItem {
  id: string; // e.g., "2-1-05"
  grade: number; // e.g., 2
  classNum: number; // e.g., 1
  studentNum: number; // e.g., 5
  name: string;
  googleId?: string; // 명단 업로드/시트 저장용. 학생 화면에서는 본인 조회 시에만 사용
}

export interface Step1Data {
  unit: ScienceUnit;
  summary: string; // 5문장 이상 권장
  keywords: string[]; // 10개 이상 권장
  savedAt: string;
}

export interface Step2Data {
  genre: string; // K-Pop, 힙합/랩, 트로트, 발라드, 동요, EDM, 국악/판소리, 락
  structurePrompt: string; // 가사 구조 설계
  situationPrompt: string; // 상황 설정
  customPrompt: string; // 추가 요구사항
  generatedLyrics: string; // Gemini AI가 생성한 가사
  generatedAt: string;
}

export interface Step3Data {
  editedLyrics: string; // 학생이 직접 수정한 가사
  hasSelfEdited: boolean;
  reviewedAt: string;
}

export interface Step4Data {
  sunoUrl?: string; // Suno AI 완성곡 링크 (선택사항)
  finalSubmittedAt: string;
}

export interface RubricScoreItem {
  criterionId: string;
  criterionTitle: string;
  maxPoints: number;
  score: number;
}

export interface TeacherEvaluation {
  scores: Record<string, number>;
  totalScore: number;
  maxScore: number;
  feedback: string;
  evaluatedAt: string;
}

export interface StudentSubmission {
  id: string; // e.g., "sub-2-1-05"
  grade: number;
  classNum: number;
  studentNum: number;
  name: string;
  status: 'not_started' | 'step1' | 'step2' | 'step3' | 'completed' | 'step1_saved';
  step1: Step1Data | null;
  step2: Step2Data | null;
  step3: Step3Data | null;
  step4: Step4Data | null;
  updatedAt: string;
  evaluation: TeacherEvaluation | null;
}

export interface RubricCriterion {
  id: string;
  title: string;
  description: string;
  maxPoints: number;
}

export interface AppSettings {
  teacherPin: string;
  gasUrl: string;
  rubrics: RubricCriterion[];
}
