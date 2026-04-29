import { isGuestUser, isStudentUser } from './userIdentity';

const STUDENT_USER_TYPES = new Set(['student', 'new', 'old']);

function cleanValue(value) {
  const trimmed = String(value ?? '').trim();
  return trimmed || '';
}

function inferReceiptType(user = {}) {
  const normalizedType = cleanValue(user.receiptIdType || user.userType).toLowerCase();
  if (normalizedType === 'guest' || STUDENT_USER_TYPES.has(normalizedType)) {
    return normalizedType === 'guest'
      ? normalizedType
      : 'student';
  }

  if (isGuestUser(user) || cleanValue(user.guestId)) {
    return 'guest';
 }
  if (isStudentUser(user) || cleanValue(user.studentNumber)) {
    return 'student';
  }

  return '';
}

export function resolveKioskReceiptIdentity(user = {}) {
  const inferredType = inferReceiptType(user);
  const explicitLabel = cleanValue(user.receiptIdLabel);
  const explicitValue = cleanValue(user.receiptIdValue);

  if (explicitLabel && explicitValue) {
    return {
      type: inferredType,
      label: explicitLabel,
      value: explicitValue,
    };
  }

  if (inferredType === 'guest') {
    return {
      type: 'guest',
      label: 'Guest ID',
      value: cleanValue(user.guestId || user.idNumber || user.receiptIdValue),
    };
  }

  if (inferredType === 'student') {
    return {
      type: 'student',
      label: 'Student ID Number',
      value: cleanValue(user.idNumber || user.studentNumber || user.receiptIdValue),
    };
  }

  return {
    type: '',
    label: '',
    value: '',
  };
}

export function resolveKioskReceiptProfile(user = {}) {
  const receiptIdentity = resolveKioskReceiptIdentity(user);
  const isGuestUser = receiptIdentity.type === 'guest';
  const college = !isGuestUser ? cleanValue(user.college) : '';
  const program = !isGuestUser ? cleanValue(user.program) : '';
  const guestType = isGuestUser ? cleanValue(user.guestType || user.program) : '';

  return {
    receiptIdentity,
    isGuestUser,
    guestType,
    showCollege: Boolean(college),
    showProgram: Boolean(program),
    showGuestType: Boolean(guestType),
    college,
    program,
  };
}
