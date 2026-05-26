'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';

const VARIANT_BORDER = {
  success: 'border-emerald-500/40',
  warning: 'border-amber-500/40',
  danger: 'border-red-500/40',
  info: 'border-white/10',
  none: 'border-white/10',
};

const VARIANT_TITLE = {
  success: 'text-emerald-300',
  warning: 'text-amber-300',
  danger: 'text-red-300',
  info: 'text-white',
  none: 'text-white',
};

const SIZE_MAX_W = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export default function Modal({
  open,
  onClose,
  title,
  header,
  variant = 'info',
  size = 'sm',
  contained = false,
  closable = true,
  padding = 'default',
  fullScreen = false,
  usePortal = false,
  zIndexClass,
  overlayClassName = '',
  containerClassName = '',
  children,
}) {
  useEffect(() => {
    if (!open || !closable) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, closable, onClose]);

  if (!open) return null;

  const positionClass = contained ? 'absolute' : 'fixed';
  const roundedOverlay = contained ? 'rounded-2xl' : '';
  const maxW = fullScreen ? '' : (SIZE_MAX_W[size] || SIZE_MAX_W.sm);
  const borderClass = VARIANT_BORDER[variant] || VARIANT_BORDER.info;
  const titleClass = VARIANT_TITLE[variant] || VARIANT_TITLE.info;
  const z = zIndexClass || 'z-50';
  const padClass = padding === 'none' ? 'p-0' : 'p-5 sm:p-6';
  const overlayPad = fullScreen ? '' : 'p-3 sm:p-6';
  const containerShape = fullScreen
    ? 'w-full h-full sm:h-auto sm:max-h-[90vh] sm:rounded-2xl rounded-none flex flex-col'
    : `w-full ${maxW} rounded-2xl`;

  const handleBackdrop = () => {
    if (closable) onClose?.();
  };

  const modalNode = (
    <div
      className={`${positionClass} inset-0 ${z} flex items-center justify-center ${overlayPad} bg-black/80 backdrop-blur-sm ${roundedOverlay} ${overlayClassName}`}
      onClick={handleBackdrop}
    >
      <div
        className={`relative ${containerShape} border bg-[#111] shadow-2xl ${borderClass} ${padClass} ${containerClassName}`}
        onClick={(e) => e.stopPropagation()}
      >
        {closable && (
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
        )}
        {header ? (
          header
        ) : title ? (
          <h3 className={`text-lg font-bold mb-3 pr-8 ${titleClass}`}>
            {title}
          </h3>
        ) : null}
        {children}
      </div>
    </div>
  );

  if (usePortal && typeof document !== 'undefined') {
    return createPortal(modalNode, document.body);
  }
  return modalNode;
}

const VARIANT_BTN = {
  ghost: 'bg-white/10 hover:bg-white/15 text-white',
  success: 'bg-emerald-600 hover:bg-emerald-500 text-white',
  warning: 'bg-amber-600 hover:bg-amber-500 text-white',
  danger: 'bg-red-600 hover:bg-red-500 text-white',
  info: 'bg-cyan-600 hover:bg-cyan-500 text-white',
  outline: 'bg-white/5 hover:bg-white/10 text-white border border-white/15',
};

export function ModalFooter({ children, className = '' }) {
  return <div className={`flex gap-2 mt-5 ${className}`}>{children}</div>;
}

export function ModalButton({
  variant = 'ghost',
  onClick,
  disabled = false,
  type = 'button',
  className = '',
  children,
}) {
  const variantClass = VARIANT_BTN[variant] || VARIANT_BTN.ghost;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 py-2.5 rounded-lg text-sm font-bold disabled:opacity-50 transition ${variantClass} ${className}`}
    >
      {children}
    </button>
  );
}

export function ModalBody({ children, className = '' }) {
  return <div className={`text-sm text-gray-200 leading-relaxed ${className}`}>{children}</div>;
}
