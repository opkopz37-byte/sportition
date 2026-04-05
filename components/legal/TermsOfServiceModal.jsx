'use client';

import { Icon } from '@/components/ui';
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
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 backdrop-blur-sm p-3 xs:p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="terms-modal-title"
    >
      <div className="relative w-full max-w-2xl max-h-[min(90vh,40rem)] flex flex-col rounded-xl border border-white/10 bg-[#0a0a0a] shadow-2xl">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10 shrink-0">
          <h2 id="terms-modal-title" className="text-base sm:text-lg font-bold text-white pr-2">
            {displayTitle}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="닫기"
          >
            <Icon type="x" size={20} />
          </button>
        </div>
        <div className="px-4 py-3 overflow-y-auto flex-1 min-h-0">
          <pre className="whitespace-pre-wrap font-sans text-[13px] sm:text-sm leading-relaxed text-gray-300">
            {displayBody}
          </pre>
        </div>
        <div className="px-4 py-3 border-t border-white/10 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 text-blue-200 text-sm font-medium transition-colors"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
