import { Suspense } from 'react';
import PublicTierBoardPage from '@/components/views/PublicTierBoardPage';

export default function TierBoardRoutePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black text-gray-400 flex items-center justify-center text-sm">Loading…</div>}>
      <PublicTierBoardPage />
    </Suspense>
  );
}
