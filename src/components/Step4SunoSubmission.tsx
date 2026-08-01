import React, { useState, useEffect } from 'react';
import { Step1Data, Step2Data, Step3Data, Step4Data, StudentRosterItem } from '../types';
import { Music2, ExternalLink, Copy, Check, Send, ArrowLeft, CheckCircle2, FileText, Clock } from 'lucide-react';

interface Props {
  student: StudentRosterItem;
  step1Data: Step1Data;
  step2Data: Step2Data;
  step3Data: Step3Data;
  initialData: Step4Data | null;
  onSubmitFinal: (data: Step4Data, isFinalAlert?: boolean) => void;
  onBack: () => void;
  isCompleted: boolean;
}

export const Step4SunoSubmission: React.FC<Props> = ({
  student,
  step1Data,
  step2Data,
  step3Data,
  initialData,
  onSubmitFinal,
  onBack,
  isCompleted
}) => {
  const [sunoUrl, setSunoUrl] = useState<string>(initialData?.sunoUrl || '');
  const [copiedPrompt, setCopiedPrompt] = useState<boolean>(false);
  const [copiedLyrics, setCopiedLyrics] = useState<boolean>(false);

  const handleCopyPromptStyle = () => {
    const text = `${step2Data.genre}, middle school science song, upbeat, clear vocals, ${step2Data.situationPrompt}`;
    navigator.clipboard.writeText(text);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const handleCopyFinalLyrics = () => {
    navigator.clipboard.writeText(step3Data.editedLyrics);
    setCopiedLyrics(true);
    setTimeout(() => setCopiedLyrics(false), 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nowStr = new Date().toLocaleString('ko-KR');
    const data: Step4Data = {
      sunoUrl: sunoUrl.trim(),
      finalSubmittedAt: nowStr
    };
    onSubmitFinal(data);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8 space-y-8">
      <div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-rose-700 text-xs font-bold rounded-full mb-2">
          4단계 수행평가
        </div>
        <h3 className="text-xl md:text-2xl font-bold text-slate-800">
          Suno AI 음악 제작 & 최종 수행평가 제출
        </h3>
        <p className="text-sm text-slate-500 mt-1">
          최종 작성 내용을 확인하고, Suno AI 음원 생성(선택) 후 수행평가를 최종 제출합니다.
        </p>
      </div>

      {/* 1. Submission Summary Card (Top Section) */}
      <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 pb-3 gap-2">
          <span className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-indigo-600" />
            최종 제출 내용 요약 확인
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-100 text-indigo-800 rounded-lg">
              2학년 {student.classNum}반 {student.studentNum}번 {student.name}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
            <div className="font-bold text-slate-700">과학 단원 & 학습 정리:</div>
            <div className="text-indigo-900 font-bold">[{step1Data.unit}]</div>
            <p className="text-slate-600 line-clamp-3">{step1Data.summary}</p>
          </div>

          <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
            <div className="font-bold text-slate-700">음악 장르 & 프롬프트:</div>
            <div className="text-purple-900 font-bold">{step2Data.genre}</div>
            <p className="text-slate-600 line-clamp-3">{step2Data.situationPrompt}</p>
          </div>
        </div>

        <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1 text-xs">
          <div className="font-bold text-slate-700 flex items-center justify-between">
            <span>최종 가사 ({step3Data.hasSelfEdited ? '자가 수정됨' : 'AI 원본'})</span>
          </div>
          <pre className="font-mono text-[11px] text-slate-700 whitespace-pre-wrap max-h-32 overflow-y-auto leading-relaxed">
            {step3Data.editedLyrics}
          </pre>
        </div>
      </div>

      {/* 2. Suno AI Guide & Song Link Input Form (Bottom Section) */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Suno AI Guide Box */}
        <div className="p-6 bg-gradient-to-br from-rose-50 to-orange-50 border border-rose-200/80 rounded-2xl space-y-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-rose-950 font-bold text-base">
              <Music2 className="w-5 h-5 text-rose-600" />
              Suno AI (suno.com) 음악 생성 가이드
            </div>
            <a
              href="https://suno.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md transition-all shrink-0"
            >
              Suno AI 바로가기 <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={handleCopyPromptStyle}
              className="p-3 bg-white border border-rose-200 rounded-xl hover:border-rose-400 text-left transition-all flex items-center justify-between"
            >
              <div>
                <div className="text-xs font-bold text-slate-800">1. 음악 스타일 프롬프트 복사</div>
                <div className="text-[11px] text-slate-500">{step2Data.genre} 스타일 기반</div>
              </div>
              <span className="px-2.5 py-1 bg-rose-100 text-rose-800 text-xs font-bold rounded-lg flex items-center gap-1">
                {copiedPrompt ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                {copiedPrompt ? '복사됨' : '복사'}
              </span>
            </button>

            <button
              type="button"
              onClick={handleCopyFinalLyrics}
              className="p-3 bg-white border border-rose-200 rounded-xl hover:border-rose-400 text-left transition-all flex items-center justify-between"
            >
              <div>
                <div className="text-xs font-bold text-slate-800">2. 최종 수정 가사 복사</div>
                <div className="text-[11px] text-slate-500">자가 수정 반영본</div>
              </div>
              <span className="px-2.5 py-1 bg-rose-100 text-rose-800 text-xs font-bold rounded-lg flex items-center gap-1">
                {copiedLyrics ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                {copiedLyrics ? '복사됨' : '복사'}
              </span>
            </button>
          </div>
        </div>

        {/* Suno Song URL Input */}
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-800 flex items-center justify-between">
            <span>Suno AI 완성곡 공유 링크 입력 (선택사항)</span>
            <span className="text-xs text-slate-500 font-normal">
              * 링크가 없어도 제출 가능합니다.
            </span>
          </label>
          <input
            type="url"
            value={sunoUrl}
            onChange={(e) => setSunoUrl(e.target.value)}
            placeholder="https://suno.com/song/..."
            className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl font-mono text-sm text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-rose-500 focus:bg-white focus:outline-none"
          />
        </div>

        {/* Completion Banner */}
        {(isCompleted || initialData?.finalSubmittedAt) && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1 text-emerald-900 text-sm">
            <div className="flex items-center gap-2 font-bold">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>수행평가가 성공적으로 제출(수정)되었습니다!</span>
            </div>
            {initialData?.finalSubmittedAt && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-700 pl-7 font-medium">
                <Clock className="w-3.5 h-3.5" />
                <span>마지막 제출 일시: <strong className="font-bold underline">{initialData.finalSubmittedAt}</strong></span>
              </div>
            )}
          </div>
        )}

        {/* Bottom Actions */}
        <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-all text-sm flex items-center justify-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            3단계로 이전
          </button>

          <button
            type="submit"
            className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 text-base"
          >
            <Send className="w-5 h-5" />
            {isCompleted ? '수행평가 다시 제출하기' : '최종 수행평가 제출하기'}
          </button>
        </div>
      </form>
    </div>
  );
};

