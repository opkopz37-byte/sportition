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
  const raw = String(err?.message || err || '').toLowerCase();

  // 길이 미달: 구체적으로 몇 자 이상이 필요한지 추출
  const lenMatch = raw.match(/at least\s+(\d+)\s+character/i) || raw.match(/(\d+)\s*자\s*이상/);
  if (lenMatch) {
    return `비밀번호는 최소 ${lenMatch[1]}자 이상이어야 합니다.`;
  }

  if (isAuthPasswordPolicyError(err)) {
    // 문자 요구 사항 (대/소문자, 숫자, 특수문자)
    if (raw.includes('lower') && raw.includes('upper') && raw.includes('digit') && raw.includes('symbol')) {
      return '비밀번호는 대소문자·숫자·특수문자를 모두 포함해야 합니다.';
    }
    if (raw.includes('lower') && raw.includes('upper') && raw.includes('digit')) {
      return '비밀번호는 대소문자와 숫자를 포함해야 합니다.';
    }
    if (raw.includes('letter') && raw.includes('digit')) {
      return '비밀번호는 문자와 숫자를 포함해야 합니다.';
    }
    return t('passwordPolicySupabaseHint');
  }

  return String(err?.message || err) || t('passwordChangeFailed');
}
