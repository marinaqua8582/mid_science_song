import React from 'react';
import { StudentSubmission, RubricCriterion } from '../types';

interface Props {
  submission: StudentSubmission;
  rubrics: RubricCriterion[];
}

export const PrintableReport: React.FC<Props> = ({ submission, rubrics }) => {
  const { grade, classNum, studentNum, name, step1, step2, step3, step4, evaluation } = submission;

  return (
    <div className="printable-report p-8 max-w-[210mm] mx-auto bg-white text-slate-900 leading-normal font-sans">
      {/* Header */}
      <div className="border-b-2 border-slate-900 pb-4 mb-6 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-black tracking-tight">중학교 과학송 수행평가 평가 결과표</h1>
          <p className="text-xs text-slate-600 mt-1">과학 단원 학습 정리를 바탕으로 한 Gemini AI 가사 비판적 수정 및 음악 수행평가</p>
        </div>
        <div className="text-right text-xs">
          <div className="font-bold text-sm bg-slate-100 px-3 py-1 rounded border border-slate-300 inline-block mb-1">
            2학년 {classNum}반 {studentNum}번 {name}
          </div>
          <div className="text-slate-500">제출일: {step4?.finalSubmittedAt || submission.updatedAt}</div>
        </div>
      </div>

      <div className="space-y-5 text-xs">
        {/* Step 1 Section */}
        <div className="border border-slate-300 rounded p-3 bg-slate-50/50">
          <h2 className="font-bold text-sm text-slate-900 border-b border-slate-200 pb-1 mb-2 flex justify-between">
            <span>[1단계] 과학 학습 정리 및 키워드</span>
            <span className="text-indigo-700">단원: {step1?.unit || '미선택'}</span>
          </h2>
          <div className="space-y-1.5">
            <div>
              <span className="font-semibold text-slate-700">학습 정리 내용:</span>
              <p className="text-slate-800 mt-0.5 whitespace-pre-wrap leading-relaxed">{step1?.summary || '내용 없음'}</p>
            </div>
            <div className="pt-1">
              <span className="font-semibold text-slate-700">핵심 단어 ({step1?.keywords.length || 0}개): </span>
              <span className="font-mono text-indigo-900 font-semibold">{step1?.keywords.join(', ')}</span>
            </div>
          </div>
        </div>

        {/* Step 2 & 3 Side by Side Lyrics Comparison */}
        <div className="grid grid-cols-2 gap-3">
          {/* AI Original */}
          <div className="border border-slate-300 rounded p-3">
            <h3 className="font-bold text-slate-900 border-b border-slate-200 pb-1 mb-1.5 text-xs">
              [2단계] Gemini AI 생성 원본 가사 ({step2?.genre || '장르'})
            </h3>
            <pre className="font-mono text-[10px] text-slate-700 whitespace-pre-wrap leading-relaxed max-h-[220px] overflow-hidden">
              {step2?.generatedLyrics || '생성 내역 없음'}
            </pre>
          </div>

          {/* Student Edited */}
          <div className="border border-slate-300 rounded p-3 bg-teal-50/30">
            <h3 className="font-bold text-teal-950 border-b border-teal-200 pb-1 mb-1.5 text-xs flex justify-between">
              <span>[3단계] 학생 자가 수정 가사</span>
              <span className="text-[10px] text-amber-800 font-bold">
                {step3?.hasSelfEdited ? '(오류 비판적 수정 반영됨)' : '(원본 유지)'}
              </span>
            </h3>
            <pre className="font-mono text-[10px] text-slate-900 whitespace-pre-wrap leading-relaxed max-h-[220px] overflow-hidden font-semibold">
              {step3?.editedLyrics || '수정 내역 없음'}
            </pre>
          </div>
        </div>

        {/* Step 4 Suno Link */}
        <div className="border border-slate-300 rounded p-2.5 flex items-center justify-between">
          <div>
            <span className="font-bold">[4단계] Suno AI 음원 링크: </span>
            <span className="font-mono text-rose-700">{step4?.sunoUrl || '링크 미제출'}</span>
          </div>
        </div>

        {/* Evaluation & Rubric Section */}
        <div className="border-2 border-indigo-600 rounded p-4 bg-indigo-50/20 space-y-3">
          <div className="flex justify-between items-center border-b border-indigo-200 pb-2">
            <h2 className="font-bold text-sm text-indigo-950">교사 평가 종합 채점표</h2>
            <div className="text-base font-black text-indigo-700">
              총점: {evaluation?.totalScore ?? '-'} / {evaluation?.maxScore ?? 30} 점
            </div>
          </div>

          <table className="w-full text-left border-collapse border border-slate-300 bg-white">
            <thead>
              <tr className="bg-slate-100 text-slate-800 border-b border-slate-300 font-bold text-[11px]">
                <th className="p-1.5 border-r border-slate-300">평가 항목</th>
                <th className="p-1.5 border-r border-slate-300">평가 내용 및 기준</th>
                <th className="p-1.5 w-16 text-center">점수</th>
              </tr>
            </thead>
            <tbody>
              {rubrics.map((r) => (
                <tr key={r.id} className="border-b border-slate-200 text-[11px]">
                  <td className="p-1.5 font-bold border-r border-slate-200">{r.title}</td>
                  <td className="p-1.5 text-slate-600 border-r border-slate-200">{r.description}</td>
                  <td className="p-1.5 text-center font-bold text-indigo-900">
                    {evaluation?.scores[r.id] ?? '-'} / {r.maxPoints}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="pt-1">
            <div className="font-bold text-slate-900 mb-1">교사 피드백 / 총평:</div>
            <div className="p-2.5 bg-white border border-slate-300 rounded text-slate-800 min-h-[50px]">
              {evaluation?.feedback || '등록된 피드백이 없습니다.'}
            </div>
          </div>
        </div>
      </div>

      {/* Signature Footer */}
      <div className="mt-8 pt-4 border-t border-slate-300 flex justify-between text-[11px] text-slate-500">
        <div>성남중학교 과학과 수행평가 관리 시스템</div>
        <div>지도교사 확인 : ________________ (인)</div>
      </div>
    </div>
  );
};
