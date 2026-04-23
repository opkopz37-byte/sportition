'use client';

import { useState } from 'react';
import { Icon, SpotlightCard } from '@/components/ui';
import { setPasswordFromRecoverySession, signOut } from '@/lib/supabase';
import { translations } from '@/lib/translations';
import { formatAuthPasswordErrorMessage } from '@/lib/authPasswordErrors';

export default function PasswordRecoveryModal({
  onCompleted,
  onCancelled,
  language = 'ko',
}) {
  const t = (key) => translations[language]?.[key] || translations.ko[key] || key;
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError(t('passwordMismatch'));
      return;
    }
    setLoading(true);
    try {
      const { error: err } = await setPasswordFromRecoverySession(password);
      if (err) {
        setError(formatAuthPasswordErrorMessage(err, t));
        return;
      }
      if (typeof window !== 'undefined') {
        const { hash } = window.location;
        if (hash && hash.includes('access_token')) {
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }
      }
      onCompleted?.();
    } catch (err) {
      setError(formatAuthPasswordErrorMessage(err, t));
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    setLoading(true);
    try {
      await signOut();
      onCancelled?.();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
      <div className="w-full max-w-md">
        <SpotlightCard className="p-6 sm:p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 mb-4">
              <Icon type="zap" size={24} fill="currentColor" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">{t('recoveryModalTitle')}</h2>
            {t('recoveryModalDesc') ? (
              <p className="text-sm text-gray-400">{t('recoveryModalDesc')}</p>
            ) : null}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}
            <div>
              <label className="block text-sm text-gray-400 mb-2">{t('newPassword')}</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                autoComplete="new-password"
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">{t('confirmNewPassword')}</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                autoComplete="new-password"
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-500 hover:bg-blue-600 rounded-lg text-white font-medium disabled:opacity-50"
            >
              {loading ? '…' : t('recoverySetPassword')}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={loading}
              className="w-full py-2 text-sm text-gray-500 hover:text-gray-300"
            >
              {t('recoveryLater')}
            </button>
          </form>
        </SpotlightCard>
      </div>
    </div>
  );
}
