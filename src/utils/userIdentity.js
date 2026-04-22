const STUDENT_USER_TYPES = new Set(['student', 'new', 'old']);
const NON_EMPLOYEE_USER_TYPES = new Set(['guest', 'admin', 'super_admin']);
const INTERNAL_IDENTIFIER_PATTERN = /^(?:NS|EM)-\d+$/i;

function cleanValue(value) {
  const trimmed = String(value ?? '').trim();
  return trimmed || '';
}

function pickActualIdentifier(...values) {
  const candidates = values.map((value) => cleanValue(value)).filter(Boolean);
  return candidates.find((value) => !INTERNAL_IDENTIFIER_PATTERN.test(value)) || '';
}

export function getNormalizedUserType(user = {}) {
  return cleanValue(user.userType || user.role).toLowerCase();
}

export function isGuestUser(user = {}) {
  return getNormalizedUserType(user) === 'guest';
}

export function isStudentUser(user = {}) {
  const normalizedUserType = getNormalizedUserType(user);
  if (STUDENT_USER_TYPES.has(normalizedUserType)) {
    return true;
  }

  return !isGuestUser(user) && !isEmployeeUser(user) && Boolean(cleanValue(user.studentNumber));
}

export function isEmployeeUser(user = {}) {
  const normalizedUserType = getNormalizedUserType(user);

  if (!normalizedUserType) {
    return Boolean(cleanValue(user.employeeNumber)) && !cleanValue(user.studentNumber);
  }

  if (STUDENT_USER_TYPES.has(normalizedUserType) || NON_EMPLOYEE_USER_TYPES.has(normalizedUserType)) {
    return false;
  }

  return true;
}

export function resolveDisplayIdentifier(user = {}) {
  const idNumber = cleanValue(user.idNumber);
  const studentNumber = cleanValue(user.studentNumber);
  const employeeNumber = cleanValue(user.employeeNumber);

  if (isEmployeeUser(user)) {
    return pickActualIdentifier(idNumber, employeeNumber, studentNumber) || idNumber;
  }

  return pickActualIdentifier(idNumber, studentNumber, employeeNumber) || idNumber;
}

export function getRoleIdentityInfo(user = {}) {
  const employeeUser = isEmployeeUser(user);
  const guestUser = isGuestUser(user);
  const studentUser = isStudentUser(user);
  const identifier = resolveDisplayIdentifier(user);

  return {
    isEmployeeUser: employeeUser,
    isGuestUser: guestUser,
    isStudentUser: studentUser,
    identifierLabel: employeeUser
      ? 'Employee Number'
      : studentUser
        ? 'Student ID Number'
        : 'ID Number',
    identifierValue: identifier,
    position: employeeUser ? cleanValue(user.position) || cleanValue(user.role) : '',
    department: employeeUser ? cleanValue(user.department) || cleanValue(user.program) || cleanValue(user.college) : '',
    college: studentUser ? cleanValue(user.college) : '',
    program: studentUser ? cleanValue(user.program) : '',
  };
}
