import React, { useState, useEffect } from 'react';
import { Step1Data, Step2Data } from '../types';
import { Music, Sparkles, Loader2, ArrowRight, ArrowLeft, Wand2, Copy, Check, MessageSquareCode } from 'lucide-react';

interface Props {
  step1Data: Step1Data;
  initialData: Step2Data | null;
  onSaveStep2: (data: Step2Data, moveNext?: boolean) => void;
  onBack: () => void;
}

const MUSIC_GENRES = [
  { id: 'K-Pop', name: 'K-Pop (댄스)', desc: '중독성 있는 후렴구와 신나는 댄스 비트' },
  { id: '힙합/랩', name: '힙합 / 랩', desc: '라임과 라듬감이 넘치는 그루브 비트' },
  { id: '트로트', name: '트로트', desc: '신나고 꺾드러지는 한국형 대중 가요' },
  { id: '발라드', name: '감성 발라드', desc: '서정적이고 아름다운 감성 멜로디' },
  { id: '동요', name: '동요 / 애니송', desc: '따라 부르기 쉬운 명쾌하고 밝은 곡' },
  { id: 'EDM', name: 'EDM / 하우스', desc: '강렬한 전자음과 드롭이 있는 비트' },
  { id: '국악/판소리', name: '국악 / 퓨전', desc: '우리 소리와 현대 비트의 만남' },
  { id: '락', name: '모던 락', desc: '에너지 넘치는 기타 사운드와 드럼' }
];

