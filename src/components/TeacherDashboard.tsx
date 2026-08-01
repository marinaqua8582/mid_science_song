import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { StudentSubmission, StudentRosterItem, AppSettings, RubricCriterion } from '../types';
import { saveRoster, saveSettings, updateSingleSubmission, syncRosterToGAS } from '../utils/storage';
import { PrintableReport } from './PrintableReport';
import { diffLyrics } from '../utils/diff';
import * as XLSX from 'xlsx';
import {
  Lock, KeyRound, Users, FileCheck, Award, Link, Download, Upload,
  Search, Printer, CheckCircle2, Sliders, ExternalLink, Copy, Check,
  Plus, Trash2, Eye, X, RefreshCw, AlertCircle, Save, Sparkles
} from 'lucide-react';

interface Props {
  settings: AppSettings;
  roster: StudentRosterItem[];
  submissions: StudentSubmission[];
  onUpdateSettings: (newSettings: AppSettings) => void;
  onUpdateRoster: (newRoster: StudentRosterItem[]) => void;
  onUpdateSubmissions: (newSubs: StudentSubmission[]) => void;
}

export const TeacherDashboard: React.FC<Props> = ({
  settings,
  roster,
  submissions,
  onUpdateSettings,
  onUpdateRoster,
  onUpdateSubmissions,
}) => {
  // PIN Verification
  const [pinInput, setPinInput] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [pinError, setPinError] = useState<string>('');

  // Password Change state
  const [currentPinInput, setCurrentPinInput] = useState<string>('');
  const [newPinInput, setNewPinInput] = useState<string>('');
  const [confirmPinInput, setConfirmPinInput] = useState<string>('');
  const [pinChangeError, setPinChangeError] = useState<string>('');
  const [pinChangeMsg, setPinChangeMsg] = useState<string>('');

  // Active Tab: 'status' | 'roster' | 'rubrics' | 'gas' | 'password'
  const [activeTab, setActiveTab] = useState<'status' | 'roster' | 'rubrics' | 'gas' | 'password'>('status');

  // Editable Rubrics state for Teacher customization
  const [editableRubrics, setEditableRubrics] = useState<RubricCriterion[]>(settings.rubrics);

  useEffect(() => {
    setEditableRubrics(settings.rubrics);
  }, [settings.rubrics]);

  // Filters for Status view
  const [classFilter, setClassFilter] = useState<string>('all');
  const [unitFilter, setUnitFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Student Detail Modal
  const [selectedStudentSub, setSelectedStudentSub] = useState<StudentSubmission | null>(null);
  const [scoringValues, setScoringValues] = useState<Record<string, number>>({});
  const [feedbackText, setFeedbackText] = useState<string>('');

  // Copy indicator for GAS code
  const [copiedGas, setCopiedGas] = useState<boolean>(false);
  const [gasUrlInput, setGasUrlInput] = useState<string>(settings.gasUrl || '');

  // Handle Rubric Editing
  const handleAddRubric = () => {
    const newRubric: RubricCriterion = {
      id: `rubric-${Date.now()}`,
      title: '새 평가 항목',
      description: '채점 세부 기준 및 내용을 작성하세요.',
      maxPoints: 10
    };
    setEditableRubrics([...editableRubrics, newRubric]);
  };

  const handleUpdateRubric = (id: string, field: keyof RubricCriterion, value: any) => {
    setEditableRubrics(prev =>
      prev.map(r => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const handleDeleteRubric = (id: string) => {
    if (editableRubrics.length <= 1) {
      alert('채점 기준표에는 최소 1개 이상의 평가 항목이 필요합니다.');
      return;
    }
    if (confirm('이 채점 항목을 삭제하시겠습니까?')) {
      setEditableRubrics(prev => prev.filter(r => r.id !== id));
    }
  };

  const handleSaveRubrics = () => {
    for (const r of editableRubrics) {
      if (!r.title.trim()) {
        alert('모든 평가 항목의 제목을 입력해주세요.');
        return;
      }
    }
    const updatedSettings: AppSettings = {
      ...settings,
      rubrics: editableRubrics
    };
    saveSettings(updatedSettings);
    onUpdateSettings(updatedSettings);
    alert('수행평가 채점 기준표가 성공적으로 변경 및 저장되었습니다!');
  };

  // Handle PIN Auth
  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === settings.teacherPin) {
      setIsAuthenticated(true);
      setPinError('');
    } else {
      setPinError('비밀번호가 일치하지 않습니다.');
    }
  };

  // Handle PIN Change
  const handleChangePin = (e: React.FormEvent) => {
    e.preventDefault();
    setPinChangeError('');
    setPinChangeMsg('');

    if (currentPinInput !== settings.teacherPin) {
      setPinChangeError('현재 비밀번호가 일치하지 않습니다.');
      return;
    }
    if (!newPinInput.trim()) {
      setPinChangeError('새 비밀번호를 입력해주세요.');
      return;
    }
    if (newPinInput !== confirmPinInput) {
      setPinChangeError('새 비밀번호와 확인 입력이 일치하지 않습니다.');
      return;
    }

    const updatedSettings = {
      ...settings,
      teacherPin: newPinInput.trim()
    };

    saveSettings(updatedSettings);
    onUpdateSettings(updatedSettings);

    setCurrentPinInput('');
    setNewPinInput('');
    setConfirmPinInput('');
    setPinChangeMsg('비밀번호가 성공적으로 변경되었습니다!');
  };

  // Open Student Modal for Grading / Viewing
  const handleOpenDetailModal = (sub: StudentSubmission) => {
    setSelectedStudentSub(sub);
    const initialScores: Record<string, number> = {};
    settings.rubrics.forEach(r => {
      initialScores[r.id] = sub.evaluation?.scores[r.id] ?? r.maxPoints;
    });
    setScoringValues(initialScores);
    setFeedbackText(sub.evaluation?.feedback || '');
  };

  // Save Teacher Evaluation
  const handleSaveEvaluation = () => {
    if (!selectedStudentSub) return;

    let total = 0;
    let maxTotal = 0;
    settings.rubrics.forEach(r => {
      const s = scoringValues[r.id] ?? 0;
      total += s;
      maxTotal += r.maxPoints;
    });

    const updated: StudentSubmission = {
      ...selectedStudentSub,
      evaluation: {
        scores: scoringValues,
        totalScore: total,
        maxScore: maxTotal,
        feedback: feedbackText,
        evaluatedAt: new Date().toLocaleString('ko-KR')
      }
    };

    updateSingleSubmission(updated);

    // Update parent state
    const newSubs = submissions.map(s => s.id === updated.id ? updated : s);
    onUpdateSubmissions(newSubs);
    setSelectedStudentSub(updated);
    alert('평가 점수 및 피드백이 성공적으로 저장되었습니다!');
  };

  // Download Excel Sample Roster
  const handleDownloadSampleExcel = () => {
    const sampleData = [
      { 학년: 2, 반: 1, 번호: 1, 이름: '강민준' },
      { 학년: 2, 반: 1, 번호: 2, 이름: '김서연' },
      { 학년: 2, 반: 1, 번호: 3, 이름: '박도현' },
      { 학년: 2, 반: 2, 번호: 1, 이름: '권우진' },
      { 학년: 2, 반: 2, 번호: 2, 이름: '김나은' }
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '명단샘플');
    XLSX.writeFile(workbook, '과학_수행평가_학생명단_양식.xlsx');
  };

  // Upload Excel Roster
  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json: any[] = XLSX.utils.sheet_to_json(worksheet);

        const newRosterItems: StudentRosterItem[] = json.map((row, idx) => {
          const g = Number(row['학년'] || 2);
          const c = Number(row['반'] || 1);
          const n = Number(row['번호'] || (idx + 1));
          const nameStr = String(row['이름'] || '').trim();
          return {
            id: `${g}-${c}-${n < 10 ? '0' + n : n}`,
            grade: g,
            classNum: c,
            studentNum: n,
            name: nameStr
          };
        }).filter(item => item.name.length > 0);

        if (newRosterItems.length === 0) {
          alert('올바른 학생 명단 데이터를 찾을 수 없습니다.');
          return;
        }

        saveRoster(newRosterItems);
        onUpdateRoster(newRosterItems);

        if (settings.gasUrl) {
          syncRosterToGAS(settings.gasUrl, newRosterItems);
        }

        alert(`총 ${newRosterItems.length}명의 학생 명단이 새로 등록되었습니다!`);
      } catch (err) {
        console.error('Excel upload error:', err);
        alert('엑셀 파일 분석 중 오류가 발생했습니다. 양식을 확인해주세요.');
      }
    };
    reader.readAsBinaryString(file);
  };

  // Copy GAS Code
  const handleCopyGasCode = async () => {
    try {
      const res = await fetch('/api/gas-code');
      const text = await res.text();
      await navigator.clipboard.writeText(text);
      setCopiedGas(true);
      setTimeout(() => setCopiedGas(false), 2000);
    } catch (e) {
      alert('구글 앱스 스크립트 코드 복사 중 오류가 발생했습니다.');
    }
  };

  // Save GAS Settings
  const handleSaveGasSettings = () => {
    const newSettings = { ...settings, gasUrl: gasUrlInput.trim() };
    saveSettings(newSettings);
    onUpdateSettings(newSettings);
    alert('Google Sheets / GAS 설정이 저장되었습니다.');
  };

  // Helper to determine status key
  const getStatusKey = (sub: StudentSubmission): 'completed' | 'step3' | 'step2' | 'step1' | 'not_started' => {
    if (sub.status === 'completed' || sub.step4?.finalSubmittedAt) return 'completed';
    if (sub.status === 'step3' || sub.step3) return 'step3';
    if (sub.status === 'step2' || sub.step2) return 'step2';
    if (sub.status === 'step1' || sub.status === 'step1_saved' || sub.step1) return 'step1';
    return 'not_started';
  };

  // Filter Submissions
  const filteredSubmissions = submissions.filter(sub => {
    if (classFilter !== 'all' && sub.classNum !== Number(classFilter)) return false;
    if (unitFilter !== 'all' && sub.step1?.unit !== unitFilter) return false;
    if (statusFilter !== 'all' && getStatusKey(sub) !== statusFilter) return false;
    if (searchQuery.trim() && !sub.name.includes(searchQuery.trim())) return false;
    return true;
  });

  // PIN Protection Gate Screen
  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto my-12 bg-white rounded-2xl shadow-xl border border-slate-200/80 p-8 text-center space-y-6">
        <div className="w-16 h-16 bg-slate-900 text-white rounded-2xl flex items-center justify-center mx-auto shadow-md">
          <Lock className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">교사 인증 (PIN 입력)</h2>
          <p className="text-sm text-slate-500 mt-1">
            교사 전용 평가 관리 대시보드 접근을 위해 비밀번호를 입력하세요.
          </p>
        </div>

        <form onSubmit={handlePinSubmit} className="space-y-4">
          <div className="relative">
            <KeyRound className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="password"
              placeholder=""
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-xl font-mono text-center text-lg tracking-widest focus:ring-2 focus:ring-slate-800 focus:outline-none"
            />
          </div>

          {pinError && (
            <div className="text-xs text-red-600 font-semibold">{pinError}</div>
          )}

          <button
            type="submit"
            className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-md transition-all text-sm"
          >
            대시보드 접속하기
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Teacher Navigation Sidebar */}
      <aside className="lg:col-span-4 xl:col-span-3 space-y-4 lg:sticky lg:top-20">
        {/* Admin Header Info Card */}
        <div className="bg-slate-900 text-white rounded-xl p-5 shadow-sm border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="px-2.5 py-0.5 bg-blue-600 text-white text-[10px] font-bold rounded uppercase tracking-wider">
              관리자 모드
            </span>
            <span className="text-[10px] text-slate-400 font-medium">교사 전용</span>
          </div>
          <h2 className="text-base font-bold tracking-tight text-white">과학송 평가 대시보드</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            학생 명단 관리, 제출물 채점 및 A4 보고서 출력, 구글 시트 평가 연동
          </p>
        </div>

        {/* Sidebar Navigation Menu */}
        <div className="bg-white rounded-xl p-2.5 border border-slate-200 shadow-xs space-y-1">
          <div className="px-2.5 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            메뉴 및 평가 관리
          </div>

          {/* Tab 1: Submission Status */}
          <button
            onClick={() => setActiveTab('status')}
            className={`w-full p-3 rounded-lg text-left transition-all flex items-center justify-between gap-2 text-xs font-semibold border ${
              activeTab === 'status'
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm font-bold'
                : 'bg-white text-slate-700 border-transparent hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <FileCheck className="w-4 h-4" />
              <span>제출 현황 및 채점</span>
            </div>
            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
              activeTab === 'status' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
            }`}>
              {submissions.length}명
            </span>
          </button>

          {/* Tab 2: Roster */}
          <button
            onClick={() => setActiveTab('roster')}
            className={`w-full p-3 rounded-lg text-left transition-all flex items-center justify-between gap-2 text-xs font-semibold border ${
              activeTab === 'roster'
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm font-bold'
                : 'bg-white text-slate-700 border-transparent hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Users className="w-4 h-4" />
              <span>학생 명단 관리</span>
            </div>
            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
              activeTab === 'roster' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
            }`}>
              {roster.length}명
            </span>
          </button>

          {/* Tab 3: Rubrics */}
          <button
            onClick={() => setActiveTab('rubrics')}
            className={`w-full p-3 rounded-lg text-left transition-all flex items-center justify-between gap-2 text-xs font-semibold border ${
              activeTab === 'rubrics'
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm font-bold'
                : 'bg-white text-slate-700 border-transparent hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Award className="w-4 h-4" />
              <span>수행평가 채점 기준표</span>
            </div>
          </button>

          {/* Tab 4: Google Sheets Integration */}
          <button
            onClick={() => setActiveTab('gas')}
            className={`w-full p-3 rounded-lg text-left transition-all flex items-center justify-between gap-2 text-xs font-semibold border ${
              activeTab === 'gas'
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm font-bold'
                : 'bg-white text-slate-700 border-transparent hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Link className="w-4 h-4" />
              <span>구글 시트 실시간 연동</span>
            </div>
            {settings.gasUrl ? (
              <span className="w-2 h-2 rounded-full bg-emerald-500" title="연동 완료" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-slate-300" title="미연동" />
            )}
          </button>

          {/* Tab 5: Password Change */}
          <button
            onClick={() => setActiveTab('password')}
            className={`w-full p-3 rounded-lg text-left transition-all flex items-center justify-between gap-2 text-xs font-semibold border ${
              activeTab === 'password'
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm font-bold'
                : 'bg-white text-slate-700 border-transparent hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <KeyRound className="w-4 h-4" />
              <span>교사 비밀번호 변경</span>
            </div>
          </button>
        </div>

        {/* Quick Summary Widget */}
        <div className="p-4 bg-slate-900 text-white rounded-xl border border-slate-800 space-y-2 text-xs">
          <div className="font-bold flex items-center gap-1.5 text-slate-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            제출 현황 요약
          </div>
          <div className="grid grid-cols-2 gap-2 text-center pt-1">
            <div className="p-2 bg-slate-800 rounded-lg">
              <div className="text-[10px] text-slate-400">등록 학생</div>
              <div className="font-bold text-sm text-slate-100">{roster.length}명</div>
            </div>
            <div className="p-2 bg-slate-800 rounded-lg">
              <div className="text-[10px] text-slate-400">제출 완료</div>
              <div className="font-bold text-sm text-emerald-400">
                {submissions.filter(s => s.status === 'completed').length}명
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Right Main Workspace Canvas */}
      <main className="lg:col-span-8 xl:col-span-9 space-y-6">
        {/* TAB 1: SUBMISSION STATUS & RESULTS */}
        {activeTab === 'status' && (
        <div className="space-y-6">
          {/* Status Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-xs text-slate-500 font-medium">전체 등록 학생</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">{roster.length}명</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-xs text-slate-500 font-medium">최종 제출 완료</div>
              <div className="text-2xl font-bold text-emerald-600 mt-1">
                {submissions.filter(s => s.status === 'completed').length}명
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-xs text-slate-500 font-medium">1단계 진행 중</div>
              <div className="text-2xl font-bold text-amber-600 mt-1">
                {submissions.filter(s => s.status === 'step1_saved').length}명
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-xs text-slate-500 font-medium">채점 완료 학생</div>
              <div className="text-2xl font-bold text-indigo-600 mt-1">
                {submissions.filter(s => s.evaluation !== null).length}명
              </div>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap gap-3 items-center justify-between">
            <div className="flex flex-wrap gap-2 items-center text-xs">
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-medium focus:outline-none"
              >
                <option value="all">전체 학급 (반)</option>
                <option value="1">1반</option>
                <option value="2">2반</option>
                <option value="3">3반</option>
              </select>

              <select
                value={unitFilter}
                onChange={(e) => setUnitFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-medium focus:outline-none"
              >
                <option value="all">전체 과학 단원</option>
                <option value="소화">소화</option>
                <option value="순환">순환</option>
                <option value="호흡">호흡</option>
                <option value="배설">배설</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-medium focus:outline-none"
              >
                <option value="all">전체 상태</option>
                <option value="completed">최종 완료</option>
                <option value="step1">1단계 완료</option>
                <option value="step2">2단계 완료</option>
                <option value="step3">3단계 완료</option>
                <option value="not_started">미작성</option>
              </select>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="학생 이름 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:outline-none focus:bg-white"
              />
            </div>
          </div>

          {/* Submissions Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <th className="p-3">학급 / 번호</th>
                    <th className="p-3">이름</th>
                    <th className="p-3">단원</th>
                    <th className="p-3">제출 상태</th>
                    <th className="p-3">Suno 음원</th>
                    <th className="p-3">교사 채점</th>
                    <th className="p-3 text-right">상세 조회</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-800">
                  {filteredSubmissions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">
                        검색 조건에 해당되는 수행평가 제출 내역이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    filteredSubmissions.map((sub) => (
                      <tr key={sub.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 font-semibold">
                          2-{sub.classNum}-{sub.studentNum < 10 ? '0' + sub.studentNum : sub.studentNum}
                        </td>
                        <td className="p-3 font-bold text-slate-900">{sub.name}</td>
                        <td className="p-3">
                          {sub.step1?.unit ? (
                            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded font-semibold">
                              {sub.step1.unit}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="p-3">
                          {(() => {
                            const key = getStatusKey(sub);
                            switch (key) {
                              case 'completed':
                                return <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold">최종 완료</span>;
                              case 'step3':
                                return <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-semibold">3단계 완료</span>;
                              case 'step2':
                                return <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded font-semibold">2단계 완료</span>;
                              case 'step1':
                                return <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-semibold">1단계 완료</span>;
                              default:
                                return <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded">미작성</span>;
                            }
                          })()}
                        </td>
                        <td className="p-3">
                          {sub.step4?.sunoUrl ? (
                            <a
                              href={sub.step4.sunoUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-rose-600 hover:underline flex items-center gap-1 font-medium"
                            >
                              음원 링크 <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="text-slate-400">없음</span>
                          )}
                        </td>
                        <td className="p-3">
                          {sub.evaluation ? (
                            <span className="font-bold text-indigo-700">
                              {sub.evaluation.totalScore} / {sub.evaluation.maxScore}점
                            </span>
                          ) : (
                            <span className="text-slate-400">채점전</span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => handleOpenDetailModal(sub)}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-semibold transition-all inline-flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" /> 상세보기/채점
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ROSTER MANAGEMENT */}
      {activeTab === 'roster' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900">학생 명단 관리</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                수행평가를 진행할 학생 명단을 엑셀 파일(.xlsx / .csv)로 일괄 등록합니다.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleDownloadSampleExcel}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5"
              >
                <Download className="w-4 h-4" /> 엑셀 샘플 양식 다운로드
              </button>

              <label className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer">
                <Upload className="w-4 h-4" /> 엑셀 파일 업로드
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleExcelUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Roster Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <th className="p-3">식별 ID</th>
                  <th className="p-3">학년</th>
                  <th className="p-3">학급 (반)</th>
                  <th className="p-3">번호</th>
                  <th className="p-3">이름</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800 font-medium">
                {roster.map((student) => (
                  <tr key={student.id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono text-slate-500">{student.id}</td>
                    <td className="p-3">{student.grade}학년</td>
                    <td className="p-3 font-semibold text-indigo-700">{student.classNum}반</td>
                    <td className="p-3">{student.studentNum}번</td>
                    <td className="p-3 font-bold text-slate-900">{student.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: RUBRICS CONFIGURATION */}
      {activeTab === 'rubrics' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900">수행평가 채점 기준표 (Rubric) 설정 및 편집</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                교사가 과목 및 수행평가 목적에 맞춰 평가 항목, 내용 및 배점 기준을 직접 추가·수정할 수 있습니다.
              </p>
            </div>

            <button
              onClick={handleAddRubric}
              className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shrink-0 self-start sm:self-auto border border-indigo-200"
            >
              <Plus className="w-4 h-4" /> 채점 항목 추가
            </button>
          </div>

          <div className="space-y-4">
            {editableRubrics.map((rubric, idx) => (
              <div key={rubric.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-xs font-bold text-slate-500 shrink-0">항목 {idx + 1}</span>
                    <input
                      type="text"
                      value={rubric.title}
                      onChange={(e) => handleUpdateRubric(rubric.id, 'title', e.target.value)}
                      placeholder="평가 항목 제목 (예: 과학 지식 이해도)"
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-xs font-semibold text-slate-600">배점 만점:</span>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={rubric.maxPoints}
                        onChange={(e) => handleUpdateRubric(rubric.id, 'maxPoints', Number(e.target.value))}
                        className="w-16 px-2 py-1 bg-white border border-slate-300 rounded-lg text-center text-xs font-bold text-indigo-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                      <span className="text-xs font-bold text-slate-600">점</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteRubric(rubric.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all shrink-0"
                      title="항목 삭제"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-500 mb-1 block">평가 세부 기준 및 내용</label>
                  <textarea
                    rows={2}
                    value={rubric.description}
                    onChange={(e) => handleUpdateRubric(rubric.id, 'description', e.target.value)}
                    placeholder="해당 평가 항목에 대한 구체적인 채점 기준을 작성하세요."
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-200">
            <button
              onClick={handleSaveRubrics}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow transition-all text-xs flex items-center gap-2"
            >
              <Save className="w-4 h-4" /> 채점 기준표 변경사항 저장
            </button>
          </div>
        </div>
      )}

      {/* TAB 4: GOOGLE SHEETS & GAS SETUP */}
      {activeTab === 'gas' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Google Sheets 및 GAS 웹 앱 연동</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Google Apps Script Web App URL을 설정하여 수행평가 데이터를 실시간 자동 동기화합니다.
            </p>
          </div>

          {/* URL Input Form */}
          <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
            <label className="text-xs font-bold text-slate-800 block">
              Google Apps Script 배포 URL (Web App URL)
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={gasUrlInput}
                onChange={(e) => setGasUrlInput(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="flex-1 px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              <button
                onClick={handleSaveGasSettings}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow transition-all shrink-0 flex items-center gap-1"
              >
                <Save className="w-4 h-4" /> URL 저장
              </button>
            </div>
            {settings.gasUrl && (
              <div className="flex items-center gap-2 pt-1 text-xs text-emerald-700 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Google Sheets 연결 설정 완료
              </div>
            )}
          </div>

          {/* GAS Instructions */}
          <div className="p-5 bg-indigo-50/60 border border-indigo-200 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-bold text-sm text-indigo-950">
                구글 시트 연동용 Apps Script 소스 코드
              </div>
              <button
                onClick={handleCopyGasCode}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow transition-all flex items-center gap-1"
              >
                {copiedGas ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedGas ? '복사 완료!' : '스크립트 코드 복사'}
              </button>
            </div>
            <p className="text-xs text-indigo-900 leading-relaxed">
              1) 사용 중인 Google Sheets 문서에서 [확장 프로그램] &gt; [Apps Script]를 클릭합니다.<br />
              2) 위 버튼으로 복사한 코드를 기주 편집기에 붙여넣고 저장합니다.<br />
              3) [배포] &gt; [새 배포] &gt; 유형: [웹 앱] 선택 후 <strong>'액세스 권한: 모든 사용자(Anyone)'</strong>로 설정하여 배포한 URL을 입력 칸에 붙여넣으세요.
            </p>
          </div>
        </div>
      )}

      {/* TAB 5: TEACHER PASSWORD CHANGE */}
      {activeTab === 'password' && (
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-6 md:p-8 space-y-6 max-w-xl">
          <div className="border-b border-slate-200 pb-4">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-indigo-600" />
              교사 대시보드 비밀번호 변경
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              교사 전용 대시보드 접근용 비밀번호를 새로 설정할 수 있습니다.
            </p>
          </div>

          <form onSubmit={handleChangePin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">현재 비밀번호</label>
              <input
                type="password"
                value={currentPinInput}
                onChange={(e) => setCurrentPinInput(e.target.value)}
                placeholder="현재 비밀번호 입력"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">새 비밀번호</label>
              <input
                type="password"
                value={newPinInput}
                onChange={(e) => setNewPinInput(e.target.value)}
                placeholder="새로 설정할 비밀번호 입력"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">새 비밀번호 확인</label>
              <input
                type="password"
                value={confirmPinInput}
                onChange={(e) => setConfirmPinInput(e.target.value)}
                placeholder="새 비밀번호 다시 입력"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            {pinChangeError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                {pinChangeError}
              </div>
            )}

            {pinChangeMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                {pinChangeMsg}
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow transition-all text-sm flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" /> 비밀번호 변경 저장
            </button>
          </form>
        </div>
      )}

      {/* STUDENT DETAIL & SCORING MODAL */}
      {selectedStudentSub && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-slate-200">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-slate-200 p-5 flex items-center justify-between z-10">
              <div>
                <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-800 text-xs font-bold rounded-md">
                  수행평가 상세 보기 & 채점
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-1">
                  2학년 {selectedStudentSub.classNum}반 {selectedStudentSub.studentNum}번 {selectedStudentSub.name}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl shadow transition-all flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" /> A4 종이 인쇄 / PDF 저장
                </button>
                <button
                  onClick={() => setSelectedStudentSub(null)}
                  className="p-2 text-slate-400 hover:text-slate-800 rounded-xl"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Step 1-4 Overview */}
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                  <div className="font-bold text-xs text-indigo-900">
                    [1단계] 과학 학습 정리 - 단원: {selectedStudentSub.step1?.unit}
                  </div>
                  <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                    {selectedStudentSub.step1?.summary || '미작성'}
                  </p>
                  <div className="flex flex-wrap gap-1 pt-1 text-[11px]">
                    {selectedStudentSub.step1?.keywords.map(k => (
                      <span key={k} className="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded font-medium">
                        #{k}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Step 2 Prompt Inputs */}
                <div className="p-4 bg-purple-50 border border-purple-200 rounded-2xl space-y-2 text-xs">
                  <div className="flex items-center justify-between border-b border-purple-200 pb-1.5">
                    <span className="font-bold text-purple-950 flex items-center gap-1.5 text-xs">
                      <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                      [2단계] 프롬프트 작성 내용 (음악 스타일 & 가사 구조)
                    </span>
                    <span className="px-2.5 py-0.5 bg-purple-600 text-white font-bold rounded-md text-[11px]">
                      장르: {selectedStudentSub.step2?.genre || '미선택'}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                    <div className="bg-white p-2.5 rounded-xl border border-purple-100 shadow-xs space-y-1">
                      <span className="font-bold text-purple-900 block text-[11px]">① 가사 구조 설계</span>
                      <p className="text-slate-700 whitespace-pre-wrap leading-relaxed text-[11px]">
                        {selectedStudentSub.step2?.structurePrompt || '미작성'}
                      </p>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-purple-100 shadow-xs space-y-1">
                      <span className="font-bold text-purple-900 block text-[11px]">② 상황 설정</span>
                      <p className="text-slate-700 whitespace-pre-wrap leading-relaxed text-[11px]">
                        {selectedStudentSub.step2?.situationPrompt || '미작성'}
                      </p>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-purple-100 shadow-xs space-y-1">
                      <span className="font-bold text-purple-900 block text-[11px]">③ 추가 요구사항</span>
                      <p className="text-slate-700 whitespace-pre-wrap leading-relaxed text-[11px]">
                        {selectedStudentSub.step2?.customPrompt || '미작성'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-purple-950 text-purple-100 rounded-2xl font-mono text-xs space-y-1">
                    <div className="font-bold text-purple-300 border-b border-purple-800 pb-1 mb-2">
                      [2단계] Gemini AI 생성 가사 ({selectedStudentSub.step2?.genre})
                    </div>
                    <pre className="whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                      {selectedStudentSub.step2?.generatedLyrics || '미생성'}
                    </pre>
                  </div>

                  <div className="p-4 bg-teal-950 text-teal-100 rounded-2xl font-mono text-xs space-y-1">
                    <div className="font-bold text-teal-300 border-b border-teal-800 pb-1 mb-2 flex justify-between">
                      <span>[3단계] 학생 자가 수정 가사</span>
                      <span className="text-amber-400 font-bold">
                        {selectedStudentSub.step3?.hasSelfEdited ? '(수정 부분 밑줄 표시됨)' : '(원본 유지)'}
                      </span>
                    </div>
                    <div className="whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto font-sans">
                      {diffLyrics(selectedStudentSub.step2?.generatedLyrics || '', selectedStudentSub.step3?.editedLyrics || '').map((chunk, idx) =>
                        chunk.isModified ? (
                          <u
                            key={idx}
                            className="underline underline-offset-2 decoration-amber-400 decoration-2 font-bold text-white bg-amber-500/30 px-0.5 rounded-xs"
                            title="학생이 새로 수정/추가한 부분"
                          >
                            {chunk.text}
                          </u>
                        ) : (
                          <span key={idx}>{chunk.text}</span>
                        )
                      )}
                    </div>
                  </div>
                </div>

                {selectedStudentSub.step4?.sunoUrl && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs flex items-center justify-between">
                    <span className="font-bold text-rose-950">Suno AI 음원 URL:</span>
                    <a
                      href={selectedStudentSub.step4.sunoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-rose-700 underline font-semibold flex items-center gap-1"
                    >
                      {selectedStudentSub.step4.sunoUrl} <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>

              {/* Rubric Scoring Form */}
              <div className="p-6 bg-indigo-50/60 border-2 border-indigo-200 rounded-2xl space-y-4">
                <h4 className="font-bold text-sm text-indigo-950 flex items-center gap-2">
                  <Award className="w-5 h-5 text-indigo-600" />
                  교사 수행평가 채점 및 총평 기록
                </h4>

                <div className="space-y-3">
                  {settings.rubrics.map((rubric) => (
                    <div key={rubric.id} className="p-3.5 bg-white border border-indigo-100 rounded-xl space-y-1">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                        <span>{rubric.title}</span>
                        <div className="flex items-center gap-1 text-indigo-900">
                          <input
                            type="number"
                            min={0}
                            max={rubric.maxPoints}
                            value={scoringValues[rubric.id] ?? rubric.maxPoints}
                            onChange={(e) => {
                              const val = Math.min(rubric.maxPoints, Math.max(0, Number(e.target.value)));
                              setScoringValues({ ...scoringValues, [rubric.id]: val });
                            }}
                            className="w-16 px-2 py-1 bg-slate-50 border border-slate-300 rounded text-center font-bold"
                          />
                          <span>/ {rubric.maxPoints}점</span>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-500">{rubric.description}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-800">교사 피드백 및 총평</label>
                  <textarea
                    rows={3}
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    placeholder="학생의 지식 이해도 및 AI 가사 오류 수정 능력을 칭찬하고 발전 방향을 기술하세요."
                    className="w-full p-3 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleSaveEvaluation}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow transition-all text-xs flex items-center gap-1.5"
                  >
                    <Save className="w-4 h-4" /> 평가 채점 저장
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Portal for isolated print view */}
      {selectedStudentSub && typeof document !== 'undefined' && document.getElementById('print-root') && createPortal(
        <PrintableReport
          submission={selectedStudentSub}
          rubrics={settings.rubrics}
        />,
        document.getElementById('print-root')!
      )}
      </main>
    </div>
  );
};
