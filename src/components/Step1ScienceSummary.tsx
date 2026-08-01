import React, { useState } from 'react';
import { ScienceUnit, Step1Data } from '../types';
import { SCIENCE_UNITS } from '../data/units';
import { Utensils, HeartPulse, Wind, Droplets, CheckCircle2, ArrowRight, HelpCircle, Plus, X, Tag } from 'lucide-react';

interface Props {
  initialData: Step1Data | null;
  onSaveStep1: (data: Step1Data) => void;
}

export const Step1ScienceSummary: React.FC<Props> = ({ initialData, onSaveStep1 }) => {
  const [selectedUnit, setSelectedUnit] = useState<ScienceUnit>(initialData?.unit || '소화');
  const [summaryText, setSummaryText] = useState<string>(initialData?.summary || '');
  const [keywords, setKeywords] = useState<string[]>(initialData?.keywords || []);
  const [keywordInput, setKeywordInput] = useState<string>('');

  const currentUnitInfo = SCIENCE_UNITS[selectedUnit];

  // Count sentences roughly by checking periods, exclamations, question marks, or line breaks
  const sentenceCount = summaryText
    .split(/[.!?\n]+/)
    .filter(s => s.trim().length > 0).length;

  const handleAddKeyword = () => {
    const trimmed = keywordInput.trim().replace(/^#/, '');
    if (trimmed && !keywords.includes(trimmed)) {
      setKeywords([...keywords, trimmed]);
      setKeywordInput('');
    }
  };

  const handleRemoveKeyword = (term: string) => {
    setKeywords(keywords.filter(k => k !== term));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: Step1Data = {
      unit: selectedUnit,
      summary: summaryText,
      keywords,
      savedAt: new Date().toLocaleString('ko-KR')
    };
    onSaveStep1(data);
  };

  const getUnitIcon = (unit: ScienceUnit) => {
    switch (unit) {
      case '소화': return <Utensils className="w-5 h-5" />;
      case '순환': return <HeartPulse className="w-5 h-5" />;
      case '호흡': return <Wind className="w-5 h-5" />;
      case '배설': return <Droplets className="w-5 h-5" />;
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8 space-y-8">
      <div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-full mb-2">
          1단계 수행평가
        </div>
        <h3 className="text-xl md:text-2xl font-bold text-slate-800">
          학습 내용 정리 및 핵심 단어 추출
        </h3>
        <p className="text-sm text-slate-500 mt-1">
          수업 시간에 배운 과학 핵심 개념을 자기 언어로 정리하고, 중요 키워드를 추출하세요.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Unit Selection */}
        <div className="space-y-3">
          <label className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            1. 과학 단원 선택 <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(Object.keys(SCIENCE_UNITS) as ScienceUnit[]).map((unitKey) => {
              const u = SCIENCE_UNITS[unitKey];
              const isSelected = selectedUnit === unitKey;
              return (
                <button
                  type="button"
                  key={unitKey}
                  onClick={() => setSelectedUnit(unitKey)}
                  className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between gap-2 ${
                    isSelected
                      ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                  }`}
                >
                  <div className={`p-2 rounded-lg w-fit ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                    {getUnitIcon(unitKey)}
                  </div>
                  <div>
                    <div className={`font-bold text-sm ${isSelected ? 'text-indigo-950' : 'text-slate-800'}`}>
                      {u.name}
                    </div>
                    <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                      {u.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Sentence Starter Guide */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
            <HelpCircle className="w-4 h-4 text-indigo-500" />
            문장 시작 작성 예시 (정답이나 힌트가 아닌 작성 참고용 구문입니다)
          </div>
          <div className="p-3 bg-white rounded-lg border border-slate-200 text-xs text-indigo-900 font-mono italic">
            "{currentUnitInfo.starterExample}"
          </div>
        </div>

        {/* Summary Textarea */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-bold text-slate-800 flex items-center gap-2">
              2. 학습 내용 상세 정리
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                sentenceCount >= 5 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}>
                5문장 이상 권장 (현재: {sentenceCount}문장)
              </span>
            </label>
          </div>
          <textarea
            rows={6}
            value={summaryText}
            onChange={(e) => setSummaryText(e.target.value)}
            placeholder={`[${selectedUnit}] 단원에서 배운 주요 과정과 영양소/물질의 변화를 상세히 작성하세요. (예: 문장 단위로 완성되도록 작성)`}
            className="w-full p-4 border border-slate-300 rounded-xl font-normal text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm leading-relaxed"
          />
        </div>

        {/* Key terms input */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-bold text-slate-800 flex items-center gap-2">
              3. 핵심 단어 (키워드) 입력
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                keywords.length >= 10 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}>
                10개 이상 권장 (현재: {keywords.length}개)
              </span>
            </label>
          </div>

          {/* Quick add input */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Tag className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddKeyword();
                  }
                }}
                placeholder="핵심 단어를 입력하고 Enter 또는 추가 클릭"
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={handleAddKeyword}
              className="px-4 py-2 bg-slate-800 text-white font-medium rounded-xl text-sm hover:bg-slate-900 transition-all flex items-center gap-1 shrink-0"
            >
              <Plus className="w-4 h-4" />
              추가
            </button>
          </div>

          {/* Added Keywords List */}
          {keywords.length > 0 && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="text-xs font-semibold text-slate-600">등록된 핵심 단어 ({keywords.length}개):</div>
              <div className="flex flex-wrap gap-2">
                {keywords.map((term) => (
                  <span
                    key={term}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-600 text-white text-xs font-semibold rounded-lg shadow-sm"
                  >
                    #{term}
                    <button
                      type="button"
                      onClick={() => handleRemoveKeyword(term)}
                      className="hover:text-red-200 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <div className="pt-4 border-t border-slate-200 flex justify-end">
          <button
            type="submit"
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2 text-sm"
          >
            <CheckCircle2 className="w-4 h-4" />
            1단계 저장 및 2단계(음악 프롬프트) 이동
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
};