export const Step2PromptBuilder: React.FC<Props> = ({
  step1Data,
  initialData,
  onSaveStep2,
  onBack
}) => {
  const [genre, setGenre] = useState<string>(initialData?.genre || 'K-Pop');
  const [structurePrompt, setStructurePrompt] = useState<string>(
    initialData?.structurePrompt || ''
  );
  const [situationPrompt, setSituationPrompt] = useState<string>(
    initialData?.situationPrompt || ''
  );
  const [customPrompt, setCustomPrompt] = useState<string>(
    initialData?.customPrompt || ''
  );

  const [generatedLyrics, setGeneratedLyrics] = useState<string>(initialData?.generatedLyrics || '');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorText, setErrorText] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  const handleGenerateLyrics = async () => {
    setIsLoading(true);
    setErrorText('');

    try {
      const response = await fetch('/api/gemini/generate-lyrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unit: step1Data.unit,
          summary: step1Data.summary,
          keywords: step1Data.keywords,
          genre,
          structurePrompt,
          situationPrompt,
          customPrompt
        })
      });

      const contentType = response.headers.get('content-type') || '';
      let resData: any = {};
      if (contentType.includes('application/json')) {
        resData = await response.json();
      } else {
        const text = await response.text();
        throw new Error(`서버 응답 오류 (${response.status}): 서버에서 올바른 JSON 응답을 받지 못했습니다.`);
      }

      if (!response.ok) {
        throw new Error(resData.error || 'Gemini AI 가사 생성 실패');
      }

      setGeneratedLyrics(resData.lyrics);
    } catch (err: any) {
      console.error('Gemini lyrics error:', err);
      setErrorText(err.message || '가사 생성 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLyrics = () => {
    navigator.clipboard.writeText(generatedLyrics);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleProceed = () => {
    if (!generatedLyrics) {
      alert('Gemini AI 가사를 먼저 생성해 주세요.');
      return;
    }

    const data: Step2Data = {
      genre,
      structurePrompt,
      situationPrompt,
      customPrompt,
      generatedLyrics,
      generatedAt: new Date().toLocaleString('ko-KR')
    };

    onSaveStep2(data);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8 space-y-8">
      <div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-50 text-purple-700 text-xs font-bold rounded-full mb-2">
          2단계 수행평가
        </div>
        <h3 className="text-xl md:text-2xl font-bold text-slate-800">
          음악 스타일 & 프롬프트 작성 (Gemini AI 연동)
        </h3>
        <p className="text-sm text-slate-500 mt-1">
          선택한 단원 [{step1Data.unit}] 학습 내용 기반으로 AI 가사 생성을 위한 프롬프트를 빌딩합니다.
        </p>
      </div>

      {/* Step 1 Summary Preview Badge */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs text-slate-600">
        <div className="font-semibold text-slate-800 flex items-center gap-1">
          <MessageSquareCode className="w-4 h-4 text-purple-600" />
          1단계 전달 데이터 확인 (학생 입력 원본 보존):
        </div>
        <p className="line-clamp-2 italic text-slate-700">"{step1Data.summary}"</p>
        <div className="flex flex-wrap gap-1 pt-1">
          {step1Data.keywords.map(k => (
            <span key={k} className="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded font-medium">
              #{k}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        {/* Genre selection */}
        <div className="space-y-3">
          <label className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            1. 음악 장르 / 스타일 선택
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {MUSIC_GENRES.map((g) => {
              const isSelected = genre === g.id;
              return (
                <button
                  type="button"
                  key={g.id}
                  onClick={() => setGenre(g.id)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'border-purple-600 bg-purple-50 text-purple-950 font-bold shadow-sm ring-2 ring-purple-500/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{g.name}</span>
                    <Music className={`w-3.5 h-3.5 ${isSelected ? 'text-purple-600' : 'text-slate-400'}`} />
                  </div>
                  <div className="text-[11px] text-slate-500 font-normal mt-1 line-clamp-1">
                    {g.desc}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3 Prompt Builders */}
        <div className="space-y-4 pt-2">
          <div className="text-sm font-bold text-slate-800">2. 학생용 프롬프트 빌더 (3종 세트)</div>

          {/* Builder 1: Structure */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
              <span>① 가사 구조 설계 (1절, 2절, 후렴 내용)</span>
            </label>
            <input
              type="text"
              value={structurePrompt}
              onChange={(e) => setStructurePrompt(e.target.value)}
              placeholder="예: 1절은 들숨, 2절은 날숨, 후렴은 내호흡 외호흡 내용"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 focus:bg-white focus:outline-none"
            />
          </div>

          {/* Builder 2: Situation */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">
              ② 상황 및 테마 설정
            </label>
            <input
              type="text"
              value={situationPrompt}
              onChange={(e) => setSituationPrompt(e.target.value)}
              placeholder="예: 탐정이 영양소의 비밀을 파헤치는 명탐정 오디션 상황"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 focus:bg-white focus:outline-none"
            />
          </div>

          {/* Builder 3: Custom requirements */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">
              ③ 추가 요구사항 (라임, 강조 단어 등)
            </label>
            <input
              type="text"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="예: 후렴구 끝맺음을 '소화!'로 통일하고 중독성 있는 라임 생성"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 focus:bg-white focus:outline-none"
            />
          </div>
        </div>

        {/* Generate Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleGenerateLyrics}
            disabled={isLoading}
            className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 text-base disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Gemini AI가 과학송 가사를 작성하는 중입니다...
              </>
            ) : (
              <>
                <Wand2 className="w-5 h-5" />
                Gemini AI로 과학송 가사 생성하기
              </>
            )}
          </button>
        </div>

        {/* Error Notification */}
        {errorText && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
            {errorText}
          </div>
        )}

        {/* Generated Lyrics Result Display */}
        {generatedLyrics && (
          <div className="space-y-3 pt-4 animate-fadeIn">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-purple-950 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-purple-600" />
                Gemini AI가 작성한 과학송 가사
              </span>
              <button
                type="button"
                onClick={handleCopyLyrics}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition-all flex items-center gap-1"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? '복사 완료' : '가사 복사'}
              </button>
            </div>
            <div className="p-5 bg-purple-950 text-purple-100 rounded-2xl border border-purple-800/60 font-mono text-sm leading-relaxed whitespace-pre-wrap shadow-inner max-h-96 overflow-y-auto">
              {generatedLyrics}
            </div>
          </div>
        )}

        {/* Bottom Actions */}
        <div className="pt-6 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-all text-sm flex items-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            1단계로 이전
          </button>

          <button
            type="button"
            onClick={handleProceed}
            disabled={!generatedLyrics}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            3단계(가사 검토 및 수정) 이동
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
