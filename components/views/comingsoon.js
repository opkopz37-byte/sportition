'use client';

import { Icon } from '@/components/ui';

// Coming Soon 플레이스홀더 뷰
const ComingSoonView = ({ title, subtitle }) => (
  <div className="flex flex-col items-center justify-center min-h-[24rem] px-4 text-center animate-fade-in-up">
    <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6">
      <Icon type="map" className="text-gray-500" />
    </div>
    <h2 className="text-2xl font-bold text-white mb-2">{title}</h2>
    <p className="text-gray-500 max-w-md">
      {subtitle ?? 'This feature is under construction.'}
    </p>
  </div>
);

export { ComingSoonView };
