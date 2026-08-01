import React, { useState, useMemo, useEffect } from 'react';
import { StudentRosterItem } from '../types';
import { UserCheck, AlertCircle, LogIn, Sparkles, BookOpen, Loader2 } from 'lucide-react';
import { PrivacyBanner } from './PrivacyBanner';

interface Props {
  roster: StudentRosterItem[];
  isLoading?: boolean;
  onLogin: (student: StudentRosterItem) => void;
  onRefreshRoster?: () => Promise<StudentRosterItem[]>;
}

export const StudentLogin: React.FC<Props> = ({ roster, isLoading = false, onLogin, onRefreshRoster }) => {
  const [selectedClass, setSelectedClass] = useState<number>(0); // 0 means default unselected
  const [selectedNum, setSelectedNum] = useState<number>(0); // 0 means default unselected
  const [nameInput, setNameInput] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Silently refresh roster from Google Sheets on mount if needed
  useEffect(() => {
    if (onRefreshRoster) {
      onRefreshRoster().catch(() => {});
    }
  }, [onRefreshRoster]);

  // Extract available classes strictly based on registered student roster
  const availableClasses = useMemo<number[]>(() => {
    if (!roster || roster.length === 0) return [];
    const classes = roster
      .map(r => Number(r.classNum))
      .filter((c): c is number => !isNaN(c) && c > 0)
      .filter((c, index, self) => self.indexOf(c) === index)
      .sort((a, b) => a - b);
    return classes;
  }, [roster]);

  // Extract available student numbers for selected class strictly based on registered roster
  const availableNumbers = useMemo<number[]>(() => {
    if (selectedClass === 0 || !roster || roster.length === 0) return [];
    const numbers = roster
      .filter(r => Number(r.classNum) === selectedClass)
      .map(r => Number(r.studentNum))
      .filter((n): n is number => !isNaN(n) && n > 0)
      .filter((n, index, self) => self.indexOf(n) === index)
      .sort((a, b) => a - b);
    return numbers;
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
      setErrorMessage('이름을 직접 입력해 주세요.');
      return;
    }

    // Check if there is a student registered in roster for this class and number
    const registeredStudent = roster.find(
      r => Number(r.classNum) === Number(selectedClass) && Number(r.studentNum) === Number(selectedNum)
    );

    if (registeredStudent) {
      // Verify typed name against registered name (space-insensitive)
      const normInput = trimmedName.replace(/\s+/g, '').toLowerCase();
      const normRegistered = registeredStudent.name.replace(/\s+/g, '').toLowerCase();

      if (normInput !== normRegistered) {
        setErrorMessage(`입력하신 이름('${trimmedName}')이 ${selectedClass}반 ${selectedNum}번 명단에 등록된 이름과 일치하지 않습니다. 이름을 올바르게 입력해 주세요.`);
        return;
      }

      onLogin({
        ...registeredStudent,
        name: trimmedName
      });
      return;
    }

    // Fallback if roster is empty or student is not in roster
    const formattedNum = selectedNum < 10 ? `0${selectedNum}` : `${selectedNum}`;
    const dynamicStudent: StudentRosterItem = {
      id: `2-${selectedClass}-${formattedNum}`,
      grade: 2,
      classNum: Number(selectedClass),
      studentNum: Number(selectedNum),
      name: trimmedName,
    };

    onLogin(dynamicStudent);
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
            반과 번호를 선택한 후, 본인의 이름을 직접 입력하고 로그인하세요.
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
                disabled={isLoading || availableClasses.length === 0}
                onChange={(e) => {
                  const c = Number(e.target.value);
                  setSelectedClass(c);
                  setSelectedNum(0); // Reset number selection on class change
                }}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-sm disabled:opacity-60"
              >
                {roster.length === 0 ? (
                  <option value={0}>등록된 학생 명단 없음</option>
                ) : (
                  <option value={0}>-- 반 선택 --</option>
                )}
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
                disabled={selectedClass === 0 || availableNumbers.length === 0 || isLoading}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-sm disabled:opacity-60 disabled:bg-slate-100"
              >
                {selectedClass === 0 ? (
                  <option value={0}>-- 반 선택 필요 --</option>
                ) : availableNumbers.length === 0 ? (
                  <option value={0}>해당 반 번호 없음</option>
                ) : (
                  <option value={0}>-- 번호 선택 --</option>
                )}
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
              disabled={isLoading}
              onChange={(e) => setNameInput(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-sm disabled:opacity-50"
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
            disabled={isLoading}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-75 cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                구글 시트에서 기존 데이터 불러오는 중...
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                수행평가 시작하기
              </>
            )}
          </button>
        </form>
      </div>

      {/* Privacy Notice Banner placed at the bottom */}
      <PrivacyBanner />
    </div>
  );
};

