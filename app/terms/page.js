import Link from 'next/link';
import { TERMS_OF_SERVICE_FULL_TEXT, TERMS_DOCUMENT_TITLE_KO } from '@/lib/legal/termsOfService';

export const metadata = {
  title: '이용약관 · 개인정보 수집·이용 동의 | Sportition',
  description: '스포티션 이용약관 및 개인정보 수집·이용 동의 전문',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <Link
          href="/"
          className="inline-block text-sm text-blue-400 hover:text-blue-300 mb-6"
        >
          ← 홈으로
        </Link>
        <h1 className="text-2xl font-bold mb-2">{TERMS_DOCUMENT_TITLE_KO}</h1>
        <p className="text-sm text-gray-500 mb-8">본 문서는 회원가입 시 동의하는 이용약관(개인정보 수집·이용) 전문과 동일합니다.</p>
        <article className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-gray-300">
            {TERMS_OF_SERVICE_FULL_TEXT}
          </pre>
        </article>
      </div>
    </div>
  );
}
