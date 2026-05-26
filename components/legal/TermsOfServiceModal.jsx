'use client';

import {
  TERMS_OF_SERVICE_FULL_TEXT,
  TERMS_DOCUMENT_TITLE_KO,
} from '@/lib/legal/termsOfService';

export default function TermsOfServiceModal({ open, onClose, title, content }) {
  if (!open) return null;

  const displayTitle = title ?? TERMS_DOCUMENT_TITLE_KO;
  const displayBody = content ?? TERMS_OF_SERVICE_FULL_TEXT;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-6 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="terms-modal-title"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[min(90vh,40rem)] flex flex-col rounded-2xl border border-white/10 bg-[#111] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 6l12 12M18 6l-12 12" />
          </svg>
        </button>
        <div className="px-5 sm:px-6 pt-5 sm:pt-6 pb-3 border-b border-white/10 shrink-0">
          <h2 id="terms-modal-title" className="text-lg font-bold text-white pr-8">
            {displayTitle}
          </h2>
        </div>
        <div className="px-5 sm:px-6 py-3 overflow-y-auto flex-1 min-h-0">
          <pre className="whitespace-pre-wrap font-sans text-[13px] sm:text-sm leading-relaxed text-gray-300">
            {displayBody}
          </pre>
        </div>
        <div className="px-5 sm:px-6 py-4 border-t border-white/10 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm font-bold transition"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
