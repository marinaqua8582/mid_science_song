import React, { useState, useMemo } from 'react';
import { StudentRosterItem } from '../types';
import { UserCheck, AlertCircle, LogIn, Sparkles, BookOpen } from 'lucide-react';
import { PrivacyBanner } from './PrivacyBanner';

interface Props {
  roster: StudentRosterItem[];
  onLogin: (student: StudentRosterItem) => void;
}

export const StudentLogin: React.FC<Props> = ({ roster, onLogin }) => {
  const [selectedClass, setSelectedClass] = useState<number>(0); // 0 means default unselected
  const [selectedNum, setSelectedNum] = useState<number>(0); // 0 means default unselected
  const [nameInput, setNameInput] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Extract available classes from roster
  const availableClasses = useMemo(() => {
    const classes = Array.from(new Set(roster.map(r => Number(r.classNum)))).sort((a: number, b: number) => a - b);
    return classes.length > 0 ? classes : [1, 2, 3];
  }, [roster]);

  // Extract available numbers for selected class
  const availableNumbers = useMemo(() => {
    if (selectedClass === 0) return [];
    const filtered = roster.filter(r => Number(r.classNum) === selectedClass);
    if (filtered.length > 0) {
      return filtered.map(r => Number(r.studentNum)).sort((a: number, b: number) => a - b);
    }
    return Array.from({ length: 30 }, (_, i) => i + 1);
  }, [roster, selectedClass]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (selectedClass === 0) {
      setErrorMessage('반을 선택해 주세요.');
      return;
    }

    if (selectedNum === 0) {
      setErrorMessage('번호를 선택해 주세요.');
      return;
    }

    const trimmedName = nameInput.trim();
    if (!trimmedName) {
      setErrorMessage('이름을 입력해 주세요.');
      return;
    }

    // Find student in roster
    const match = roster.find(
      r => r.classNum === Number(selectedClass) &&
           r.studentNum === Number(selectedNum) &&
           r.name.trim() === trimmedName
    );

    if (match) {
      onLogin(match);
    } else {
      setErrorMessage(`2학년 ${selectedClass}반 ${selectedNum}번 학생 명단에 '${trimmedName}' 학생이 없습니다. 반, 번호, 이름을 정확히 확인해 주세요.`);
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 p-6 md:p-8 transition-all">
        <div className="text-center space-y-3 mb-6">
          <div className="w-14 h-14 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
            <UserCheck className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">학생 로그인</h2>
          <p className="text-sm text-slate-500">
            반, 번호를 선택한 후 이름을 입력하고 수행평가를 시작하세요.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            {/* Class select */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
                학급 (반)
              </label>
              <select
                value={selectedClass}
                onChange={(e) => {
                  const c = Number(e.target.value);
                  setSelectedClass(c);
                  setSelectedNum(0); // Reset number selection on class change
                }}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-sm"
              >
                <option value={0}>--반 선택--</option>
                {availableClasses.map((c) => (
                  <option key={c} value={c}>
                    2학년 {c}반
                  </option>
                ))}
              </select>
            </div>

            {/* Number select */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                번호
              </label>
              <select
                value={selectedNum}
                onChange={(e) => setSelectedNum(Number(e.target.value))}
                disabled={selectedClass === 0}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-sm disabled:opacity-50 disabled:bg-slate-100"
              >
                <option value={0}>--번호 선택--</option>
                {availableNumbers.map((n) => (
                  <option key={n} value={n}>
                    {n}번
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Name Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">이름</label>
            <input
              type="text"
              placeholder="이름을 입력하세요 (예: 김과학)"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-sm"
            />
          </div>

          {/* Error message */}
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700 animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <div className="leading-relaxed font-medium">{errorMessage}</div>
            </div>
          )}

          <button
            type="submit"
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 text-sm"
          >
            <LogIn className="w-4 h-4" />
            수행평가 시작하기
          </button>
        </form>
      </div>

      {/* Privacy Notice Banner placed at the bottom */}
      <PrivacyBanner />
    </div>
  );
};

