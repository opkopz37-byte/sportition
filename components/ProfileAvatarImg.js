'use client';

/**
 * 프로필 썸네일: avatar_url 있으면 이미지, 없으면 이니셜(또는 gymFallback) 표시
 */
export default function ProfileAvatarImg({
  avatarUrl,
  name,
  className = '',
  gradientClassName = 'bg-gradient-to-br from-blue-500 to-purple-500',
  textClassName = 'text-white font-bold',
  gymFallback = null,
  gymFallbackClassName = 'text-2xl leading-none select-none',
}) {
  const initial = (name || 'U').trim().charAt(0) || 'U';
  const showImg = Boolean(avatarUrl && String(avatarUrl).trim());

  return (
    <div
      className={`relative overflow-hidden flex items-center justify-center shrink-0 ${showImg ? '' : `${gradientClassName} ${textClassName}`} ${className}`}
    >
      {showImg ? (
        <img
          src={avatarUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : gymFallback != null ? (
        <span className={`relative z-0 ${gymFallbackClassName}`} aria-hidden>
          {gymFallback}
        </span>
      ) : (
        <span className="relative z-0 uppercase select-none">{initial}</span>
      )}
    </div>
  );
}
