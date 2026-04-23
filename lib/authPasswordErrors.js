/**
 * Supabase Auth(GoTrue)는 프로젝트의 minimum_password_length·password_requirements로
 * 약한 비밀번호를 422/weak_password로 거절합니다. (클라이언트만으로는 우회할 수 없음)
 */

export function isAuthPasswordPolicyError(err) {
  if (!err) return false;
  const code = err.code;
  if (code === 'weak_password') return true;
  const msg = String(err.message || err).toLowerCase();
  if (
    msg.includes('password should be at least') ||
    (msg.includes('at least') && msg.includes('character'))
  ) {
    return true;
  }
  if (msg.includes('password is too short') || msg.includes('weak password')) {
    return true;
  }
  return false;
}

/**
 * @param {object} err - Supabase AuthError
 * @param {(key: string) => string} t - translations getter
 */
export function formatAuthPasswordErrorMessage(err, t) {
  if (isAuthPasswordPolicyError(err)) {
    return t('passwordPolicySupabaseHint');
  }
  return String(err?.message || err) || t('passwordChangeFailed');
}
