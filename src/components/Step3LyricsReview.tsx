import React, { useState } from 'react';
import { Step2Data, Step3Data } from '../types';
import { Edit3, Info, ArrowRight, ArrowLeft, CheckCircle2, RefreshCw, Music2 } from 'lucide-react';

interface Props {
  step2Data: Step2Data;
  initialData: Step3Data | null;
  onSaveStep3: (data: Step3Data) => void;
  onBack: () => void;
}

// Helper to extract song title from lyrics text
const getSongTitle = (text: string): string => {
  if (!text) return '제목 없음';
  const lines = text.trim().split('\n');
  const firstLine = lines[0]?.trim() || '';
  const match = firstLine.match(/^\[?(?:노래\s*)?제목\s*:\s*([^\]\n]+)\]?$/i) || firstLine.match(/^(?:노래\s*)?제목\s*:\s*(.+)$/i);
  if (match) {
    return match[1].trim();
  }
  return '제목 미지정 (가사 첫 줄 참조)';
};

export const Step3LyricsReview: React.FC<Props> = ({
  step2Data,
  initialData,
  onSaveStep3,
  onBack
}) => {
  const [editedLyrics, setEditedLyrics] = useState<string>(
    initialData?.editedLyrics || step2Data.generatedLyrics
  );

  const isModified = editedLyrics.trim() !== step2Data.generatedLyrics.trim();

  const originalTitle = getSongTitle(step2Data.generatedLyrics);
  const currentTitle = getSongTitle(editedLyrics);

  const handleReset = () => {
    if (confirm('AI가 생성한 원래 가사로 초기화하시겠습니까?')) {
      setEditedLyrics(step2Data.generatedLyrics);
    }
  };

  const handleSubmit = () => {
    const data: Step3Data = {
      editedLyrics,
      hasSelfEdited: isModified,
      reviewedAt: new Date().toLocaleString('ko-KR')
    };
    onSaveStep3(data);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8 space-y-8">
      <div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-teal-50 text-teal-700 text-xs font-bold rounded-full mb-2">
          3단계 수행평가
        </div>
        <h3 className="text-xl md:text-2xl font-bold text-slate-800">
          가사 검토 및 비판적 자가 수정 (선택사항)
        </h3>
        <p className="text-sm text-slate-500 mt-1">
          AI가 생성한 가사와 노래 제목에 과학적 오류나 어색한 표현이 있는지 검토하고 직접 수정해 보세요.
        </p>
      </div>

      {/* Prominent Song Title Display Box */}
      <div className="p-4 bg-gradient-to-r from-teal-500 via-indigo-600 to-purple-600 rounded-2xl text-white shadow-md space-y-1">
        <div className="flex items-center gap-2 text-xs font-bold text-teal-100 uppercase tracking-wider">
          <Music2 className="w-4 h-4 text-teal-200" />
          <span>현재 노래 제목 (Song Title)</span>
        </div>
        <div className="text-xl md:text-2xl font-black text-white drop-shadow-sm flex items-center justify-between">
          <span>🎵 {currentTitle}</span>
          {isModified && currentTitle !== originalTitle && (
            <span className="text-xs font-bold px-2.5 py-1 bg-white/20 backdrop-blur rounded-lg text-teal-100 border border-white/30">
              제목 수정됨
            </span>
          )}
        </div>
      </div>

      {/* Top Banner Notice */}
      <div className="p-4 bg-teal-50 border border-teal-200 rounded-xl text-teal-900 text-xs md:text-sm font-medium flex items-start gap-3">
        <div className="p-1.5 bg-teal-100 rounded-lg text-teal-700 shrink-0 mt-0.5">
          <Info className="w-5 h-5" />
        </div>
        <div className="leading-relaxed">
          <strong>안내:</strong> 과학송 가사 및 노래 제목에 과학적 오류가 없는지 살펴보고 수정하고 싶은 부분이 있으면 직접 수정하세요. 가사 첫 줄의 <code className="bg-teal-100 px-1.5 py-0.5 rounded text-teal-900 font-mono">[제목: ...]</code> 부분을 수정하면 노래 제목이 변경됩니다. (수정 없이 진행해도 정상 처리됩니다.)
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: AI Generated Lyrics Reference */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700">
            <span className="flex items-center gap-1">
              [원본] Gemini AI가 생성한 제목 & 가사
            </span>
            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded">참고용</span>
          </div>
          <div className="p-4 bg-slate-900 text-slate-200 rounded-xl font-mono text-xs leading-relaxed whitespace-pre-wrap max-h-[450px] overflow-y-auto border border-slate-800">
            {step2Data.generatedLyrics}
          </div>
        </div>

        {/* Right: Editable Lyrics Textarea */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700">
            <span className="flex items-center gap-1 text-teal-700">
              <Edit3 className="w-3.5 h-3.5" />
              [수정본] 학생 자가 수정 제목 & 가사
            </span>
            {isModified ? (
              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-semibold animate-pulse">
                수정 완료 (자가 정정 반영됨)
              </span>
            ) : (
              <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded">
                수정 없음 (원본 동일)
              </span>
            )}
          </div>
          <textarea
            rows={18}
            value={editedLyrics}
            onChange={(e) => setEditedLyrics(e.target.value)}
            className="w-full p-4 border border-teal-300 rounded-xl font-mono text-xs text-slate-800 leading-relaxed focus:ring-2 focus:ring-teal-500 focus:outline-none bg-teal-50/20 max-h-[450px]"
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleReset}
              className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 underline pt-1"
            >
              <RefreshCw className="w-3 h-3" /> 원본 가사로 초기화
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="pt-6 border-t border-slate-200 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-all text-sm flex items-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" />
          2단계로 이전
        </button>

        <button
          type="button"
          onClick={handleSubmit}
          className="px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2 text-sm"
        >
          <CheckCircle2 className="w-4 h-4" />
          4단계(Suno AI 음악 제작 & 링크 제출) 이동
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
