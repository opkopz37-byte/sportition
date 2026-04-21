'use client';

import Link from 'next/link';
import { PageHeader, SpotlightCard } from '@/components/ui';
import {
  TERMS_OF_SERVICE_FULL_TEXT,
  TERMS_DOCUMENT_TITLE_KO,
} from '@/lib/legal/termsOfService';

export default function TermsOfServiceInlineView({ setActiveTab, backTab = 'mypage' }) {
  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title={TERMS_DOCUMENT_TITLE_KO}
        description="회원가입 시 동의하는 이용약관(개인정보 수집·이용) 전문과 동일합니다."
        onBack={() => setActiveTab(backTab)}
      />
      <SpotlightCard className="p-4 sm:p-6 mb-4">
        <div className="max-h-[min(70vh,36rem)] overflow-y-auto rounded-lg border border-white/10 bg-black/40 p-4">
          <pre className="whitespace-pre-wrap font-sans text-xs sm:text-sm leading-relaxed text-gray-300">
            {TERMS_OF_SERVICE_FULL_TEXT}
          </pre>
        </div>
        <p className="mt-4 text-xs text-gray-500">
          <Link href="/terms" className="text-blue-400 hover:text-blue-300 underline" target="_blank" rel="noopener noreferrer">
            /terms 페이지로 새 창에서 보기
          </Link>
        </p>
      </SpotlightCard>
    </div>
  );
}
