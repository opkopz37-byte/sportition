'use client';

import { useState } from 'react';
import { setPasswordFromRecoverySession, signOut } from '@/lib/supabase';
import { translations } from '@/lib/translations';
import { formatAuthPasswordErrorMessage } from '@/lib/authPasswordErrors';
import Modal, { ModalFooter, ModalButton } from '@/components/Modal';

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
    e?.preventDefault();
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
    <Modal
      open
      onClose={handleCancel}
      title={t('recoveryModalTitle')}
      variant="warning"
      size="md"
      zIndexClass="z-[200]"
      closable={!loading}
    >
      {t('recoveryModalDesc') ? (
        <p className="text-sm text-gray-400 mb-4">{t('recoveryModalDesc')}</p>
      ) : null}
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
        <ModalFooter>
          <ModalButton variant="warning" type="submit" disabled={loading}>
            {loading ? '…' : t('recoverySetPassword')}
          </ModalButton>
        </ModalFooter>
      </form>
    </Modal>
  );
}
