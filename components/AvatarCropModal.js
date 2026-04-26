'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';

/**
 * 인스타그램 풍 프로필 이미지 편집 모달.
 * - 드래그(터치/마우스): 이미지 이동
 * - 핀치(2 fingers) / 마우스 휠 / 슬라이더: 확대·축소
 * - 원형 마스크 안쪽 영역이 실제 프로필로 적용
 * - 적용 시 512×512 JPEG Blob 으로 onCropped(blob) 콜백
 *
 * 모바일 깜빡임 방지 최적화:
 * - backdrop-filter 미사용 (iOS Safari repaint 폭주의 주범)
 * - 솔리드 배경 + body 스크롤 잠금
 * - SVG 마스크 useMemo (transform state 변화에 영향 안 받게)
 * - 드래그 이미지에 will-change/translate3d 로 GPU 레이어 승격
 */
const VP_DEFAULT = 320;          // 화면 뷰포트(정사각) 픽셀
const OUT_SIZE = 512;            // 결과 JPEG 한 변 픽셀
const MAX_ZOOM_MULT = 4;         // 초기 스케일 대비 최대 배율
const JPEG_QUALITY = 0.9;

// 첫 렌더에 즉시 정확한 viewport 사이즈를 계산 — 320 → 실제 폭 으로 점프하는 paint flash 방지
function computeVp() {
  if (typeof window === 'undefined') return VP_DEFAULT;
  const w = Math.min(window.innerWidth - 48, 360);
  return Math.max(240, w);
}

// view state 초기값 — 모든 fields 명시. file 이 바뀔 때마다 이 값으로 깨끗하게 리셋.
const INITIAL_VIEW = Object.freeze({
  ready: false,
  url: null,
  dim: null,    // { w, h }
  minScale: 1,
  scale: 1,
  tx: 0,
  ty: 0,
});

