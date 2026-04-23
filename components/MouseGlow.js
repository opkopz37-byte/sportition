'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * 마우스 커서를 따라다니는 아주 옅은 흰색 원형 글로우.
 * 모바일/터치 전용 기기에서는 표시하지 않는다.
 */
export default function MouseGlow() {
  const ref = useRef(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(pointer: fine)');
    const update = () => setEnabled(mql.matches);
    update();
    mql.addEventListener?.('change', update);
    return () => mql.removeEventListener?.('change', update);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;

    let raf = 0;
    let pendingX = 0;
    let pendingY = 0;

    const apply = () => {
      el.style.transform = `translate3d(${pendingX - 200}px, ${pendingY - 200}px, 0)`;
      raf = 0;
    };

    const handleMove = (e) => {
      pendingX = e.clientX;
      pendingY = e.clientY;
      el.style.opacity = '1';
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const handleLeave = () => {
      el.style.opacity = '0';
    };

    window.addEventListener('mousemove', handleMove, { passive: true });
    window.addEventListener('mouseleave', handleLeave);
    document.addEventListener('mouseleave', handleLeave);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseleave', handleLeave);
      document.removeEventListener('mouseleave', handleLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed top-0 left-0 w-[400px] h-[400px] rounded-full z-[9999] opacity-0 transition-opacity duration-200"
      style={{
        background:
          'radial-gradient(circle, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 40%, rgba(255,255,255,0) 70%)',
        willChange: 'transform, opacity',
        mixBlendMode: 'screen',
      }}
    />
  );
}
