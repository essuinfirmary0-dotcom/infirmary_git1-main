function normalizeQrSource(value) {
  const trimmed = String(value || '').trim();
  return trimmed || null;
}

export function resolveQrValue(user = {}) {
  return (
    normalizeQrSource(user.qrData) ||
    normalizeQrSource(user.idNumber) ||
    normalizeQrSource(user.studentNumber) ||
    normalizeQrSource(user.employeeNumber) ||
    null
  );
}

export function isRenderableQrImage(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    return false;
  }

  return /^data:image\//i.test(trimmed) || /^https?:\/\//i.test(trimmed);
}

export function buildGeneratedQrUrl(qrValue) {
  const value = normalizeQrSource(qrValue);
  if (!value) {
    return null;
  }

  return `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(value)}`;
}

export function resolveUserQrCode(user = {}) {
  const existingQrCode = normalizeQrSource(user.qrCode);
  if (existingQrCode && isRenderableQrImage(existingQrCode)) {
    return existingQrCode;
  }

  return buildGeneratedQrUrl(resolveQrValue(user));
}
