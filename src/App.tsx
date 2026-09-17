import React, { useState, useEffect } from 'react';
import {
  AppSettings, StudentRosterItem, StudentSubmission,
  Step1Data, Step2Data, Step3Data, Step4Data, StudentAccessStatus
} from './types';
import {
  loadSettings, loadRoster, loadSubmissions, saveSubmissions,
  updateSingleSubmission, getDefaultSettings, fetchStudentDataFromGAS, fetchRosterFromGAS,
} from './utils/storage';
import {
  fetchStudentBootstrap, loginStudent, logoutStudent
} from './utils/api';
import { PrivacyBanner } from './components/PrivacyBanner';
import { StudentLogin } from './components/StudentLogin';
import { Step1ScienceSummary } from './components/Step1ScienceSummary';
import { Step2PromptBuilder } from './components/Step2PromptBuilder';
import { Step3LyricsReview } from './components/Step3LyricsReview';
import { Step4SunoSubmission } from './components/Step4SunoSubmission';
import { TeacherDashboard } from './components/TeacherDashboard';
import {
  Music, Sparkles, BookOpen, UserCheck, LogOut, FileCheck2,
  GraduationCap, Check, ShieldCheck, Database, Clock3, AlertCircle
} from 'lucide-react';

const formatAccessDate = (value: string) => {
  if (!value) return '';
  const hasTimeZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value);
  const normalized = hasTimeZone
    ? value
    : /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)
      ? `${value}:00+09:00`
      : `${value}+09:00`;
  const timestamp = Date.parse(normalized);
  if (!Number.isFinite(timestamp)) return value;
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date(timestamp));
};

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(getDefaultSettings());
  const [roster, setRoster] = useState<StudentRosterItem[]>([]);
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);
  const [studentAccess, setStudentAccess] = useState<StudentAccessStatus | null>(null);
  const [accessError, setAccessError] = useState<string>('');

  // Layout mode: 'sidebar' | 'topbar'
  const [layoutMode, setLayoutMode] = useState<'sidebar' | 'topbar'>('sidebar');

  // Mode: 'student' | 'teacher'
  const [appMode, setAppMode] = useState<'student' | 'teacher'>('student');

  // Currently logged-in student
  const [currentStudent, setCurrentStudent] = useState<StudentRosterItem | null>(null);

  // Active step in student workflow (1 | 2 | 3 | 4)
  const [activeStep, setActiveStep] = useState<number>(1);

  // Load stored state on mount
  useEffect(() => {
    const loadedSettings = loadSettings();
    const loadedRoster = loadRoster();
    const loadedSubs = loadSubmissions();

    setSettings(loadedSettings);
    setRoster(loadedRoster);
    setSubmissions(loadedSubs);

    let stopped = false;
    let timer: number | undefined;
    const refreshAccess = async () => {
      let nextDelay = 60_000;
      try {
        const { access: status, roster: gasRoster } = await fetchStudentBootstrap();
        if (stopped) return;
        setStudentAccess(status);
        setRoster(gasRoster);
        setAccessError('');
      } catch (error: any) {
        if (stopped) return;
        setStudentAccess(null);
        setAccessError(error?.message || '학생 접속 가능 시간을 확인하지 못했습니다.');
        nextDelay = 5_000;
      } finally {
        if (!stopped) timer = window.setTimeout(refreshAccess, nextDelay);
      }
    };
    void refreshAccess();
    return () => {
      stopped = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (studentAccess && !studentAccess.isOpen && currentStudent) {
      setCurrentStudent(null);
      setActiveStep(1);
      void logoutStudent();
    }
  }, [studentAccess, currentStudent]);

  // Refresh roster from Google Sheets
  const handleRefreshRoster = async () => {
    try {
      const gasRoster = await fetchRosterFromGAS();
      if (Array.isArray(gasRoster)) {
        setRoster(gasRoster);
      }
      return gasRoster;
    } catch (err) {
      console.warn('Refresh roster error:', err);
      return [];
    }
  };

  // Current student submission object derived from state
  const currentSubmission = currentStudent
    ? submissions.find(s =>
        s.id === `sub-${currentStudent.id}` ||
        (Number(s.grade || 2) === Number(currentStudent.grade || 2) &&
          Number(s.classNum) === Number(currentStudent.classNum) &&
          Number(s.studentNum) === Number(currentStudent.studentNum) &&
          String(s.name || '').trim() === String(currentStudent.name || '').trim())
      ) || {
        id: `sub-${currentStudent.id}`,
        grade: currentStudent.grade,
        classNum: currentStudent.classNum,
        studentNum: currentStudent.studentNum,
        name: currentStudent.name,
        status: 'not_started' as const,
        step1: null,
        step2: null,
        step3: null,
        step4: null,
        updatedAt: new Date().toLocaleString('ko-KR'),
        evaluation: null
      }
    : null;

  const [isLoadingStudentData, setIsLoadingStudentData] = useState<boolean>(false);

  // Handle Student Login
  const handleStudentLogin = async (student: StudentRosterItem) => {
    setIsLoadingStudentData(true);

    try {
      // 서버에서 명단을 다시 확인한 뒤 서명된 학생 세션을 발급합니다.
      const verifiedStudent = await loginStudent(student);
      setCurrentStudent(verifiedStudent);

      // 1. Fetch existing submission data from Google Sheets (GAS)
      const gasData = await fetchStudentDataFromGAS(
        verifiedStudent.grade,
        verifiedStudent.classNum,
        verifiedStudent.studentNum,
        verifiedStudent.name
      );

      if (gasData) {
        // Cache data loaded from Sheets without sending another write request.
        const cached = loadSubmissions();
        const existingIndex = cached.findIndex(item =>
          item.id === gasData.id ||
          (Number(item.grade || 2) === Number(gasData.grade || 2) &&
            Number(item.classNum) === Number(gasData.classNum) &&
            Number(item.studentNum) === Number(gasData.studentNum) &&
            String(item.name || '').trim() === String(gasData.name || '').trim())
        );
        const updatedSubs = existingIndex >= 0
          ? cached.map((item, index) => index === existingIndex ? gasData : item)
          : [...cached, gasData];
        saveSubmissions(updatedSubs);
        setSubmissions(updatedSubs);

        // Calculate step based on restored data
        if (gasData.step4?.sunoUrl || gasData.status === 'completed') {
          setActiveStep(4);
        } else if (gasData.step3?.editedLyrics || gasData.status === 'step3') {
          setActiveStep(4);
        } else if (gasData.step2?.generatedLyrics || gasData.status === 'step2') {
          setActiveStep(3);
        } else if (gasData.step1?.summary || gasData.status === 'step1') {
          setActiveStep(2);
        } else {
          setActiveStep(1);
        }
      } else {
        // Not found in Google Sheets, check local submissions or initialize new
        const existing = submissions.find(s => s.id === `sub-${verifiedStudent.id}` || (s.classNum === verifiedStudent.classNum && s.studentNum === verifiedStudent.studentNum && s.name === verifiedStudent.name));
        if (existing) {
          if (existing.step4?.finalSubmittedAt) {
            setActiveStep(4);
          } else if (existing.step3) {
            setActiveStep(4);
          } else if (existing.step2) {
            setActiveStep(3);
          } else if (existing.step1) {
            setActiveStep(2);
          } else {
            setActiveStep(1);
          }
        } else {
          setActiveStep(1);
        }
      }
    } catch (e) {
      console.error('Error fetching student data from GAS:', e);
      setCurrentStudent(null);
      setActiveStep(1);
      await logoutStudent();
      throw e;
    } finally {
      setIsLoadingStudentData(false);
    }
  };

  // Student Logout
  const handleStudentLogout = () => {
    setCurrentStudent(null);
    setActiveStep(1);
    void logoutStudent();
  };

  // Step 1 Save
  const handleSaveStep1 = async (step1Data: Step1Data, moveNext = true) => {
    if (!currentStudent || !currentSubmission) return;

    const currentStatus = currentSubmission.status;
    const newStatus = (currentStatus === 'completed' || currentStatus === 'step3' || currentStatus === 'step2')
      ? currentStatus
      : 'step1';

    const updated: StudentSubmission = {
      ...currentSubmission,
      step1: step1Data,
      status: newStatus,
      updatedAt: new Date().toLocaleString('ko-KR')
    };

    try {
      await updateSingleSubmission(updated);
      setSubmissions(prev => prev.some(item => item.id === updated.id)
        ? prev.map(item => item.id === updated.id ? updated : item)
        : [...prev, updated]);
      if (moveNext) setActiveStep(2);
    } catch (error: any) {
      alert(error?.message || '1단계 내용을 저장하지 못했습니다. 다시 시도해 주세요.');
    }
  };

  // Step 2 Save
  const handleSaveStep2 = async (step2Data: Step2Data, moveNext = true) => {
    if (!currentStudent || !currentSubmission) return;

    const currentStatus = currentSubmission.status;
    const newStatus = (currentStatus === 'completed' || currentStatus === 'step3')
      ? currentStatus
      : 'step2';

    const updated: StudentSubmission = {
      ...currentSubmission,
      step2: step2Data,
      status: newStatus,
      updatedAt: new Date().toLocaleString('ko-KR')
    };

    try {
      await updateSingleSubmission(updated);
      setSubmissions(prev => prev.some(item => item.id === updated.id)
        ? prev.map(item => item.id === updated.id ? updated : item)
        : [...prev, updated]);
      if (moveNext) setActiveStep(3);
    } catch (error: any) {
      alert(error?.message || '2단계 내용을 저장하지 못했습니다. 다시 시도해 주세요.');
    }
  };

  // Step 3 Save
  const handleSaveStep3 = async (step3Data: Step3Data, moveNext = true) => {
    if (!currentStudent || !currentSubmission) return;

    const currentStatus = currentSubmission.status;
    const newStatus = currentStatus === 'completed' ? 'completed' : 'step3';

    const updated: StudentSubmission = {
      ...currentSubmission,
      step3: step3Data,
      status: newStatus,
      updatedAt: new Date().toLocaleString('ko-KR')
    };

    try {
      await updateSingleSubmission(updated);
      setSubmissions(prev => prev.some(item => item.id === updated.id)
        ? prev.map(item => item.id === updated.id ? updated : item)
        : [...prev, updated]);
      if (moveNext) setActiveStep(4);
    } catch (error: any) {
      alert(error?.message || '3단계 내용을 저장하지 못했습니다. 다시 시도해 주세요.');
    }
  };

  // Step 4 Final Submit / Save
  const handleFinalSubmit = async (step4Data: Step4Data, isFinalAlert = true) => {
    if (!currentStudent || !currentSubmission) return;

    const updated: StudentSubmission = {
      ...currentSubmission,
      step4: step4Data,
      status: 'completed',
      updatedAt: new Date().toLocaleString('ko-KR')
    };

    try {
      await updateSingleSubmission(updated);
      setSubmissions(prev => prev.some(item => item.id === updated.id)
        ? prev.map(item => item.id === updated.id ? updated : item)
        : [...prev, updated]);
      if (isFinalAlert) {
        alert(`수행평가가 성공적으로 제출되었습니다!\n마지막 제출 시간: ${step4Data.finalSubmittedAt}`);
      }
    } catch (error: any) {
      alert(error?.message || '최종 제출에 실패했습니다. 다시 시도해 주세요.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col font-sans antialiased">
      {/* Top Main Navigation Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* App Branding Title */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 text-white rounded-lg flex items-center justify-center font-bold text-lg shadow-sm">
              S
            </div>
            <div>
              <h1 className="font-bold text-slate-900 text-base sm:text-lg leading-tight flex items-center gap-2">
                Science Song 수행평가
                <span className="text-[10px] px-2 py-0.5 font-bold rounded border bg-blue-50 text-blue-700 border-blue-200 hidden sm:inline-block">
                  중학교 과학
                </span>
              </h1>
              <p className="text-[11px] text-slate-500 hidden md:block">
                소화 · 순환 · 호흡 · 배설 Gemini AI 가사 비판적 수정 및 Suno AI 연동
              </p>
            </div>
          </div>

          {/* Right Mode Switcher Tabs */}
          <div className="flex items-center gap-2">
            <span className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold rounded-md">
              <Database className="w-3.5 h-3.5 text-emerald-600" />
              보안 서버 연동
            </span>

            <div className="bg-slate-100 p-1 rounded-lg flex items-center text-xs font-semibold">
              <button
                onClick={() => setAppMode('student')}
                className={`px-3.5 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
                  appMode === 'student'
                    ? 'bg-blue-600 text-white shadow-sm font-medium'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <GraduationCap className="w-4 h-4" />
                학생 수행평가
              </button>
              <button
                onClick={() => setAppMode('teacher')}
                className={`px-3.5 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
                  appMode === 'teacher'
                    ? 'bg-slate-900 text-white shadow-sm font-medium'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                교사 대시보드
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {appMode === 'student' ? (
          <div className="space-y-6">
            {accessError ? (
              <div className="max-w-lg mx-auto my-12 bg-white rounded-2xl border border-amber-200 shadow-lg p-8 text-center space-y-4">
                <AlertCircle className="w-12 h-12 text-amber-500 mx-auto" />
                <h2 className="text-xl font-bold text-slate-900">접속 정보를 확인하고 있습니다</h2>
                <p className="text-sm text-slate-600">{accessError}</p>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold"
                >
                  다시 확인하기
                </button>
              </div>
            ) : !studentAccess ? (
              <div className="max-w-md mx-auto my-12 bg-white rounded-2xl border border-slate-200 shadow-lg p-8 text-center">
                <Clock3 className="w-12 h-12 text-indigo-500 mx-auto mb-3 animate-pulse" />
                <p className="text-sm font-semibold text-slate-600">학생 접속 가능 시간을 확인하는 중입니다...</p>
              </div>
            ) : !studentAccess.isOpen ? (
              <div className="max-w-lg mx-auto my-12 bg-white rounded-2xl border border-indigo-200 shadow-lg p-8 text-center space-y-4">
                <Clock3 className="w-14 h-14 text-indigo-600 mx-auto" />
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">현재는 수행평가 활동 기간이 아닙니다</h2>
                  <p className="text-sm text-slate-600 mt-2">{studentAccess.message}</p>
                </div>
                {(studentAccess.startAt || studentAccess.endAt) && (
                  <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-sm text-indigo-950 space-y-1">
                    {studentAccess.startAt && <p><strong>시작:</strong> {formatAccessDate(studentAccess.startAt)}</p>}
                    {studentAccess.endAt && <p><strong>종료:</strong> {formatAccessDate(studentAccess.endAt)}</p>}
                    <p className="text-xs text-indigo-700 pt-1">한국 시간 기준</p>
                  </div>
                )}
              </div>
            ) : !currentStudent ? (
              /* Student Login Form */
              <StudentLogin
                roster={roster}
                isLoading={isLoadingStudentData}
                onLogin={handleStudentLogin}
                onRefreshRoster={handleRefreshRoster}
              />
            ) : layoutMode === 'sidebar' ? (
              /* --- SIDEBAR FRAME LAYOUT (Modern Dashboard Shell) --- */
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Navigation Sidebar */}
                <aside className="lg:col-span-4 xl:col-span-3 space-y-4 lg:sticky lg:top-20">
                  {/* Student Identity Card */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                        2학년 {currentStudent.classNum}반 {currentStudent.studentNum}번
                      </span>
                      {currentSubmission?.status === 'completed' && (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full flex items-center gap-1">
                          <Check className="w-3 h-3" /> 제출완료
                        </span>
                      )}
                    </div>
                    <h2 className="font-bold text-slate-900 text-lg flex items-center justify-between">
                      <span>{currentStudent.name} 학생</span>
                      <button
                        onClick={handleStudentLogout}
                        className="text-xs text-slate-500 hover:text-slate-800 font-normal underline flex items-center gap-1"
                        title="다른 학생 로그인"
                      >
                        <LogOut className="w-3.5 h-3.5" /> 로그아웃
                      </button>
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      선택 단원: <span className="font-semibold text-slate-700">{currentSubmission?.step1?.unit || '미선택'}</span>
                    </p>
                  </div>

                  {/* Vertical Step Progress Rail */}
                  <div className="p-3 rounded-xl border border-slate-200 bg-white shadow-xs space-y-1.5">
                    <div className="px-2 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      수행평가 진행 단계
                    </div>

                    {/* Step 1 Button */}
                    <button
                      onClick={() => setActiveStep(1)}
                      className={`w-full p-3 rounded-lg text-left transition-all flex items-center justify-between gap-2 border ${
                        activeStep === 1
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm font-bold'
                          : currentSubmission?.step1
                          ? 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
                          : 'bg-white text-slate-400 border-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 font-bold text-xs ${
                          activeStep === 1 ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                        }`}>1</span>
                        <div className="truncate">
                          <div className="text-[10px] uppercase opacity-80 font-bold">1단계</div>
                          <div className="truncate text-xs font-semibold">학습 내용 정리</div>
                        </div>
                      </div>
                      {currentSubmission?.step1 && (
                        <Check className={`w-4 h-4 shrink-0 ${activeStep === 1 ? 'text-white' : 'text-emerald-600'}`} />
                      )}
                    </button>

                    {/* Step 2 Button */}
                    <button
                      onClick={() => {
                        if (!currentSubmission?.step1) {
                          alert('1단계를 먼저 저장해 주세요.');
                          return;
                        }
                        setActiveStep(2);
                      }}
                      className={`w-full p-3 rounded-lg text-left transition-all flex items-center justify-between gap-2 border ${
                        activeStep === 2
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm font-bold'
                          : currentSubmission?.step2
                          ? 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
                          : 'bg-white text-slate-400 border-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 font-bold text-xs ${
                          activeStep === 2 ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                        }`}>2</span>
                        <div className="truncate">
                          <div className="text-[10px] uppercase opacity-80 font-bold">2단계</div>
                          <div className="truncate text-xs font-semibold">음악 스타일/가사</div>
                        </div>
                      </div>
                      {currentSubmission?.step2 && (
                        <Check className={`w-4 h-4 shrink-0 ${activeStep === 2 ? 'text-white' : 'text-emerald-600'}`} />
                      )}
                    </button>

                    {/* Step 3 Button */}
                    <button
                      onClick={() => {
                        if (!currentSubmission?.step2) {
                          alert('2단계를 먼저 완료해 주세요.');
                          return;
                        }
                        setActiveStep(3);
                      }}
                      className={`w-full p-3 rounded-lg text-left transition-all flex items-center justify-between gap-2 border ${
                        activeStep === 3
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm font-bold'
                          : currentSubmission?.step3
                          ? 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
                          : 'bg-white text-slate-400 border-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 font-bold text-xs ${
                          activeStep === 3 ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                        }`}>3</span>
                        <div className="truncate">
                          <div className="text-[10px] uppercase opacity-80 font-bold">3단계</div>
                          <div className="truncate text-xs font-semibold">가사 자가 수정</div>
                        </div>
                      </div>
                      {currentSubmission?.step3 && (
                        <Check className={`w-4 h-4 shrink-0 ${activeStep === 3 ? 'text-white' : 'text-emerald-600'}`} />
                      )}
                    </button>

                    {/* Step 4 Button */}
                    <button
                      onClick={() => {
                        if (!currentSubmission?.step3) {
                          alert('3단계를 먼저 확인해 주세요.');
                          return;
                        }
                        setActiveStep(4);
                      }}
                      className={`w-full p-3 rounded-lg text-left transition-all flex items-center justify-between gap-2 border ${
                        activeStep === 4
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm font-bold'
                          : currentSubmission?.step4
                          ? 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
                          : 'bg-white text-slate-400 border-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 font-bold text-xs ${
                          activeStep === 4 ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                        }`}>4</span>
                        <div className="truncate">
                          <div className="text-[10px] uppercase opacity-80 font-bold">4단계</div>
                          <div className="truncate text-xs font-semibold">Suno AI & 최종제출</div>
                        </div>
                      </div>
                      {currentSubmission?.step4 && (
                        <Check className={`w-4 h-4 shrink-0 ${activeStep === 4 ? 'text-white' : 'text-emerald-600'}`} />
                      )}
                    </button>
                  </div>

                  {/* Quick Helper Widget */}
                  <div className="p-4 bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 rounded-xl text-xs space-y-1.5 text-indigo-950">
                    <div className="font-bold flex items-center gap-1.5 text-indigo-800">
                      <Sparkles className="w-4 h-4 text-indigo-600" /> 과학송 작성 안내
                    </div>
                    <p className="text-[11px] leading-relaxed text-indigo-900/80">
                      교과서의 과학 개념을 바탕으로 직접 가사를 수정하고 인공지능 음악 프롬프트를 완성해 보세요.
                    </p>
                  </div>
                </aside>

                {/* Right Main Workspace Canvas */}
                <div className="lg:col-span-8 xl:col-span-9">
                  {activeStep === 1 && (
                    <Step1ScienceSummary
                      initialData={currentSubmission?.step1 || null}
                      onSaveStep1={handleSaveStep1}
                    />
                  )}

                  {activeStep === 2 && currentSubmission?.step1 && (
                    <Step2PromptBuilder
                      step1Data={currentSubmission.step1}
                      initialData={currentSubmission.step2 || null}
                      onSaveStep2={handleSaveStep2}
                      onBack={() => setActiveStep(1)}
                    />
                  )}

                  {activeStep === 3 && currentSubmission?.step2 && (
                    <Step3LyricsReview
                      step2Data={currentSubmission.step2}
                      initialData={currentSubmission.step3 || null}
                      onSaveStep3={handleSaveStep3}
                      onBack={() => setActiveStep(2)}
                    />
                  )}

                  {activeStep === 4 && currentSubmission?.step1 && currentSubmission?.step2 && currentSubmission?.step3 && (
                    <Step4SunoSubmission
                      student={currentStudent}
                      step1Data={currentSubmission.step1}
                      step2Data={currentSubmission.step2}
                      step3Data={currentSubmission.step3}
                      initialData={currentSubmission.step4 || null}
                      onSubmitFinal={handleFinalSubmit}
                      onBack={() => setActiveStep(3)}
                      isCompleted={currentSubmission.status === 'completed'}
                    />
                  )}
                </div>
              </div>
            ) : (
              /* --- TOPBAR FRAME LAYOUT --- */
              <div className="space-y-6">
                {/* Student Identity Header Bar */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-xl font-bold text-sm">
                      2학년 {currentStudent.classNum}반 {currentStudent.studentNum}번
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 text-base flex items-center gap-2">
                        {currentStudent.name} 학생
                        {currentSubmission?.status === 'completed' && (
                          <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full flex items-center gap-1">
                            <Check className="w-3 h-3" /> 제출 완료
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">
                        선택 단원: {currentSubmission?.step1?.unit || '미선택'}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleStudentLogout}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all flex items-center gap-1 self-end sm:self-auto"
                  >
                    <LogOut className="w-3.5 h-3.5" /> 다른 학생 로그인
                  </button>
                </div>

                {/* Horizontal Step Indicator Navigation Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-200/70 p-1.5 rounded-xl text-xs font-semibold">
                  <button
                    onClick={() => setActiveStep(1)}
                    className={`p-3 rounded-lg transition-all text-left flex items-center gap-2.5 ${
                      activeStep === 1
                        ? 'bg-blue-600 text-white shadow-sm font-bold'
                        : currentSubmission?.step1
                        ? 'bg-white text-slate-800 hover:bg-slate-50'
                        : 'bg-white/70 text-slate-500'
                    }`}
                  >
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 font-bold text-xs ${
                      activeStep === 1 ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                    }`}>1</span>
                    <div className="truncate">
                      <div className="text-[10px] uppercase opacity-75 font-bold">1단계</div>
                      <div className="truncate font-semibold">학습 내용 정리</div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      if (!currentSubmission?.step1) {
                        alert('1단계를 먼저 저장해 주세요.');
                        return;
                      }
                      setActiveStep(2);
                    }}
                    className={`p-3 rounded-lg transition-all text-left flex items-center gap-2.5 ${
                      activeStep === 2
                        ? 'bg-blue-600 text-white shadow-sm font-bold'
                        : currentSubmission?.step2
                        ? 'bg-white text-slate-800 hover:bg-slate-50'
                        : 'bg-white/70 text-slate-500'
                    }`}
                  >
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 font-bold text-xs ${
                      activeStep === 2 ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                    }`}>2</span>
                    <div className="truncate">
                      <div className="text-[10px] uppercase opacity-75 font-bold">2단계</div>
                      <div className="truncate font-semibold">음악 스타일/가사</div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      if (!currentSubmission?.step2) {
                        alert('2단계를 먼저 완료해 주세요.');
                        return;
                      }
                      setActiveStep(3);
                    }}
                    className={`p-3 rounded-lg transition-all text-left flex items-center gap-2.5 ${
                      activeStep === 3
                        ? 'bg-blue-600 text-white shadow-sm font-bold'
                        : currentSubmission?.step3
                        ? 'bg-white text-slate-800 hover:bg-slate-50'
                        : 'bg-white/70 text-slate-500'
                    }`}
                  >
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 font-bold text-xs ${
                      activeStep === 3 ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                    }`}>3</span>
                    <div className="truncate">
                      <div className="text-[10px] uppercase opacity-75 font-bold">3단계</div>
                      <div className="truncate font-semibold">가사 자가 수정</div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      if (!currentSubmission?.step3) {
                        alert('3단계를 먼저 확인해 주세요.');
                        return;
                      }
                      setActiveStep(4);
                    }}
                    className={`p-3 rounded-lg transition-all text-left flex items-center gap-2.5 ${
                      activeStep === 4
                        ? 'bg-blue-600 text-white shadow-sm font-bold'
                        : currentSubmission?.step4
                        ? 'bg-white text-slate-800 hover:bg-slate-50'
                        : 'bg-white/70 text-slate-500'
                    }`}
                  >
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 font-bold text-xs ${
                      activeStep === 4 ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                    }`}>4</span>
                    <div className="truncate">
                      <div className="text-[10px] uppercase opacity-75 font-bold">4단계</div>
                      <div className="truncate font-semibold">Suno AI & 최종제출</div>
                    </div>
                  </button>
                </div>

                {/* Active Step Workflow Component Rendering */}
                {activeStep === 1 && (
                  <Step1ScienceSummary
                    initialData={currentSubmission?.step1 || null}
                    onSaveStep1={handleSaveStep1}
                  />
                )}

                {activeStep === 2 && currentSubmission?.step1 && (
                  <Step2PromptBuilder
                    step1Data={currentSubmission.step1}
                    initialData={currentSubmission.step2 || null}
                    onSaveStep2={handleSaveStep2}
                    onBack={() => setActiveStep(1)}
                  />
                )}

                {activeStep === 3 && currentSubmission?.step2 && (
                  <Step3LyricsReview
                    step2Data={currentSubmission.step2}
                    initialData={currentSubmission.step3 || null}
                    onSaveStep3={handleSaveStep3}
                    onBack={() => setActiveStep(2)}
                  />
                )}

                {activeStep === 4 && currentSubmission?.step1 && currentSubmission?.step2 && currentSubmission?.step3 && (
                  <Step4SunoSubmission
                    student={currentStudent}
                    step1Data={currentSubmission.step1}
                    step2Data={currentSubmission.step2}
                    step3Data={currentSubmission.step3}
                    initialData={currentSubmission.step4 || null}
                    onSubmitFinal={handleFinalSubmit}
                    onBack={() => setActiveStep(3)}
                    isCompleted={currentSubmission.status === 'completed'}
                  />
                )}
              </div>
            )}
          </div>
        ) : (
          /* Teacher Dashboard View */
          <TeacherDashboard
            settings={settings}
            roster={roster}
            submissions={submissions}
            onUpdateSettings={setSettings}
            onUpdateRoster={setRoster}
            onUpdateSubmissions={setSubmissions}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-12 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4">
          중학교 과학과 (소화, 순환, 호흡, 배설) 디지털 수행평가 및 교사 평가 채점 시스템
        </div>
      </footer>
    </div>
  );
}
