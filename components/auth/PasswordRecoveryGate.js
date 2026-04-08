'use client';

import { useAuth } from '@/lib/AuthContext';
import PasswordRecoveryModal from './PasswordRecoveryModal';

export default function PasswordRecoveryGate() {
  const { passwordRecoveryPending, clearPasswordRecovery, refreshProfile } = useAuth();

  if (!passwordRecoveryPending) return null;

  return (
    <PasswordRecoveryModal
      language="ko"
      onCompleted={async () => {
        clearPasswordRecovery();
        await refreshProfile();
      }}
      onCancelled={() => {
        clearPasswordRecovery();
      }}
    />
  );
}
