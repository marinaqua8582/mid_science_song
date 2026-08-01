import React from 'react';
import { ShieldCheck, Info } from 'lucide-react';

export const PrivacyBanner: React.FC = () => {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs md:text-sm text-amber-900 shadow-sm transition-all mb-6">
      <div className="flex items-start gap-3">
        <div className="p-1.5 bg-amber-100 rounded-lg text-amber-700 shrink-0 mt-0.5">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div className="space-y-1 leading-relaxed">
          <div className="font-semibold text-amber-950 flex items-center gap-1.5 text-xs uppercase tracking-wider">
            <Info className="w-4 h-4 text-amber-600" />
            개인정보 수집 및 이용 안내 (필독)
          </div>
          <p>
            수행평가 제출 확인을 위해 반, 번호, 이름을 수집합니다. 입력 정보는 과학송 가사 생성을 위한 Gemini AI에는 전달되지 않으며, 교사가 관리하는 Google Sheets에 수행평가 확인 목적으로 저장됩니다. 수집된 정보는 평가 및 성적 확인이 끝난 후 삭제합니다. 학습 내용과 AI 요청사항에는 자신이나 다른 사람의 개인정보를 입력하지 마세요.
          </p>
        </div>
      </div>
    </div>
  );
};
