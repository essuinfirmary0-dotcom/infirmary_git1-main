import defaultProfileImage from '../assets/default-profile.svg';

const isAllowedProfileImageSrc = (pictureUrl) => {
  if (!pictureUrl || typeof pictureUrl !== 'string') return false;

  const normalized = pictureUrl.trim();
  if (!normalized) return false;
  if (normalized.startsWith('data:image/')) return true;
  if (normalized.startsWith('blob:')) return true;
  if (normalized.startsWith('/')) return true;
  if (/^https?:\/\/localhost(?::\d+)?\//i.test(normalized)) return true;
  if (/^https?:\/\/127\.0\.0\.1(?::\d+)?\//i.test(normalized)) return true;
  if (/supabase\.co/i.test(normalized)) return false;

  return false;
};

export const getProfileImageSrc = (pictureUrl) =>
  (isAllowedProfileImageSrc(pictureUrl) ? pictureUrl : defaultProfileImage);

export const handleProfileImageError = (event) => {
  if (event.currentTarget.src === defaultProfileImage) {
    return;
  }

  event.currentTarget.src = defaultProfileImage;
};

export { defaultProfileImage };
