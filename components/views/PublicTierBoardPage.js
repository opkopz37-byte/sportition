'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { BackgroundGrid } from '@/components/ui';
import { TierBoardView } from '@/components/views/ranking';
import PublicPlayerRecordView from '@/components/views/PublicPlayerRecordView';
import { translations } from '@/lib/translations';

export default function PublicTierBoardPage() {
  const searchParams = useSearchParams();
  const qFromUrl = searchParams.get('q') ?? '';
  const [language, setLanguage] = useState('ko');
  const [viewingPlayerId, setViewingPlayerId] = useState(null);
  const [langOpen, setLangOpen] = useState(false);
  const t = (key) => translations[language][key] || key;

  return (
    <div className="relative min-h-screen bg-black text-white">
      <BackgroundGrid theme={{ accent: 'blue' }} />

      {viewingPlayerId && (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-black px-3 sm:px-6 py-6">
          <div className="max-w-5xl mx-auto">
            <PublicPlayerRecordView
              playerId={viewingPlayerId}
              language={language}
              onBack={() => setViewingPlayerId(null)}
            />
          </div>
        </div>
      )}

      <header className="relative z-10 flex flex-wrap items-center justify-between gap-3 px-4 py-4 border-b border-white/10">
        <Link href="/" className="text-sm text-gray-400 hover:text-white transition-colors">
          ← {t('backToHome')}
        </Link>
        <div className="relative">
          <button
            type="button"
            onClick={() => setLangOpen((o) => !o)}
            className="rounded-xl border border-white/[0.12] bg-[#121212] hover:bg-white/[0.06] px-3 py-2 text-xs text-white"
          >
            {language === 'ko' ? '한국어' : 'English'}
          </button>
          {langOpen && (
            <div className="absolute right-0 top-full mt-1 w-32 rounded-lg border border-white/10 bg-[#121212] shadow-xl z-20 overflow-hidden">
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-white/10"
                onClick={() => {
                  setLanguage('ko');
                  setLangOpen(false);
                }}
              >
                한국어
              </button>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-white/10"
                onClick={() => {
                  setLanguage('en');
                  setLangOpen(false);
                }}
              >
                English
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="relative z-10 px-2 xs:px-3 sm:px-4 lg:px-6 pb-16 max-w-7xl mx-auto pt-6">
        <TierBoardView
          t={t}
          publicMode
          initialSearchQuery={qFromUrl}
          onPlayerClick={(id) => setViewingPlayerId(id)}
        />
      </main>
    </div>
  );
}
