const STUDENT_USER_TYPES = new Set(['student', 'new', 'old']);

function cleanValue(value) {
  const trimmed = String(value ?? '').trim();
  return trimmed || '';
}

function inferReceiptType(user = {}) {
  const normalizedType = cleanValue(user.receiptIdType || user.userType).toLowerCase();
  if (normalizedType === 'guest' || normalizedType === 'employee' || STUDENT_USER_TYPES.has(normalizedType)) {
    return normalizedType === 'guest' || normalizedType === 'employee'
      ? normalizedType
      : 'student';
  }

  if (cleanValue(user.guestId)) {
    return 'guest';
  }
  if (cleanValue(user.employeeNumber) && !cleanValue(user.studentNumber)) {
    return 'employee';
  }
  if (cleanValue(user.studentNumber) || cleanValue(user.employeeNumber)) {
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

  if (inferredType === 'employee') {
    return {
      type: 'employee',
      label: 'Employee No.',
      value: cleanValue(user.employeeNumber || user.receiptIdValue),
    };
  }

  if (inferredType === 'student') {
    return {
      type: 'student',
      label: 'Student No.',
      value: cleanValue(user.idNumber || user.studentNumber || user.receiptIdValue),
    };
  }

  return {
    type: '',
    label: '',
    value: '',
  };
}