export default function AvatarCropModal({ file, onCancel, onCropped }) {
  // 이미지 메타·스케일을 단일 state 객체로 통합 — 5번의 연속 setState 를 1번으로
  // (이전: setImgUrl + setImgDim + setMinScale + setScale + setTx + setTy → 6번 paint)
  const [view, setView] = useState(INITIAL_VIEW);
  const [busy, setBusy] = useState(false);
  // lazy 초기화 — 첫 렌더부터 정확한 vp 로 시작
  const [vp, setVp] = useState(computeVp);

  const containerRef = useRef(null);
  const imgElRef = useRef(null);
  const dragRef = useRef(null);    // { sx, sy, stx, sty }
  const pinchRef = useRef(null);   // { startDist, startScale }

  // 편의 alias — 기존 코드 호환
  const { ready, url: imgUrl, dim: imgDim, minScale, scale, tx, ty } = view;
  const setScale = useCallback((next) => {
    setView((v) => ({ ...v, scale: typeof next === 'function' ? next(v.scale) : next }));
  }, []);
  const setTx = useCallback((next) => {
    setView((v) => ({ ...v, tx: typeof next === 'function' ? next(v.tx) : next }));
  }, []);
  const setTy = useCallback((next) => {
    setView((v) => ({ ...v, ty: typeof next === 'function' ? next(v.ty) : next }));
  }, []);

  // ⚠️ body 스크롤 잠금을 의도적으로 제거 —
  // position:fixed 든 overflow:hidden 든 body 에 스타일 변경 가하면
  // iOS Safari 가 reflow + toolbar 자동 조정을 트리거해 모달 뒤로 깜빡임이 새어나옴.
  // 모달이 fixed inset-0 으로 viewport 전체를 덮으므로 사용자 입력은 어차피 모달만 받음.
  // 배경 페이지 의도치 않은 스크롤은 overlay 의 overscroll-behavior:contain 으로 차단.

  // 모바일 화면 폭에 맞춰 viewport 사이즈 갱신 — 같은 값이면 setState 안 함 (re-render 차단)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const update = () => {
      const next = computeVp();
      setVp((cur) => (cur === next ? cur : next));
    };
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // file → object URL → 자연 크기 측정 → 모든 초기값을 한 번에 set
  // - file=null 일 땐 view 를 깨끗이 비움 (혹시 이전 세션의 ready=true 가 남아있으면 정리)
  // - file 이 바뀌면 즉시 ready=false 로 리셋해 이전 이미지(revoked URL) 잔상 차단
  useEffect(() => {
    if (!file) {
      // 모달 닫힘 — 이미 INITIAL_VIEW 면 setState 안 함 (불필요 re-render 차단)
      setView((v) => (v === INITIAL_VIEW ? v : INITIAL_VIEW));
      return undefined;
    }
    // 새 file 진입 — 이미 비어있으면 그대로 두고, 이전 데이터가 있을 때만 리셋
    setView((v) => (v === INITIAL_VIEW ? v : INITIAL_VIEW));

    let cancelled = false;
    const url = URL.createObjectURL(file);
    const img = new Image();

    const finalize = () => {
      if (cancelled) {
        URL.revokeObjectURL(url);
        return;
      }
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const init = vp / Math.min(w || 1, h || 1);
      setView({
        ready: true,
        url,
        dim: { w, h },
        minScale: init,
        scale: init,
        tx: 0,
        ty: 0,
      });
    };

    img.onload = () => {
      // ⭐ img.decode() — 픽셀까지 완전히 디코드 후에야 ready=true 로 바꿔
      // <img> 가 마운트되자마자 깜빡임 없이 즉시 그려지게 함.
      // (지원 안 되면 그냥 finalize — 일부 구형 브라우저용 fallback)
      if (typeof img.decode === 'function') {
        img.decode().then(finalize).catch(finalize);
      } else {
        finalize();
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      if (!cancelled) {
        alert('이미지를 불러오지 못했습니다.');
        onCancel?.();
      }
    };
    img.src = url;
    return () => {
      cancelled = true;
      URL.revokeObjectURL(url);
    };
    // vp 의존 제외 — vp 변화는 별도 useEffect 가 minScale 갱신함
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  // vp 변경 (모바일 회전 / 브라우저 리사이즈) 대응 — minScale 재계산 + scale 보정
  useEffect(() => {
    if (!view.dim) return;
    const newMin = vp / Math.min(view.dim.w || 1, view.dim.h || 1);
    setView((v) => {
      if (Math.abs(v.minScale - newMin) < 0.001) return v;
      const nextScale = Math.max(newMin, v.scale); // 너무 작아지면 cover 유지
      return { ...v, minScale: newMin, scale: nextScale };
    });
  }, [vp, view.dim]);

  // 패닝 한계 — 이미지가 원형 마스크 밖으로 빈 영역을 노출하지 않도록 클램프
  const clamp = useCallback((nx, ny, sc) => {
    if (!imgDim) return { nx, ny };
    const w = imgDim.w * sc;
    const h = imgDim.h * sc;
    const maxX = Math.max(0, (w - vp) / 2);
    const maxY = Math.max(0, (h - vp) / 2);
    return {
      nx: Math.max(-maxX, Math.min(maxX, nx)),
      ny: Math.max(-maxY, Math.min(maxY, ny)),
    };
  }, [imgDim, vp]);

  // scale/imgDim 변화 시에만 tx/ty 클램프 — 드래그 시엔 onPointerMove 가 이미 클램프하므로 불필요
  // (이전: tx/ty 가 deps 에 있어서 드래그 매 프레임마다 useEffect 재실행 → no-op 이라도 비용 발생)
  useEffect(() => {
    if (!imgDim) return;
    setView((v) => {
      const { nx, ny } = clamp(v.tx, v.ty, v.scale);
      if (nx === v.tx && ny === v.ty) return v;
      return { ...v, tx: nx, ty: ny };
    });
  }, [scale, imgDim, clamp]);

  // ── 입력 처리 ──────────────────────────────────────
  const onPointerDown = (e) => {
    if (e.pointerType === 'touch' && e.isPrimary === false) return; // 멀티터치는 핀치가 처리
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragRef.current = { sx: e.clientX, sy: e.clientY, stx: tx, sty: ty };
  };
  const onPointerMove = (e) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.sx;
    const dy = e.clientY - dragRef.current.sy;
    // 단일 setView — tx/ty 동시 갱신 (이전: setTx + setTy 2번 → 2번 reducer)
    // 변화 없으면 같은 v 반환 → React 가 re-render 스킵
    setView((v) => {
      if (!v.dim) return v;
      const w = v.dim.w * v.scale;
      const h = v.dim.h * v.scale;
      const maxX = Math.max(0, (w - vp) / 2);
      const maxY = Math.max(0, (h - vp) / 2);
      const nx = Math.max(-maxX, Math.min(maxX, dragRef.current.stx + dx));
      const ny = Math.max(-maxY, Math.min(maxY, dragRef.current.sty + dy));
      if (nx === v.tx && ny === v.ty) return v;
      return { ...v, tx: nx, ty: ny };
    });
  };
  const onPointerUp = (e) => {
    dragRef.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  const onWheel = (e) => {
    e.preventDefault();
    const factor = 1 - e.deltaY * 0.0015;
    setScale((s) => Math.max(minScale, Math.min(minScale * MAX_ZOOM_MULT, s * factor)));
  };

  const onTouchStart = (e) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchRef.current = { startDist: Math.hypot(dx, dy), startScale: scale };
    }
  };
  const onTouchMove = (e) => {
    if (e.touches.length === 2 && pinchRef.current) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const ratio = dist / pinchRef.current.startDist;
      const next = Math.max(minScale, Math.min(minScale * MAX_ZOOM_MULT, pinchRef.current.startScale * ratio));
      setScale(next);
    }
  };
  const onTouchEnd = () => { pinchRef.current = null; };

  // ── 적용 — 캔버스에 그려서 JPEG Blob 생성 ───────
  const handleApply = useCallback(async () => {
    if (busy || !imgDim || !imgUrl) return;
    setBusy(true);
    try {
      const sw = vp / scale;       // 원본 이미지에서 잘라낼 정사각 크기
      const sh = sw;
      const sx = (imgDim.w - sw) / 2 - tx / scale;
      const sy = (imgDim.h - sh) / 2 - ty / scale;
      const canvas = document.createElement('canvas');
      canvas.width = OUT_SIZE;
      canvas.height = OUT_SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context unavailable');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      // 원본 이미지에서 sx/sy/sw/sh 영역을 OUT 정사각에 매핑
      const img = imgElRef.current || new Image();
      if (!imgElRef.current) {
        await new Promise((res, rej) => {
          img.onload = res; img.onerror = rej;
          img.src = imgUrl;
        });
      }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, OUT_SIZE, OUT_SIZE);
      const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', JPEG_QUALITY));
      if (!blob) throw new Error('이미지 생성 실패');
      onCropped?.(blob);
    } catch (err) {
      console.error('[AvatarCropModal] apply', err);
      alert(err?.message || '편집에 실패했습니다.');
      setBusy(false);
    }
  }, [busy, imgDim, imgUrl, scale, tx, ty, vp, onCropped]);

  // SVG 마스크는 vp 가 바뀔 때만 재계산 — scale/tx/ty 변화에 영향 안 받게 메모이제이션
  // (드래그 중에 SVG 가 매 프레임 paint 되는 것을 막아 깜빡임 ↓)
  const maskSvg = useMemo(() => (
    <svg
      className="absolute inset-0 pointer-events-none"
      width={vp}
      height={vp}
      viewBox={`0 0 ${vp} ${vp}`}
      aria-hidden
    >
      <defs>
        <mask id="circmask">
          <rect width={vp} height={vp} fill="white" />
          <circle cx={vp / 2} cy={vp / 2} r={vp / 2 - 2} fill="black" />
        </mask>
      </defs>
      <rect width={vp} height={vp} fill="rgba(0,0,0,0.6)" mask="url(#circmask)" />
      <circle cx={vp / 2} cy={vp / 2} r={vp / 2 - 2} fill="none" stroke="rgba(255,255,255,0.95)" strokeWidth="2" />
    </svg>
  ), [vp]);

  if (!file) return null;
  if (typeof document === 'undefined') return null;

  // ⚠️ createPortal 로 document.body 에 직접 마운트 — 매우 중요!
  // 부모 컴포넌트(DashboardView)의 `animate-fade-in-up` 이 transform 을 영구 적용해서
  // 그 안에 position:fixed 가 있으면 viewport 가 아닌 부모 기준으로 포지셔닝됨.
  // Portal 로 빼야 모달이 항상 viewport 전체를 정확히 덮음 → 위치 점프/깜빡임 차단.
  return createPortal(
    <div
      // backdrop-blur 제거 + 100% 불투명 배경 — 뒤 페이지 reflow 가 절대 새지 않음.
      // overscroll-behavior: contain — iOS 에서 overlay 스크롤이 body 로 chain 되는 것 차단.
      className="fixed inset-0 z-[10000] overflow-y-auto"
      style={{
        backgroundColor: '#0c1024',                // 100% 불투명 (이전 0.96 → 1.0)
        overscrollBehavior: 'contain',
        WebkitOverflowScrolling: 'touch',          // iOS 부드러운 모달 내부 스크롤
        // 노치/상단 영역을 피해서 화면 최상단에 고정 + iOS 안전 영역 4면 패딩
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)',
        paddingLeft: 'max(env(safe-area-inset-left, 0px), 16px)',
        paddingRight: 'max(env(safe-area-inset-right, 0px), 16px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel?.(); }}
    >
      <div className="mx-auto w-full max-w-md bg-zinc-900 rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
        {/* 헤더 */}
        <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between">
          <h3 className="text-white font-bold text-base">프로필 사진 편집</h3>
          <button
            type="button"
            onClick={onCancel}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-lg leading-none"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        {/* 본문 */}
        <div className="p-4 flex flex-col items-center gap-4">
          <div
            ref={containerRef}
            className="relative bg-black rounded-md overflow-hidden touch-none select-none cursor-grab active:cursor-grabbing"
            style={{
              width: vp,
              height: vp,
              touchAction: 'none',
              // 컨테이너를 GPU 레이어로 격리 → 자식 transform 변화가 viewport 페인트 트리거 안 함
              contain: 'layout paint',
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onWheel={onWheel}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            {ready ? (
              <>
                <img
                  ref={imgElRef}
                  src={imgUrl}
                  alt=""
                  draggable={false}
                  decoding="sync"
                  fetchPriority="high"
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    width: imgDim.w,
                    height: imgDim.h,
                    maxWidth: 'none',
                    maxHeight: 'none',
                    // translate3d 로 강제 GPU 레이어 승격 + will-change 로 페인트 비용 ↓
                    // (모바일 Safari/Chrome 에서 드래그 중 깜빡임의 핵심 해결책)
                    transform: `translate3d(-50%, -50%, 0) translate3d(${tx}px, ${ty}px, 0) scale(${scale})`,
                    transformOrigin: 'center center',
                    willChange: 'transform',
                    backfaceVisibility: 'hidden',
                    pointerEvents: 'none',
                    userSelect: 'none',
                  }}
                />
                {/* 원형 마스크 + 가이드 라인 (vp 변화에만 재렌더) */}
                {maskSvg}
              </>
            ) : (
              // 이미지 로드 전 — 빈 검정 박스 깜빡임 대신 정적 로딩 인디케이터
              <div className="absolute inset-0 flex items-center justify-center text-white/40 text-xs">
                불러오는 중…
              </div>
            )}
          </div>

          {/* 줌 슬라이더 */}
          <div className="w-full">
            <div className="flex items-center gap-2">
              <span className="text-white/40 text-xs">−</span>
              <input
                type="range"
                min={minScale}
                max={minScale * MAX_ZOOM_MULT}
                step={0.001}
                value={scale}
                onChange={(e) => setScale(Number(e.target.value))}
                className="flex-1 h-1.5 rounded-full appearance-none bg-white/10 accent-purple-500"
              />
              <span className="text-white/40 text-xs">+</span>
            </div>
            <p className="text-center text-[11px] text-white/40 mt-1.5">
              드래그로 이동 · 핀치 / 휠 / 슬라이더로 확대
            </p>
          </div>

          {/* 액션 */}
          <div className="flex gap-2 w-full pt-1">
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/80 text-sm font-semibold hover:bg-white/10 disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={busy}
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-bold hover:brightness-110 disabled:opacity-50"
            >
              {busy ? '적용 중…' : '적용'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
